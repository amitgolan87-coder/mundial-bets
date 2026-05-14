import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { calculateMatchPoints, formatDateTime } from '../utils/scoring';

export default function ProfilePage() {
  const { user, profile, logout } = useAuth();
  const [bets, setBets] = useState([]);
  const [matches, setMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'bets'),
      async (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  }, [user]);

  const totalPoints = (profile?.matchPoints || 0) + (profile?.livePoints || 0) + (profile?.duelPoints || 0);

  const finishedBets = bets.filter((b) => {
    const m = matches[b.matchId];
    return m && m.status === 'finished';
  });

  const hits = finishedBets.filter((b) => {
    const m = matches[b.matchId];
    return calculateMatchPoints({ home: b.home, away: b.away }, m.result, m.odds) > 0;
  });

  const exactHits = finishedBets.filter((b) => {
    const m = matches[b.matchId];
    return b.home === m.result.home && b.away === m.result.away;
  });

  const sortedBets = [...bets].sort((a, b) => {
    const ma = matches[a.matchId];
    const mb = matches[b.matchId];
    if (!ma || !mb) return 0;
    const aTime = ma.kickoffAt?.toMillis?.() ?? 0;
    const bTime = mb.kickoffAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <div className="profile-header">
        <div className="avatar">{profile?.displayName?.[0]?.toUpperCase() || '?'}</div>
        <div className="profile-name">{profile?.displayName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{profile?.email}</div>
        {profile?.isAdmin && <span className="admin-badge">אדמין</span>}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">סה"כ נקודות</div>
          <div className="stat-value">{totalPoints}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">מאזן זמין</div>
          <div className="stat-value">{profile?.balance || 0}</div>
          <div className="stat-sub">לשימוש בהימורי לייב ודו-קרב</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">⚽ נקודות משחקים</div>
          <div className="stat-value">{profile?.matchPoints || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔥 נקודות לייב</div>
          <div className="stat-value">{profile?.livePoints || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">⚔️ נקודות דו-קרב</div>
          <div className="stat-value">{profile?.duelPoints || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">פגיעות / מתוך</div>
          <div className="stat-value">{hits.length}/{finishedBets.length}</div>
          <div className="stat-sub">מתוכן {exactHits.length} פגיעות מדויקות</div>
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: 22 }}>הניחושים שלי</h3>

      {sortedBets.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📝</div>
          <p>עדיין לא ניחשת כלום</p>
        </div>
      ) : (
        sortedBets.map((bet) => {
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
                  ניחשתי: <strong>{bet.home}-{bet.away}</strong>
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

      <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={logout}>
        🚪 התנתק
      </button>
    </div>
  );
}
