import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isMatchOpen, calculateMatchPoints, formatDateTime } from '../utils/scoring';
import { MATCH_LOCK_HOURS_BEFORE } from '../utils/constants';

export default function UserDetailModal({ user, onClose }) {
  const [bets, setBets] = useState([]);
  const [matches, setMatches] = useState({});
  const [tab, setTab] = useState('matches');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'bets'),
      async (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Fetch match data for each bet
        const matchMap = {};
        await Promise.all(arr.map(async (bet) => {
          const m = await getDoc(doc(db, 'matches', bet.matchId));
          if (m.exists()) matchMap[bet.matchId] = { id: m.id, ...m.data() };
        }));
        setMatches(matchMap);
        setBets(arr);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user.uid]);

  // Filter: only show bets for matches that are locked or finished
  // (can't see others' bets before deadline)
  const visibleBets = bets.filter((b) => {
    const m = matches[b.matchId];
    if (!m) return false;
    return !isMatchOpen(m, MATCH_LOCK_HOURS_BEFORE);
  });

  const totalPoints = (user.matchPoints || 0) + (user.livePoints || 0) + (user.duelPoints || 0);

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="profile-header" style={{ marginBottom: 16 }}>
          <div className="avatar">
            {user.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="profile-name">{user.displayName}</div>
          {user.isAdmin && <span className="admin-badge">אדמין</span>}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">סה"כ נקודות</div>
            <div className="stat-value">{totalPoints}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">מאזן זמין</div>
            <div className="stat-value">{user.balance || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">⚽ משחקים</div>
            <div className="stat-value">{user.matchPoints || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">🔥 לייב</div>
            <div className="stat-value">{user.livePoints || 0}</div>
          </div>
        </div>

        <h4 style={{ marginBottom: 10, fontFamily: 'Frank Ruhl Libre, serif' }}>
          ניחושים של {user.displayName}
        </h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          ניחושים מוצגים רק אחרי שהמשחק נסגר להימור
        </p>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : visibleBets.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <p>אין ניחושים גלויים עדיין</p>
          </div>
        ) : (
          visibleBets.map((bet) => {
            const m = matches[bet.matchId];
            if (!m) return null;
            const finished = m.status === 'finished';
            const points = finished && m.result
              ? calculateMatchPoints({ home: bet.home, away: bet.away }, m.result, m.odds)
              : null;
            return (
              <div key={bet.id} className="card">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {formatDateTime(m.kickoffAt)}
                </div>
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <strong>{m.homeFlag} {m.homeName}</strong>
                  <span style={{ color: 'var(--flame)', fontWeight: 700 }}>
                    {finished && m.result ? `${m.result.home}-${m.result.away}` : 'vs'}
                  </span>
                  <strong>{m.awayName} {m.awayFlag}</strong>
                </div>
                <div className="flex-between" style={{ fontSize: 13 }}>
                  <span>
                    ניחש: <strong>{bet.home}-{bet.away}</strong>
                    {bet.isAuto && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>(אוטומטי)</span>}
                  </span>
                  {points != null && (
                    <span className={`points-badge ${points > 0 ? 'win' : 'loss'}`}>
                      {points > 0 ? `+${points}` : '0'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
