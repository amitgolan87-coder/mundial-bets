import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { isMatchOpen, formatDateTime, formatTimeUntil, calculateMatchPoints } from '../utils/scoring';
import { MATCH_LOCK_HOURS_BEFORE } from '../utils/constants';

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [myBets, setMyBets] = useState({}); // matchId -> bet
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming'); // upcoming | finished | all

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'bets');
    const unsub = onSnapshot(q, (snap) => {
      const m = {};
      snap.forEach((d) => { m[d.id] = d.data(); });
      setMyBets(m);
    });
    return () => unsub();
  }, [user]);

  const filteredMatches = useMemo(() => {
    if (filter === 'upcoming') {
      return matches.filter((m) => m.status !== 'finished');
    }
    if (filter === 'finished') {
      return matches.filter((m) => m.status === 'finished');
    }
    return matches;
  }, [matches, filter]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <h2 className="section-title">משחקי המונדיאל</h2>
      <p className="section-subtitle">
        ניחוש תוצאה מדויקת = הכפלת הנקודות. ההימור נסגר 24 שעות לפני המשחק.
      </p>

      <div className="tabs">
        <button
          className={`tab-btn ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >קרובים</button>
        <button
          className={`tab-btn ${filter === 'finished' ? 'active' : ''}`}
          onClick={() => setFilter('finished')}
        >הסתיימו</button>
        <button
          className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >הכל</button>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⚽</div>
          <p>אין משחקים להצגה</p>
        </div>
      ) : (
        filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            bet={myBets[match.id]}
            uid={user.uid}
          />
        ))
      )}
    </div>
  );
}

function MatchCard({ match, bet, uid }) {
  const [homeStr, setHomeStr] = useState(bet?.home != null ? String(bet.home) : '');
  const [awayStr, setAwayStr] = useState(bet?.away != null ? String(bet.away) : '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (bet?.home != null) setHomeStr(String(bet.home));
    if (bet?.away != null) setAwayStr(String(bet.away));
  }, [bet]);

  const open = isMatchOpen(match, MATCH_LOCK_HOURS_BEFORE);
  const finished = match.status === 'finished';

  const saveBet = async () => {
    const h = parseInt(homeStr, 10);
    const a = parseInt(awayStr, 10);
    if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0 || h > 20 || a > 20) {
      setSaveMsg('תוצאה לא תקינה');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const ref = doc(db, 'users', uid, 'bets', match.id);
      await setDoc(ref, {
        matchId: match.id,
        home: h,
        away: a,
        isAuto: false,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaveMsg('נשמר ✓');
      setTimeout(() => setSaveMsg(''), 1800);
    } catch (e) {
      setSaveMsg('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const earnedPoints = useMemo(() => {
    if (!finished || !bet || !match.result) return null;
    return calculateMatchPoints(
      { home: bet.home, away: bet.away },
      match.result,
      match.odds
    );
  }, [finished, bet, match]);

  return (
    <div className="match-card fade-up">
      <div className="match-header">
        <span className="stage">{match.stage || 'שלב הבתים'} · {match.group ? `בית ${match.group}` : ''}</span>
        <span>
          {finished ? (
            <span className="match-status finished">הסתיים</span>
          ) : open ? (
            <span className="match-status open">פתוח · {formatTimeUntil(match.kickoffAt)}</span>
          ) : (
            <span className="match-status locked">נעול</span>
          )}
        </span>
      </div>

      <div className="match-body">
        <div className="match-teams">
          <div className="team">
            <div className="team-flag">{match.homeFlag || '🏳️'}</div>
            <div className="team-name">{match.homeName}</div>
          </div>
          <div className="vs">
            {finished && match.result
              ? `${match.result.home} : ${match.result.away}`
              : 'נגד'}
          </div>
          <div className="team">
            <div className="team-flag">{match.awayFlag || '🏳️'}</div>
            <div className="team-name">{match.awayName}</div>
          </div>
        </div>

        <div className="odds-row">
          <div className="odd-pill">
            <div className="label">{match.homeName}</div>
            <div className="value">{match.odds?.home ?? '-'}</div>
          </div>
          <div className="odd-pill">
            <div className="label">תיקו</div>
            <div className="value">{match.odds?.draw ?? '-'}</div>
          </div>
          <div className="odd-pill">
            <div className="label">{match.awayName}</div>
            <div className="value">{match.odds?.away ?? '-'}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center' }}>
          ⏰ {formatDateTime(match.kickoffAt)}
        </div>

        {open && (
          <>
            <div className="score-input-row">
              <input
                type="number"
                inputMode="numeric"
                className="score-input"
                value={homeStr}
                onChange={(e) => setHomeStr(e.target.value)}
                placeholder={match.homeName}
                min="0"
                max="20"
              />
              <span className="dash">:</span>
              <input
                type="number"
                inputMode="numeric"
                className="score-input"
                value={awayStr}
                onChange={(e) => setAwayStr(e.target.value)}
                placeholder={match.awayName}
                min="0"
                max="20"
              />
            </div>
            <button
              className="btn"
              onClick={saveBet}
              disabled={saving}
              style={{ marginTop: 10 }}
            >
              {saving ? 'שומר…' : bet ? 'עדכן ניחוש' : 'שמור ניחוש'}
            </button>
            {saveMsg && (
              <div style={{
                textAlign: 'center',
                marginTop: 8,
                fontSize: 13,
                color: saveMsg.includes('✓') ? 'var(--win)' : 'var(--loss)'
              }}>
                {saveMsg}
              </div>
            )}
          </>
        )}

        {!open && bet && (
          <div className="bet-saved-row">
            הניחוש שלך: <strong>{bet.home} - {bet.away}</strong>
            {bet.isAuto && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginRight: 6 }}>(אוטומטי)</span>}
          </div>
        )}

        {!open && !bet && !finished && (
          <div className="locked-message">
            לא הספקת להמר — הימור אוטומטי ייווצר עבורך
          </div>
        )}

        {finished && bet && earnedPoints != null && (
          <div className="result-row">
            <span>הניחוש שלך: <strong>{bet.home}-{bet.away}</strong></span>
            <span className={`points-badge ${earnedPoints > 0 ? 'win' : 'loss'}`}>
              {earnedPoints > 0 ? `+${earnedPoints}` : '0'} נקודות
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
