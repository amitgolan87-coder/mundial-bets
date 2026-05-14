import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import UserDetailModal from '../components/UserDetailModal';

const TABS = [
  { id: 'main', label: '👑 מלך המונדיאל', field: 'totalPoints' },
  { id: 'matches', label: '⚽ מלך המשחקים', field: 'matchPoints' },
  { id: 'live', label: '🔥 מלך הימורי לייב', field: 'livePoints' },
  { id: 'duels', label: '⚔️ מלך הדו-קרב', field: 'duelPoints' },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('main');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const enriched = useMemo(() => {
    // Only show approved players in leaderboards.
    // Existing users without status field are treated as approved (backward compat).
    return users
      .filter((u) => !u.status || u.status === 'approved')
      .map((u) => ({
        ...u,
        totalPoints: (u.matchPoints || 0) + (u.livePoints || 0) + (u.duelPoints || 0),
      }));
  }, [users]);

  const activeField = TABS.find((t) => t.id === tab).field;

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => (b[activeField] || 0) - (a[activeField] || 0));
  }, [enriched, activeField]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <h2 className="section-title">טבלאות אלופים</h2>
      <p className="section-subtitle">לחץ על שחקן לצפייה בפירוט המלא</p>

      <div className="leaderboard">
        <div className="leaderboard-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`leaderboard-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {sorted.map((u, i) => {
          const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
          const isMe = u.uid === user.uid;
          return (
            <div
              key={u.id}
              className="lb-row"
              onClick={() => setSelectedUser(u)}
            >
              <div className={`lb-rank ${rankClass}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </div>
              <div>
                <div className={`lb-name ${isMe ? 'me' : ''}`}>
                  {u.displayName} {isMe && '(אתה)'}
                  {u.isAdmin && <span className="admin-badge" style={{ marginRight: 8 }}>אדמין</span>}
                </div>
                <div className="lb-meta">
                  💰 מאזן: {u.balance || 0} · ⚽ {u.matchPoints || 0} · 🔥 {u.livePoints || 0} · ⚔️ {u.duelPoints || 0}
                </div>
              </div>
              <div className="lb-points">{u[activeField] || 0}</div>
            </div>
          );
        })}
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
