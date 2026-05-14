import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthScreen from './pages/AuthScreen';
import MatchesPage from './pages/MatchesPage';
import LiveBetsPage from './pages/LiveBetsPage';
import DuelsPage from './pages/DuelsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';

function Inner() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState('matches');

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user || !profile) {
    return <AuthScreen />;
  }

  const tabs = [
    { id: 'matches', label: 'משחקים', icon: '⚽' },
    { id: 'live', label: 'לייב', icon: '🔥' },
    { id: 'duels', label: 'דו-קרב', icon: '⚔️' },
    { id: 'leaderboard', label: 'טבלאות', icon: '🏆' },
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
        {tab === 'live' && <LiveBetsPage />}
        {tab === 'duels' && <DuelsPage />}
        {tab === 'leaderboard' && <LeaderboardPage />}
        {tab === 'profile' && <ProfilePage />}
        {tab === 'admin' && <AdminPage />}
      </main>

      <nav className="tabnav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
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
