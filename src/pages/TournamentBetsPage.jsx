import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../utils/scoring';

export default function TournamentBetsPage() {
  const { user } = useAuth();
  const [tournamentBets, setTournamentBets] = useState([]);
  const [myPredictions, setMyPredictions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tournamentBets'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setTournamentBets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'tournamentPredictions');
    const unsub = onSnapshot(q, (snap) => {
      const m = {};
      snap.forEach((d) => { m[d.id] = d.data(); });
      setMyPredictions(m);
    });
    return () => unsub();
  }, [user]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <h2 className="section-title">🏆 ניחושי טורניר</h2>
      <p className="section-subtitle">
        ניחושים ארוכי-טווח - בחירה חינמית, אם פגעת מקבל את הנקודות של היחס בסוף הטורניר
      </p>

      {tournamentBets.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎯</div>
          <p>עוד אין ניחושי טורניר פעילים</p>
        </div>
      ) : (
        tournamentBets.map((tb) => (
          <TournamentBetCard
            key={tb.id}
            bet={tb}
            myPick={myPredictions[tb.id]}
            uid={user.uid}
          />
        ))
      )}
    </div>
  );
}

function TournamentBetCard({ bet, myPick, uid }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const now = Date.now();
  const closesMs = bet.closesAt?.toMillis ? bet.closesAt.toMillis() : new Date(bet.closesAt).getTime();
  const isOpen = !bet.settled && now < closesMs;
  const isSettled = bet.settled;

  const sortedOptions = useMemo(() => {
    return [...(bet.options || [])].sort((a, b) => (a.odds || 0) - (b.odds || 0));
  }, [bet.options]);

  const submit = async (option) => {
    setBusy(true);
    setMsg('');
    try {
      await setDoc(doc(db, 'users', uid, 'tournamentPredictions', bet.id), {
        tournamentBetId: bet.id,
        optionKey: option.key,
        optionLabel: option.label,
        odds: option.odds,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMsg('נשמר ✓');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Color of an option button based on state
  const getOptionStyle = (option) => {
    const isMyPick = myPick?.optionKey === option.key;
    const isWinner = isSettled && bet.winningKey === option.key;
    const isMyPickAndWinner = isMyPick && isWinner;
    const isMyPickAndLost = isMyPick && isSettled && !isWinner;

    if (isMyPickAndWinner) return { background: 'rgba(74, 222, 128, 0.2)', borderColor: 'var(--win)', color: 'var(--win)' };
    if (isMyPickAndLost) return { background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--loss)' };
    if (isWinner) return { background: 'rgba(245, 197, 66, 0.15)', borderColor: 'var(--gold)' };
    if (isMyPick) return { background: 'rgba(245, 197, 66, 0.12)', borderColor: 'var(--gold)' };
    return {};
  };

  return (
    <div className="livebet-card fade-up">
      <div className="livebet-title">{bet.title}</div>
      {bet.description && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>
          {bet.description}
        </div>
      )}

      <div className="livebet-meta">
        {isSettled ? (
          <span className="match-status finished">הוכרע</span>
        ) : isOpen ? (
          <span className="match-status open">פתוח · נסגר {formatDateTime(bet.closesAt)}</span>
        ) : (
          <span className="match-status locked">נסגר · ממתין להכרעה</span>
        )}
        <span>📊 {sortedOptions.length} אפשרויות</span>
      </div>

      {myPick && (
        <div style={{
          background: isSettled
            ? (bet.winningKey === myPick.optionKey ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)')
            : 'rgba(245, 197, 66, 0.08)',
          border: '1px solid',
          borderColor: isSettled
            ? (bet.winningKey === myPick.optionKey ? 'var(--win)' : 'var(--loss)')
            : 'var(--gold)',
          borderRadius: 'var(--radius-sm)',
          padding: 10,
          marginBottom: 12,
          fontSize: 13,
        }}>
          <div className="flex-between">
            <span>הבחירה שלך: <strong>{myPick.optionLabel}</strong></span>
            {isSettled ? (
              bet.winningKey === myPick.optionKey ? (
                <span className="points-badge win">🎯 פגעת! +{myPick.odds}</span>
              ) : (
                <span className="points-badge loss">לא פגעת</span>
              )
            ) : (
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>צפי: +{myPick.odds} נק׳ אם תפגע</span>
            )}
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 6,
        maxHeight: myPick && !isOpen ? 200 : 'none',
        overflowY: myPick && !isOpen ? 'auto' : 'visible',
      }}>
        {sortedOptions.map((option) => {
          const style = getOptionStyle(option);
          const isMyPick = myPick?.optionKey === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => isOpen && !busy && submit(option)}
              disabled={!isOpen || busy}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: isOpen ? 'pointer' : 'default',
                opacity: !isOpen && !isMyPick && !(isSettled && bet.winningKey === option.key) ? 0.5 : 1,
                fontSize: 14,
                color: 'var(--text)',
                transition: 'all 0.15s',
                ...style,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {option.flag && <span style={{ fontSize: 18 }}>{option.flag}</span>}
                <span style={{ fontWeight: isMyPick ? 800 : 500 }}>{option.label}</span>
                {isMyPick && <span style={{ fontSize: 11, color: 'var(--gold)' }}>✓ בחירתך</span>}
                {isSettled && bet.winningKey === option.key && <span style={{ fontSize: 16 }}>🏆</span>}
              </span>
              <span style={{
                fontFamily: 'Frank Ruhl Libre, serif',
                fontWeight: 900,
                fontSize: 16,
                color: 'var(--gold)',
              }}>
                +{option.odds}
              </span>
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{
          textAlign: 'center',
          marginTop: 8,
          fontSize: 13,
          color: msg.includes('✓') ? 'var(--win)' : 'var(--loss)'
        }}>
          {msg}
        </div>
      )}

      {!isOpen && !isSettled && (
        <div className="locked-message" style={{ marginTop: 10 }}>
          🔒 הניחושים נסגרו · ממתין לסיום הטורניר
        </div>
      )}
    </div>
  );
}
