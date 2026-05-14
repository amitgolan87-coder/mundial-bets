import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  runTransaction,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { MATCH_POINT_TOTAL, pickRandomRealisticScore } from '../utils/constants';
import { calculateMatchPoints, formatDateTime } from '../utils/scoring';

export default function AdminPage() {
  const { profile } = useAuth();
  const [section, setSection] = useState('matches');

  if (!profile?.isAdmin) {
    return (
      <div className="container">
        <div className="empty">
          <div className="empty-icon">🔒</div>
          <p>גישת אדמין נדרשת</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            כדי להפוך משתמש לאדמין: פתח את Firestore Console → users → המסמך שלך → קבע isAdmin = true
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h2 className="section-title">🛠️ ניהול</h2>

      <div className="tabs">
        <button className={`tab-btn ${section === 'matches' ? 'active' : ''}`} onClick={() => setSection('matches')}>משחקים</button>
        <button className={`tab-btn ${section === 'live' ? 'active' : ''}`} onClick={() => setSection('live')}>הימורי לייב</button>
        <button className={`tab-btn ${section === 'duels' ? 'active' : ''}`} onClick={() => setSection('duels')}>דו-קרבים</button>
        <button className={`tab-btn ${section === 'users' ? 'active' : ''}`} onClick={() => setSection('users')}>משתמשים</button>
      </div>

      {section === 'matches' && <ManageMatches />}
      {section === 'live' && <ManageLiveBets />}
      {section === 'duels' && <ManageDuels />}
      {section === 'users' && <ManageUsers />}
    </div>
  );
}

// =================== MATCHES ===================
function ManageMatches() {
  const [matches, setMatches] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [settling, setSettling] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <>
      <button className="btn btn-gold" onClick={() => setShowAdd(true)} style={{ marginBottom: 16 }}>
        + הוסף משחק
      </button>

      {matches.map((m) => (
        <div key={m.id} className="admin-card">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <strong>{m.homeFlag} {m.homeName} vs {m.awayName} {m.awayFlag}</strong>
            <span className={`match-status ${m.status === 'finished' ? 'finished' : 'open'}`}>
              {m.status === 'finished' ? 'הסתיים' : 'פעיל'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            {formatDateTime(m.kickoffAt)} · יחס {m.odds?.home}-{m.odds?.draw}-{m.odds?.away}
            {m.result && <span> · תוצאה: {m.result.home}-{m.result.away}</span>}
          </div>
          <div className="row-3">
            <button className="btn-sm btn-secondary" onClick={() => setEditing(m)}>ערוך</button>
            <button className="btn-sm btn-gold" onClick={() => setSettling(m)}>קבע תוצאה</button>
            <button className="btn-sm btn-danger" onClick={async () => {
              if (confirm('למחוק את המשחק?')) await deleteDoc(doc(db, 'matches', m.id));
            }}>מחק</button>
          </div>
        </div>
      ))}

      {showAdd && <MatchFormModal onClose={() => setShowAdd(false)} />}
      {editing && <MatchFormModal match={editing} onClose={() => setEditing(null)} />}
      {settling && <SettleMatchModal match={settling} onClose={() => setSettling(null)} />}
    </>
  );
}

function MatchFormModal({ match, onClose }) {
  const isEdit = !!match;
  const [homeName, setHomeName] = useState(match?.homeName || '');
  const [awayName, setAwayName] = useState(match?.awayName || '');
  const [homeFlag, setHomeFlag] = useState(match?.homeFlag || '🏳️');
  const [awayFlag, setAwayFlag] = useState(match?.awayFlag || '🏳️');
  const [kickoff, setKickoff] = useState(
    match?.kickoffAt
      ? new Date(match.kickoffAt.toMillis ? match.kickoffAt.toMillis() : match.kickoffAt).toISOString().slice(0, 16)
      : ''
  );
  const [stage, setStage] = useState(match?.stage || 'שלב הבתים');
  const [group, setGroup] = useState(match?.group || '');
  const [oh, setOh] = useState(match?.odds?.home ?? 5);
  const [od, setOd] = useState(match?.odds?.draw ?? 5);
  const [oa, setOa] = useState(match?.odds?.away ?? 5);
  const [err, setErr] = useState('');

  const total = Number(oh) + Number(od) + Number(oa);

  const save = async () => {
    setErr('');
    if (!homeName || !awayName) { setErr('שמות קבוצות חסרים'); return; }
    if (!kickoff) { setErr('תאריך משחק חסר'); return; }
    if (total !== MATCH_POINT_TOTAL) {
      setErr(`סך היחסים חייב להיות ${MATCH_POINT_TOTAL} (כרגע ${total})`);
      return;
    }
    const data = {
      homeName, awayName,
      homeFlag: homeFlag || '🏳️',
      awayFlag: awayFlag || '🏳️',
      kickoffAt: new Date(kickoff),
      stage, group,
      odds: { home: Number(oh), draw: Number(od), away: Number(oa) },
      status: match?.status || 'scheduled',
    };
    if (isEdit) {
      await updateDoc(doc(db, 'matches', match.id), data);
    } else {
      await addDoc(collection(db, 'matches'), { ...data, createdAt: serverTimestamp() });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{isEdit ? 'ערוך משחק' : 'משחק חדש'}</h3>
        {err && <div className="error-msg">{err}</div>}
        <div className="row-2">
          <div className="field">
            <label>קבוצת בית</label>
            <input value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="ברזיל" />
          </div>
          <div className="field">
            <label>דגל</label>
            <input value={homeFlag} onChange={(e) => setHomeFlag(e.target.value)} placeholder="🇧🇷" />
          </div>
        </div>
        <div className="row-2">
          <div className="field">
            <label>קבוצת חוץ</label>
            <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="סעודיה" />
          </div>
          <div className="field">
            <label>דגל</label>
            <input value={awayFlag} onChange={(e) => setAwayFlag(e.target.value)} placeholder="🇸🇦" />
          </div>
        </div>
        <div className="field">
          <label>תאריך ושעת בעיטה ראשונה</label>
          <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        </div>
        <div className="row-2">
          <div className="field">
            <label>שלב</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option>שלב הבתים</option>
              <option>שמינית גמר</option>
              <option>רבע גמר</option>
              <option>חצי גמר</option>
              <option>גמר קטן</option>
              <option>גמר</option>
            </select>
          </div>
          <div className="field">
            <label>בית</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="A" />
          </div>
        </div>
        <div className="field">
          <label>יחסים (סה"כ חייב להיות {MATCH_POINT_TOTAL})</label>
          <div className="row-3">
            <input type="number" value={oh} onChange={(e) => setOh(e.target.value)} placeholder={homeName || 'בית'} min="1" max="13" />
            <input type="number" value={od} onChange={(e) => setOd(e.target.value)} placeholder="תיקו" min="1" max="13" />
            <input type="number" value={oa} onChange={(e) => setOa(e.target.value)} placeholder={awayName || 'חוץ'} min="1" max="13" />
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: total === MATCH_POINT_TOTAL ? 'var(--win)' : 'var(--loss)' }}>
            סה"כ: {total} / {MATCH_POINT_TOTAL}
          </div>
        </div>
        <button className="btn" onClick={save}>{isEdit ? 'שמור שינויים' : 'הוסף משחק'}</button>
      </div>
    </div>
  );
}

function SettleMatchModal({ match, onClose }) {
  const [home, setHome] = useState(match.result?.home ?? '');
  const [away, setAway] = useState(match.result?.away ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const settle = async () => {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
      setErr('תוצאה לא תקינה');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      // 1. Save result on match
      await updateDoc(doc(db, 'matches', match.id), {
        result: { home: h, away: a },
        status: 'finished',
        settledAt: serverTimestamp(),
      });

      // 2. Get all users, generate auto-bets for missing, then calculate points
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();
        const betRef = doc(db, 'users', uid, 'bets', match.id);
        const betSnap = await getDoc(betRef);

        let bet;
        if (!betSnap.exists()) {
          // Create auto-bet
          const autoScore = pickRandomRealisticScore();
          bet = { home: autoScore.home, away: autoScore.away, isAuto: true };
          batch.set(betRef, {
            matchId: match.id,
            home: autoScore.home,
            away: autoScore.away,
            isAuto: true,
            createdAt: serverTimestamp(),
          });
        } else {
          bet = betSnap.data();
        }

        // Calculate points if not already settled for this match
        if (!bet.settled) {
          const points = calculateMatchPoints(bet, { home: h, away: a }, match.odds);
          batch.update(betRef, {
            settled: true,
            earnedPoints: points,
          });
          // Update user totals: matchPoints and balance both go up by earned points
          batch.update(doc(db, 'users', uid), {
            matchPoints: (userData.matchPoints || 0) + points,
            balance: (userData.balance || 0) + points,
          });
        }
      }
      await batch.commit();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">קביעת תוצאה</h3>
        <p style={{ marginBottom: 16 }}>
          {match.homeFlag} {match.homeName} vs {match.awayName} {match.awayFlag}
        </p>
        {err && <div className="error-msg">{err}</div>}
        <div className="row-2">
          <div className="field">
            <label>{match.homeName}</label>
            <input type="number" value={home} onChange={(e) => setHome(e.target.value)} min="0" />
          </div>
          <div className="field">
            <label>{match.awayName}</label>
            <input type="number" value={away} onChange={(e) => setAway(e.target.value)} min="0" />
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          ⚠️ פעולה זו תיצור הימור אוטומטי לכל מי שלא הימר, ותחשב את הניקוד לכולם
        </p>
        <button className="btn" onClick={settle} disabled={busy}>
          {busy ? 'מסכם…' : '✓ סגור משחק וחשב נקודות'}
        </button>
      </div>
    </div>
  );
}

// =================== LIVE BETS ===================
function ManageLiveBets() {
  const [liveBets, setLiveBets] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [settling, setSettling] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'liveBets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLiveBets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <>
      <button className="btn btn-gold" onClick={() => setShowAdd(true)} style={{ marginBottom: 16 }}>
        + הוסף הימור לייב
      </button>
      {liveBets.map((lb) => (
        <div key={lb.id} className="admin-card">
          <div className="flex-between" style={{ marginBottom: 6 }}>
            <strong>{lb.title}</strong>
            <span className="multiplier-pill">x{lb.multiplier}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
            נסגר: {formatDateTime(lb.closesAt)}
            {lb.maxStake && <span> · מקס׳ {lb.maxStake}</span>}
            {lb.settled && <span> · {lb.outcome === 'yes' ? '✓ קרה' : '✗ לא קרה'}</span>}
          </div>
          {!lb.settled ? (
            <div className="row-2">
              <button className="btn-sm btn-gold" onClick={() => setSettling(lb)}>הכרע</button>
              <button className="btn-sm btn-danger" onClick={async () => {
                if (confirm('למחוק?')) await deleteDoc(doc(db, 'liveBets', lb.id));
              }}>מחק</button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>הוכרע</div>
          )}
        </div>
      ))}

      {showAdd && <LiveBetFormModal onClose={() => setShowAdd(false)} />}
      {settling && <SettleLiveBetModal liveBet={settling} onClose={() => setSettling(null)} />}
    </>
  );
}

