import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { calculateMatchPoints, formatDateTime, isMatchLive } from '../utils/scoring';

export default function LivePage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [allBets, setAllBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to live matches (no orderBy on server - avoids needing composite index)
    const q = query(
      collection(db, 'matches'),
      where('status', '==', 'live')
    );
    const u1 = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by kickoffAt client-side
      arr.sort((a, b) => {
        const ma = a.kickoffAt?.toMillis ? a.kickoffAt.toMillis() : 0;
        const mb = b.kickoffAt?.toMillis ? b.kickoffAt.toMillis() : 0;
        return ma - mb;
      });
      setMatches(arr);
      setLoading(false);
    }, (err) => {
      console.error('Live matches listen error:', err);
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u3 = onSnapshot(collectionGroup(db, 'bets'), (snap) => {
      setAllBets(snap.docs.map((d) => ({
        id: d.id,
        userId: d.ref.parent.parent.id,
        ...d.data(),
      })));
    }, (err) => {
      console.error('Bets collection group listen error:', err);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  // Map of approved userId -> displayName
  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => {
      if (!u.status || u.status === 'approved') {
        m[u.uid] = u.displayName;
      }
    });
    return m;
  }, [users]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <h2 className="section-title">🔴 LIVE</h2>
      <p className="section-subtitle">משחקים שמשוחקים עכשיו - צפי הניקוד מתעדכן בזמן אמת</p>

      {matches.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⏸️</div>
          <p>אין כרגע משחקים חיים</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            ברגע שאדמין יעדכן תוצאה במהלך משחק - תראה כאן את הצפי לניקוד של כל השחקנים
          </p>
        </div>
      ) : (
        matches.map((match) => {
          const matchBets = allBets.filter((b) => b.matchId === match.id);
          return (
            <LiveMatchCard
              key={match.id}
              match={match}
              bets={matchBets}
              userMap={userMap}
              myUid={user.uid}
            />
          );
        })
      )}
    </div>
  );
}

function LiveMatchCard({ match, bets, userMap, myUid }) {
  // Compute projected points for each user given current score
  const projections = useMemo(() => {
    if (!match.result) return [];

    const arr = bets
      .filter((b) => userMap[b.userId]) // approved users only
      .map((b) => {
        const projectedPoints = calculateMatchPoints(b, match.result, match.odds);
        const isExact = b.home === match.result.home && b.away === match.result.away;
        return {
          uid: b.userId,
          name: userMap[b.userId],
          prediction: `${b.home}-${b.away}`,
          isAuto: b.isAuto,
          projectedPoints,
          isExact,
        };
      });

    arr.sort((a, b) => b.projectedPoints - a.projectedPoints);
    return arr;
  }, [match, bets, userMap]);

  const myProjection = projections.find((p) => p.uid === myUid);

  return (
    <div className="match-card fade-up" style={{
      border: '2px solid rgba(239, 68, 68, 0.4)',
      boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)',
    }}>
      <div className="match-header" style={{ background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, var(--surface) 100%)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontWeight: 800, fontSize: 12, letterSpacing: '0.1em' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
            animation: 'pulse-red 1.5s ease-in-out infinite',
            display: 'inline-block',
          }} />
          LIVE
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          התחלה: {formatDateTime(match.kickoffAt)}
        </span>
      </div>
      <div className="match-body">
        <div className="match-teams" style={{ marginBottom: 14 }}>
          <div className="team">
            <div className="team-flag">{match.homeFlag}</div>
            <div className="team-name">{match.homeName}</div>
          </div>
          <div className="vs" style={{ fontSize: 36, color: 'var(--gold)' }}>
            {match.result?.home ?? 0} : {match.result?.away ?? 0}
          </div>
          <div className="team">
            <div className="team-flag">{match.awayFlag}</div>
            <div className="team-name">{match.awayName}</div>
          </div>
        </div>

        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginBottom: 14,
          padding: '6px 10px',
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          יחסים: {match.homeName} {match.odds?.home} · תיקו {match.odds?.draw} · {match.awayName} {match.odds?.away}
          {' · '}פגיעה מדויקת = x2
        </div>

        {/* My projection highlighted */}
        {myProjection && (
          <div style={{
            background: 'linear-gradient(135deg, var(--surface-3) 0%, rgba(245, 197, 66, 0.1) 100%)',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius)',
            padding: 12,
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6, letterSpacing: '0.05em' }}>
              הצפי שלך
            </div>
            <div className="flex-between" style={{ fontSize: 14 }}>
              <span>ניחשת: <strong>{myProjection.prediction}</strong>
                {myProjection.isAuto && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>(אוטו׳)</span>}
              </span>
              {myProjection.isExact && (
                <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>🎯 מדויק!</span>
              )}
              <span className={`points-badge ${myProjection.projectedPoints > 0 ? 'win' : 'loss'}`}>
                {myProjection.projectedPoints > 0 ? `+${myProjection.projectedPoints}` : '0'} נק׳ צפי
              </span>
            </div>
          </div>
        )}

        {/* All projections */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          צפי לכולם ({projections.length})
        </div>
        {projections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)', fontSize: 13 }}>
            אין הימורים על המשחק
          </div>
        ) : (
          projections.map((p, i) => (
            <div key={p.uid} style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr auto auto',
              gap: 8,
              alignItems: 'center',
              padding: '6px 10px',
              background: p.uid === myUid ? 'rgba(245, 197, 66, 0.08)' : 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 4,
              fontSize: 13,
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{i + 1}</span>
              <span><strong>{p.name}</strong>{p.uid === myUid && ' (אתה)'}</span>
              <span style={{ fontFamily: 'Frank Ruhl Libre, serif', fontWeight: 700, color: 'var(--text)' }}>
                {p.prediction}
                {p.isExact && <span style={{ marginRight: 4 }}>🎯</span>}
              </span>
              <span className={`points-badge ${p.projectedPoints > 0 ? 'win' : 'loss'}`}>
                {p.projectedPoints > 0 ? `+${p.projectedPoints}` : '0'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
