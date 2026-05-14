import { useAuth } from '../contexts/AuthContext';

export default function PendingApprovalScreen() {
  const { profile, logout } = useAuth();
  const isDisabled = profile?.status === 'disabled';

  return (
    <div className="auth-screen">
      <div className="auth-card fade-up">
        <div style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>
          {isDisabled ? '🚫' : '⏳'}
        </div>

        <h1 className="auth-title">
          {isDisabled ? 'גישה הושבתה' : 'ממתין לאישור'}
        </h1>

        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          {isDisabled
            ? 'הגישה שלך הושבתה ע"י האדמין. אנא פנה אליו לקבלת פרטים נוספים.'
            : 'תודה שנרשמת! האדמין צריך לאשר את החשבון שלך לפני שתוכל להשתתף בתחרות.'}
        </p>

        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginBottom: 20,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 8 }}>פרטי החשבון שלך:</div>
          <div><strong>שם:</strong> {profile?.displayName}</div>
          <div><strong>מייל:</strong> {profile?.email}</div>
        </div>

        {!isDisabled && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
            תוכל לרענן את הדף בעוד כמה רגעים — ברגע שהאדמין יאשר, האתר ייפתח אוטומטית.
          </div>
        )}

        <button className="btn btn-secondary" onClick={logout}>
          🚪 התנתק
        </button>
      </div>
    </div>
  );
}