function LiveBetFormModal({ onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [multiplier, setMultiplier] = useState(2);
  const [closesAt, setClosesAt] = useState('');
  const [maxStake, setMaxStake] = useState('');
  const [hasNoOption, setHasNoOption] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    if (!title || !closesAt) { setErr('כותרת וזמן סגירה חובה'); return; }
    if (multiplier < 1.1) { setErr('יחס לפחות 1.1'); return; }
    await addDoc(collection(db, 'liveBets'), {
      title, description,
      multiplier: Number(multiplier),
      closesAt: new Date(closesAt),
      maxStake: maxStake ? Number(maxStake) : null,
      hasNoOption,
      settled: false,
      createdAt: serverTimestamp(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">הימור לייב חדש</h3>
        {err && <div className="error-msg">{err}</div>}
        <div className="field">
          <label>כותרת ההימור</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='לדוגמה: יבקיעו לפחות 4 שערים ב-3 משחקים' />
        </div>
        <div className="field">
          <label>תיאור (אופציונלי)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="2" />
        </div>
        <div className="row-2">
          <div className="field">
            <label>יחס (x)</label>
            <input type="number" step="0.1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} min="1.1" />
          </div>
          <div className="field">
            <label>מקס׳ נקודות (ריק = ללא הגבלה)</label>
            <input type="number" value={maxStake} onChange={(e) => setMaxStake(e.target.value)} min="1" />
          </div>
        </div>
        <div className="field">
          <label>זמן סגירה (שעתיים לפני המשחק הראשון)</label>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={hasNoOption} onChange={(e) => setHasNoOption(e.target.checked)} style={{ width: 'auto' }} />
            אפשרות הימור גם נגד (yes/no)
          </label>
        </div>
        <button className="btn" onClick={save}>הוסף</button>
      </div>
    </div>
  );
}

function SettleLiveBetModal({ liveBet, onClose }) {
  const [outcome, setOutcome] = useState('yes');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const settle = async () => {
    setBusy(true);
    setErr('');
    try {
      // Find all users with entries
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();
        const entryRef = doc(db, 'users', uid, 'liveEntries', liveBet.id);
        const entrySnap = await getDoc(entryRef);
        if (!entrySnap.exists()) continue;

        const entry = entrySnap.data();
        if (entry.settled) continue;

        const won = entry.side === outcome;
        let pointsDelta = 0;
        let balanceDelta = 0;
        if (won) {
          // Stake was already deducted at placement. Return stake + winnings.
          balanceDelta = Math.round(entry.stake * liveBet.multiplier) + entry.stake;
          pointsDelta = Math.round(entry.stake * liveBet.multiplier);
        } else {
          balanceDelta = 0; // Stake already deducted, no return
          pointsDelta = -entry.stake;
        }

        batch.update(entryRef, {
          settled: true,
          won,
          settledPoints: pointsDelta,
        });
        batch.update(doc(db, 'users', uid), {
          balance: (userData.balance || 0) + balanceDelta,
          livePoints: (userData.livePoints || 0) + pointsDelta,
        });
      }

      batch.update(doc(db, 'liveBets', liveBet.id), {
        settled: true,
        outcome,
        settledAt: serverTimestamp(),
      });

      await batch.commit();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">הכרעת הימור לייב</h3>
        <p style={{ marginBottom: 16 }}>"{liveBet.title}"</p>
        {err && <div className="error-msg">{err}</div>}
        <div className="field">
          <label>תוצאה</label>
          <div className="row-2">
            <button className={outcome === 'yes' ? 'btn' : 'btn btn-ghost'} onClick={() => setOutcome('yes')}>קרה ✓</button>
            <button className={outcome === 'no' ? 'btn' : 'btn btn-ghost'} onClick={() => setOutcome('no')}>לא קרה ✗</button>
          </div>
        </div>
        <button className="btn btn-gold" onClick={settle} disabled={busy}>
          {busy ? 'מכריע…' : '✓ הכרע וחלק נקודות'}
        </button>
      </div>
    </div>
  );
}

// =================== DUELS ===================
function ManageDuels() {
  const [duels, setDuels] = useState([]);
  const [settling, setSettling] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'duels'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDuels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <>
      <p className="section-subtitle">דו-קרבים נסגרים אוטומטית — האדמין רק מכריע את המנצח</p>
      {duels.map((duel) => (
        <div key={duel.id} className="admin-card">
          <div className="duel-claim">"{duel.claim}"</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            {duel.challengerName} (פתח) · {duel.opponentName || 'ממתין ליריב'}  · {duel.stake} נק׳ לכל צד
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            סטטוס: {duel.status === 'open' ? '🟢 פתוח' : duel.status === 'accepted' ? '🟡 ממתין להכרעה' : '🔴 הוכרע'}
          </div>
          {duel.status === 'accepted' && (
            <button className="btn-sm btn-gold" onClick={() => setSettling(duel)}>הכרע מנצח</button>
          )}
          {duel.status === 'open' && (
            <button className="btn-sm btn-danger" onClick={async () => {
              if (!confirm('לבטל את הדו-קרב? הנקודות יוחזרו למזמין')) return;
              await runTransaction(db, async (tx) => {
                const userRef = doc(db, 'users', duel.challengerId);
                const u = await tx.get(userRef);
                tx.update(userRef, { balance: (u.data().balance || 0) + duel.stake });
                tx.delete(doc(db, 'duels', duel.id));
              });
            }}>בטל</button>
          )}
        </div>
      ))}
      {settling && <SettleDuelModal duel={settling} onClose={() => setSettling(null)} />}
    </>
  );
}

function SettleDuelModal({ duel, onClose }) {
  const [winnerId, setWinnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const settle = async () => {
    if (!winnerId) { setErr('בחר מנצח'); return; }
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const duelRef = doc(db, 'duels', duel.id);
        const winnerRef = doc(db, 'users', winnerId);
        const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
        const loserRef = doc(db, 'users', loserId);

        const w = await tx.get(winnerRef);
        const l = await tx.get(loserRef);

        // Winner gets back their stake + opponent's stake. duelPoints += stake.
        // Loser loses their stake (already deducted). duelPoints -= stake.
        tx.update(winnerRef, {
          balance: (w.data().balance || 0) + duel.stake * 2,
          duelPoints: (w.data().duelPoints || 0) + duel.stake,
        });
        tx.update(loserRef, {
          duelPoints: (l.data().duelPoints || 0) - duel.stake,
        });
        tx.update(duelRef, {
          status: 'settled',
          winnerId,
          winnerName: w.data().displayName,
          settledAt: serverTimestamp(),
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">הכרעת דו-קרב</h3>
        <p style={{ marginBottom: 16 }}>"{duel.claim}"</p>
        {err && <div className="error-msg">{err}</div>}
        <div className="field">
          <label>מי המנצח?</label>
          <div className="row-2">
            <button
              className={winnerId === duel.challengerId ? 'btn' : 'btn btn-ghost'}
              onClick={() => setWinnerId(duel.challengerId)}
            >{duel.challengerName}</button>
            <button
              className={winnerId === duel.opponentId ? 'btn' : 'btn btn-ghost'}
              onClick={() => setWinnerId(duel.opponentId)}
            >{duel.opponentName}</button>
          </div>
        </div>
        <button className="btn btn-gold" onClick={settle} disabled={busy}>
          {busy ? '…' : '✓ הכרע'}
        </button>
      </div>
    </div>
  );
}

// =================== USERS ===================
function ManageUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const toggleAdmin = async (u) => {
    if (!confirm(u.isAdmin ? `להוריד הרשאות אדמין מ-${u.displayName}?` : `להפוך את ${u.displayName} לאדמין?`)) return;
    await updateDoc(doc(db, 'users', u.uid), { isAdmin: !u.isAdmin });
  };

  return (
    <>
      {users.map((u) => (
        <div key={u.id} className="admin-card">
          <div className="flex-between">
            <div>
              <strong>{u.displayName}</strong>
              {u.isAdmin && <span className="admin-badge" style={{ marginRight: 8 }}>אדמין</span>}
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{u.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                💰 {u.balance || 0} · ⚽ {u.matchPoints || 0} · 🔥 {u.livePoints || 0} · ⚔️ {u.duelPoints || 0}
              </div>
            </div>
            <button className="btn-sm btn-secondary" onClick={() => toggleAdmin(u)}>
              {u.isAdmin ? 'בטל אדמין' : 'הפוך לאדמין'}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
