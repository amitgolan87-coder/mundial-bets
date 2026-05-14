import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase/config';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthScreen from './pages/AuthScreen';
import MatchesPage from './pages/MatchesPage';
import LiveBetsPage from './pages/LiveBetsPage';
import DuelsPage from './pages/DuelsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import TransparencyPage from './pages/TransparencyPage';
import PendingApprovalScreen from './pages/PendingApprovalScreen';
import LivePage from './pages/LivePage';
import { useNotifications, markTabSeen } from './hooks/useNotifications';

function Inner() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState('matches');
  const [liveCount, setLiveCount] = useState(0);
  const notifs = useNotifications(user?.uid);

  // Subscribe to live matches count (for the LIVE tab badge)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'matches'), where('status', '==', 'live'));
    const unsub = onSnapshot(q, (snap) => {
      setLiveCount(snap.size);
    });
    return () => unsub();
  }, [user]);

  // When user switches to a tab, mark it as seen
  useEffect(() => {
    if (!user) return;
    if (tab === 'livebets') markTabSeen(user.uid, 'live');
    if (tab === 'duels') markTabSeen(user.uid, 'duels');
  }, [tab, user]);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user || !profile) {
    return <AuthScreen />;
  }

  if (!profile.isAdmin && profile.status !== 'approved') {
    return <PendingApprovalScreen />;
  }

  const tabs = [
    { id: 'matches', label: 'משחקים', icon: '⚽' },
    { id: 'live', label: 'LIVE', icon: '🔴', liveBadge: liveCount },
    { id: 'livebets', label: 'הימורי לייב', icon: '🔥', badge: notifs.live },
    { id: 'duels', label: 'דו-קרב', icon: '⚔️', badge: notifs.duels },
    { id: 'leaderboard', label: 'טבלאות', icon: '🏆' },
    { id: 'transparency', label: 'תזוזה', icon: '🔍' },
    { id: 'profile', label: 'אישי', icon: '👤' },
  ];

  if (profile.isAdmin) {
    tabs.push({ id: 'admin', label: 'ניהול', icon: '🛠️' });
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">⚽</div>
          מונדיאל<span style={{ color: 'var(--flame)' }}>בטס</span>
        </div>
        <div className="balance-chip">
          💰 {profile.balance || 0}
        </div>
      </div>

      <main style={{ paddingTop: 16 }}>
        {tab === 'matches' && <MatchesPage />}
        {tab === 'live' && <LivePage />}
        {tab === 'livebets' && <LiveBetsPage />}
        {tab === 'duels' && <DuelsPage />}
        {tab === 'leaderboard' && <LeaderboardPage />}
        {tab === 'transparency' && <TransparencyPage />}
        {tab === 'profile' && <ProfilePage />}
        {tab === 'admin' && <AdminPage />}
      </main>

      <nav className="tabnav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
            style={{ position: 'relative' }}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.badge > 0 && (
              <span className="notif-badge">{t.badge > 9 ? '9+' : t.badge}</span>
            )}
            {t.liveBadge > 0 && (
              <span className="live-badge">{t.liveBadge}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
