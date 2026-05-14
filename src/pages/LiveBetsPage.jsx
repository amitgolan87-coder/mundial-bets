import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime, formatTimeUntil } from '../utils/scoring';

export default function LiveBetsPage() {
  const { user, profile } = useAuth();
  const [liveBets, setLiveBets] = useState([]);
  const [myEntries, setMyEntries] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'liveBets'), orderBy('closesAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setLiveBets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'liveEntries');
    const unsub = onSnapshot(q, (snap) => {
      const m = {};
      snap.forEach((d) => { m[d.id] = d.data(); });
      setMyEntries(m);
    });
    return () => unsub();
  }, [user]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <h2 className="section-title">🔥 הימורי לייב</h2>
      <p className="section-subtitle">
        סכן נקודות לפי התשוקה. אם פגעת — מקבל את ההימור x היחס. אחרת — איבדת.
      </p>

      {liveBets.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎲</div>
          <p>עוד אין הימורי לייב פעילים</p>
        </div>
      ) : (
        liveBets.map((lb) => (
          <LiveBetCard
            key={lb.id}
            liveBet={lb}
            entry={myEntries[lb.id]}
            uid={user.uid}
            balance={profile?.balance ?? 0}
          />
        ))
      )}
    </div>
  );
}

function LiveBetCard({ liveBet, entry, uid, balance }) {
  const [stakeStr, setStakeStr] = useState('');
  const [side, setSide] = useState('yes'); // some live bets may have yes/no
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const now = Date.now();
  const closesAt = liveBet.closesAt?.toMillis?.() ?? new Date(liveBet.closesAt).getTime();
  const isOpen = !liveBet.settled && now < closesAt;
  const isSettled = liveBet.settled;

  const maxStake = useMemo(() => {
    const cap = liveBet.maxStake || Infinity;
    return Math.min(cap, balance);
  }, [liveBet.maxStake, balance]);

  const placeBet = async () => {
    const stake = parseInt(stakeStr, 10);
    if (Number.isNaN(stake) || stake <= 0) {
      setMsg('סכום לא תקין');
      return;
    }
    if (stake > maxStake) {
      setMsg(`מקסימום ${maxStake} נקודות`);
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('משתמש לא נמצא');
        const currentBalance = userSnap.data().balance || 0;

        // Check existing entry — total stake can't exceed cap or balance
        const entryRef = doc(db, 'users', uid, 'liveEntries', liveBet.id);
        const entrySnap = await tx.get(entryRef);
        const prevStake = entrySnap.exists() ? (entrySnap.data().stake || 0) : 0;

        // For changing an entry: refund old, charge new
        const delta = stake - prevStake;
        if (delta > currentBalance) throw new Error('אין מספיק נקודות');
        if (stake > (liveBet.maxStake || Infinity)) throw new Error('חרגת ממקסימום ההימור');

        tx.update(userRef, { balance: currentBalance - delta });
        tx.set(entryRef, {
          liveBetId: liveBet.id,
          stake,
          side,
          placedAt: serverTimestamp(),
        });
      });
      setMsg('הימור נקלט ✓');
      setStakeStr('');
      setTimeout(() => setMsg(''), 1800);
    } catch (e) {
      setMsg(e.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="livebet-card fade-up">
      <div className="livebet-title">{liveBet.title}</div>
      {liveBet.description && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>
          {liveBet.description}
        </div>
      )}

      <div className="livebet-meta">
        <span className="multiplier-pill">x{liveBet.multiplier}</span>
        <span>⏰ נסגר: {formatDateTime(liveBet.closesAt)}</span>
        {liveBet.maxStake && <span>📊 מקס׳ {liveBet.maxStake} נקודות</span>}
      </div>

      {isSettled ? (
        <div className="result-row">
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            תוצאה: <strong style={{ color: 'var(--text)' }}>
              {liveBet.outcome === 'yes' ? 'קרה ✓' : liveBet.outcome === 'no' ? 'לא קרה ✗' : 'בוטל'}
            </strong>
          </span>
          {entry && (
            <span className={`points-badge ${entry.settledPoints > 0 ? 'win' : 'loss'}`}>
              {entry.settledPoints > 0 ? `+${entry.settledPoints}` : entry.settledPoints || `-${entry.stake}`} נקודות
            </span>
          )}
        </div>
      ) : isOpen ? (
        <>
          {entry && (
            <div className="bet-saved-row" style={{ marginBottom: 10 }}>
              ההימור הנוכחי שלך: <strong>{entry.stake} נק׳ על "{entry.side === 'yes' ? 'יקרה' : 'לא יקרה'}"</strong>
            </div>
          )}
          {liveBet.hasNoOption && (
            <div className="row-2" style={{ marginBottom: 8 }}>
              <button
                className={`btn-sm ${side === 'yes' ? 'btn' : 'btn-ghost btn-sm'}`}
                onClick={() => setSide('yes')}
                style={{ width: '100%' }}
              >יקרה</button>
              <button
                className={`btn-sm ${side === 'no' ? 'btn' : 'btn-ghost btn-sm'}`}
                onClick={() => setSide('no')}
                style={{ width: '100%' }}
              >לא יקרה</button>
            </div>
          )}
          <div className="row-2">
            <input
              type="number"
              inputMode="numeric"
              value={stakeStr}
              onChange={(e) => setStakeStr(e.target.value)}
              placeholder={`כמה נקודות? (עד ${maxStake})`}
              min="1"
              max={maxStake}
            />
            <button className="btn" onClick={placeBet} disabled={busy}>
              {busy ? '…' : entry ? 'עדכן' : 'הימור'}
            </button>
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
        </>
      ) : (
        <div className="locked-message">ההימור נסגר · ממתין לתוצאה</div>
      )}
    </div>
  );
}
