import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  addDoc,
  runTransaction,
  serverTimestamp,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../utils/scoring';
import MatchPicker from '../components/MatchPicker';

// Check if two users already have a duel between them today.
// Returns the existing duel (or null). Today = same calendar day, by createdAt.
async function findTodayDuelBetween(uidA, uidB) {
  // Get start of today in local time
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMs = startOfDay.getTime();

  // Query all duels where uidA is involved AND created today.
  // We can't query both challengerId/opponentId with OR in Firestore,
  // so we query duels involving uidA two ways and combine.
  const q1 = query(
    collection(db, 'duels'),
    where('challengerId', '==', uidA),
    where('createdAt', '>=', Timestamp.fromMillis(startMs))
  );
  const q2 = query(
    collection(db, 'duels'),
    where('opponentId', '==', uidA),
    where('createdAt', '>=', Timestamp.fromMillis(startMs))
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  for (const docSnap of [...snap1.docs, ...snap2.docs]) {
    const d = docSnap.data();
    const otherSide = d.challengerId === uidA ? d.opponentId : d.challengerId;
    if (otherSide === uidB) return { id: docSnap.id, ...d };
  }
  return null;
}

export default function DuelsPage() {
  const { user, profile } = useAuth();
  const [duels, setDuels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open'); // open | mine | finished
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'duels'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDuels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredDuels = duels.filter((d) => {
    if (tab === 'open') return d.status === 'open' && d.challengerId !== user.uid;
    if (tab === 'mine') return d.challengerId === user.uid || d.opponentId === user.uid;
    if (tab === 'finished') return d.status === 'settled';
    return true;
  });

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="container">
      <h2 className="section-title">⚔️ בוא לדו-קרב</h2>
      <p className="section-subtitle">
        תזרוק אתגר, מישהו לוקח אותו, המנצח לוקח הכל.
      </p>

      <button
        className="btn btn-gold"
        onClick={() => setShowCreate(true)}
        style={{ marginBottom: 16 }}
      >
        + פתח דו-קרב חדש
      </button>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>פתוחים</button>
        <button className={`tab-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>שלי</button>
        <button className={`tab-btn ${tab === 'finished' ? 'active' : ''}`} onClick={() => setTab('finished')}>הסתיימו</button>
      </div>

      {filteredDuels.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⚔️</div>
          <p>אין דו-קרבים בקטגוריה הזו</p>
        </div>
      ) : (
        filteredDuels.map((duel) => (
          <DuelCard key={duel.id} duel={duel} uid={user.uid} balance={profile?.balance ?? 0} />
        ))
      )}

      {showCreate && (
        <CreateDuelModal
          onClose={() => setShowCreate(false)}
          uid={user.uid}
          balance={profile?.balance ?? 0}
          displayName={profile?.displayName ?? ''}
        />
      )}
    </div>
  );
}

function DuelCard({ duel, uid, balance }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const canAccept = duel.status === 'open' && duel.challengerId !== uid && balance >= duel.stake;
  const isMine = duel.challengerId === uid || duel.opponentId === uid;
  const isChallenger = duel.challengerId === uid;
  const isOpponent = duel.opponentId === uid;

  // Cancellation rules:
  // - Open duel: only challenger can cancel (refund self)
  // - Accepted duel: challenger or opponent can cancel (refund both)
  // - Both block if past deadline
  const isPastDeadline = duel.deadline
    ? Date.now() > (duel.deadline.toMillis ? duel.deadline.toMillis() : new Date(duel.deadline).getTime())
    : false;

  const canCancelOpen = duel.status === 'open' && isChallenger && !isPastDeadline;
  const canCancelAccepted = duel.status === 'accepted' && (isChallenger || isOpponent) && !isPastDeadline;

  const accept = async () => {
    setBusy(true);
    setMsg('');
    try {
      // Check daily limit BEFORE transaction
      const existing = await findTodayDuelBetween(duel.challengerId, uid);
      if (existing) {
        throw new Error(`כבר קיים דו-קרב היום בינך ובין ${duel.challengerName}`);
      }

      await runTransaction(db, async (tx) => {
        const duelRef = doc(db, 'duels', duel.id);
        const dSnap = await tx.get(duelRef);
        if (!dSnap.exists() || dSnap.data().status !== 'open') {
          throw new Error('הדו-קרב כבר נסגר');
        }

        const userRef = doc(db, 'users', uid);
        const userSnap = await tx.get(userRef);
        const myBalance = userSnap.data().balance || 0;
        if (myBalance < duel.stake) throw new Error('אין מספיק נקודות');

        tx.update(userRef, { balance: myBalance - duel.stake });
        tx.update(duelRef, {
          status: 'accepted',
          opponentId: uid,
          opponentName: userSnap.data().displayName,
          acceptedAt: serverTimestamp(),
        });
      });
      setMsg('קיבלת את הדו-קרב ✓');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelMyOpen = async () => {
    if (!confirm('לבטל את הדו-קרב? תקבל את הנקודות חזרה.')) return;
    setBusy(true);
    setMsg('');
    try {
      await runTransaction(db, async (tx) => {
        const duelRef = doc(db, 'duels', duel.id);
        const dSnap = await tx.get(duelRef);
        if (!dSnap.exists() || dSnap.data().status !== 'open') {
          throw new Error('לא ניתן לבטל - הדו-קרב כבר התקבל');
        }
        const userRef = doc(db, 'users', uid);
        const userSnap = await tx.get(userRef);
        tx.update(userRef, { balance: (userSnap.data().balance || 0) + duel.stake });
        tx.delete(duelRef);
      });
      setMsg('בוטל ✓');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelAccepted = async () => {
    if (!confirm(`לבטל את הדו-קרב? הנקודות יוחזרו לשניכם.`)) return;
    setBusy(true);
    setMsg('');
    try {
      await runTransaction(db, async (tx) => {
        const duelRef = doc(db, 'duels', duel.id);
        const dSnap = await tx.get(duelRef);
        if (!dSnap.exists() || dSnap.data().status !== 'accepted') {
          throw new Error('הדו-קרב כבר הוכרע או בוטל');
        }
        const challengerRef = doc(db, 'users', duel.challengerId);
        const opponentRef = doc(db, 'users', duel.opponentId);
        const c = await tx.get(challengerRef);
        const o = await tx.get(opponentRef);
        tx.update(challengerRef, { balance: (c.data().balance || 0) + duel.stake });
        tx.update(opponentRef, { balance: (o.data().balance || 0) + duel.stake });
        tx.delete(duelRef);
      });
      setMsg('בוטל ✓');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="duel-card fade-up">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        🎯 {duel.challengerName} {duel.status === 'open' ? 'אומר:' : `נגד ${duel.opponentName}:`}
      </div>
      <div className="duel-claim">"{duel.claim}"</div>

      <RelatedMatches matchIds={duel.matchIds || []} />

      <div className="duel-stake">
        <span>סיכון כל צד:</span>
        <span className="stake-amount">{duel.stake} נק׳</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        🕒 נפתח: {formatDateTime(duel.createdAt)}
        {duel.deadline && <span> · 📅 הכרעה עד: {formatDateTime(duel.deadline)}</span>}
      </div>

      {duel.status === 'settled' && (
        <div className="result-row">
          <span>🏆 ניצח: <strong>{duel.winnerName}</strong></span>
          {isMine && (
            <span className={`points-badge ${duel.winnerId === uid ? 'win' : 'loss'}`}>
              {duel.winnerId === uid ? `+${duel.stake}` : `-${duel.stake}`} נקודות
            </span>
          )}
        </div>
      )}

      {canAccept && (
        <button className="btn btn-gold" style={{ marginTop: 10 }} onClick={accept} disabled={busy}>
          {busy ? '…' : '🤝 קח את האתגר'}
        </button>
      )}

      {duel.status === 'open' && !canAccept && duel.challengerId !== uid && (
        <div className="locked-message">אין לך מספיק נקודות לאתגר הזה</div>
      )}

      {canCancelOpen && (
        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={cancelMyOpen} disabled={busy}>
          {busy ? '…' : '❌ בטל את הדו-קרב'}
        </button>
      )}

      {duel.status === 'accepted' && (
        <>
          <div className="locked-message">ממתין להכרעה ע"י אדמין</div>
          {canCancelAccepted && (
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={cancelAccepted} disabled={busy}>
              {busy ? '…' : '❌ בטל ותחזיר נקודות לשני הצדדים'}
            </button>
          )}
        </>
      )}

      {msg && (
        <div style={{
          textAlign: 'center', marginTop: 8, fontSize: 13,
          color: msg.includes('✓') ? 'var(--win)' : 'var(--loss)'
        }}>{msg}</div>
      )}
    </div>
  );
}

function CreateDuelModal({ onClose, uid, balance, displayName }) {
  const [claim, setClaim] = useState('');
  const [stakeStr, setStakeStr] = useState('');
  const [deadlineStr, setDeadlineStr] = useState('');
  const [deadlineAuto, setDeadlineAuto] = useState(true);
  const [matchIds, setMatchIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Auto-update deadline = earliest match kickoff (max deadline for duel)
  const handleMatchesChange = (ids, earliestMillis) => {
    setMatchIds(ids);
    if (deadlineAuto && earliestMillis) {
      const d = new Date(earliestMillis);
      const pad = (n) => String(n).padStart(2, '0');
      setDeadlineStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
  };

  const submit = async () => {
    setErr('');
    if (!claim.trim()) { setErr('תכתוב על מה ההימור'); return; }
    const stake = parseInt(stakeStr, 10);
    if (Number.isNaN(stake) || stake <= 0) { setErr('סכום לא תקין'); return; }
    if (stake > 5) { setErr('הימור דו-קרב מוגבל למקסימום 5 נקודות'); return; }
    if (stake > balance) { setErr('אין מספיק נקודות'); return; }

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', uid);
        const userSnap = await tx.get(userRef);
        const currentBalance = userSnap.data().balance || 0;
        if (currentBalance < stake) throw new Error('אין מספיק נקודות');

        tx.update(userRef, { balance: currentBalance - stake });

        const duelRef = doc(collection(db, 'duels'));
        tx.set(duelRef, {
          challengerId: uid,
          challengerName: displayName,
          opponentId: null,
          opponentName: null,
          claim: claim.trim(),
          stake,
          status: 'open',
          deadline: deadlineStr ? new Date(deadlineStr) : null,
          matchIds,
          createdAt: serverTimestamp(),
        });
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">⚔️ דו-קרב חדש</h3>

        {err && <div className="error-msg">{err}</div>}

        <div className="field">
          <label>על מה אתה מהמר</label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder='לדוגמה: "יהיו יותר מ-2 כרטיסים אדומים היום במשחקים שנבחרו"'
            rows="3"
          />
        </div>

        <div className="field">
          <label>כמה נקודות אתה מסכן (מקסימום 5, יש לך {balance})</label>
          <input
            type="number"
            inputMode="numeric"
            value={stakeStr}
            onChange={(e) => setStakeStr(e.target.value)}
            placeholder="1-5"
            min="1"
            max={Math.min(5, balance)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            ℹ️ דו-קרב מוגבל ל-5 נקודות לסיבוב כדי לשמור על האיזון
          </div>
        </div>

        <div className="field">
          <label>משחקים רלוונטיים (אופציונלי)</label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            הימור על משחקים ספציפיים? בחר טווח תאריכים או בחירה ידנית. תאריך ההכרעה ייקבע אוטומטית לפי המשחק המוקדם בטווח.
          </div>
          <MatchPicker selectedIds={matchIds} onChange={handleMatchesChange} />
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={deadlineAuto} onChange={(e) => setDeadlineAuto(e.target.checked)} style={{ width: 'auto' }} />
            תאריך הכרעה אוטומטי (לפי המשחק המוקדם)
          </label>
          <label>תאריך הכרעה</label>
          <input
            type="datetime-local"
            value={deadlineStr}
            onChange={(e) => { setDeadlineStr(e.target.value); setDeadlineAuto(false); }}
          />
        </div>

        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? 'שולח…' : 'פתח דו-קרב'}
        </button>
      </div>
    </div>
  );
}
