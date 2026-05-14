import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (displayName.trim().length < 2) {
          throw new Error('שם חייב להיות לפחות 2 תווים');
        }
        await signUp(email, password, displayName.trim());
      }
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'אימייל או סיסמה שגויים'
        : err.code === 'auth/email-already-in-use' ? 'אימייל כבר רשום'
        : err.code === 'auth/weak-password' ? 'סיסמה חלשה מדי (לפחות 6 תווים)'
        : err.message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card fade-up">
        <h1 className="auth-title">
          מונדיאל<span className="accent">⚽</span>בטס
        </h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'ברוכים החוזרים, אלופים' : 'הצטרפו לליגה'}
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label>שם תצוגה</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="איך נציג אותך בטבלה"
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className="field">
            <label>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              dir="ltr"
            />
          </div>
          <div className="field">
            <label>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              dir="ltr"
            />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'רגע…' : mode === 'login' ? 'כניסה' : 'הרשמה'}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? 'אין לך חשבון?' : 'כבר רשום?'}{' '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'הרשם' : 'התחבר'}
          </button>
        </div>
      </div>
    </div>
  );
}
