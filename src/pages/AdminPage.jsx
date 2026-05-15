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
import { TEAMS, TEAMS_LIST, getTeam } from '../utils/teams';
import { WC_2026_MATCHES } from '../utils/schedule';
import MatchPicker from '../components/MatchPicker';
import RelatedMatches from '../components/RelatedMatches';

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
  const [liveUpdating, setLiveUpdating] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const importSchedule = async () => {
    if (!confirm(`ייובאו ${WC_2026_MATCHES.length} משחקים. ההגרלות הקיימות יישארו.\nלהמשיך?`)) return;
    setImporting(true);
    setImportMsg('');
    try {
      const batch = writeBatch(db);
      let count = 0;
      for (const m of WC_2026_MATCHES) {
        const homeInfo = getTeam(m.home);
        const awayInfo = getTeam(m.away);
        const kickoffDate = new Date(m.kickoff + ':00+03:00'); // Israel time
        const ref = doc(collection(db, 'matches'));
        batch.set(ref, {
          homeName: m.home === 'TBD' ? 'יקבע' : homeInfo.he,
          awayName: m.away === 'TBD' ? 'יקבע' : awayInfo.he,
          homeKey: m.home, // english key for lookup later
          awayKey: m.away,
          homeFlag: m.home === 'TBD' ? '⏳' : homeInfo.flag,
          awayFlag: m.away === 'TBD' ? '⏳' : awayInfo.flag,
          kickoffAt: kickoffDate,
          stage: m.stage,
          group: m.home !== 'TBD' ? homeInfo.group : '',
          placeholder: m.placeholder || null,
          odds: { home: 5, draw: 5, away: 5 }, // default - admin must edit
          status: 'scheduled',
          createdAt: serverTimestamp(),
        });
        count++;
      }
      await batch.commit();
      setImportMsg(`✓ ${count} משחקים יובאו בהצלחה!`);
      setTimeout(() => setImportMsg(''), 4000);
    } catch (e) {
      setImportMsg('שגיאה: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  const clearAll = async () => {
    if (!confirm('⚠️ פעולה זו תמחק את כל המשחקים. להמשיך?')) return;
    if (!confirm('בטוח? לא ניתן לשחזר.')) return;
    setImporting(true);
    try {
      const snap = await getDocs(collection(db, 'matches'));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      setImportMsg('✓ כל המשחקים נמחקו');
    } catch (e) {
      setImportMsg('שגיאה: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {matches.length === 0 && (
        <div className="admin-card" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, rgba(255,107,26,0.1) 100%)', borderColor: 'var(--flame)' }}>
          <h4 style={{ marginBottom: 8, fontFamily: 'Frank Ruhl Libre, serif', fontSize: 18 }}>🚀 התחל עם לוח המונדיאל המלא</h4>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
            ייבא בלחיצה אחת את כל {WC_2026_MATCHES.length} המשחקים (שלב הבתים + נוק-אאוט). תוכל לערוך יחסים ולמלא קבוצות נוק-אאוט אחר כך.
          </p>
          <button className="btn btn-gold" onClick={importSchedule} disabled={importing}>
            {importing ? 'מייבא…' : '📥 ייבא לוח מונדיאל מלא'}
          </button>
        </div>
      )}

      <div className="row-2" style={{ marginBottom: 16 }}>
        <button className="btn btn-gold" onClick={() => setShowAdd(true)}>+ הוסף משחק</button>
        {matches.length > 0 && (
          <button className="btn btn-secondary" onClick={importSchedule} disabled={importing}>
            {importing ? '…' : '📥 ייבא שוב'}
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <button className="btn-sm btn-danger" onClick={clearAll} disabled={importing} style={{ marginBottom: 16 }}>
          🗑️ מחק את כל המשחקים
        </button>
      )}

      {importMsg && (
        <div className={importMsg.includes('✓') ? 'success-msg' : 'error-msg'}>{importMsg}</div>
      )}

      {matches.map((m) => (
        <div key={m.id} className="admin-card">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <strong>{m.homeFlag} {m.homeName} vs {m.awayName} {m.awayFlag}</strong>
            <span className={`match-status ${m.status === 'finished' ? 'finished' : m.status === 'live' ? 'open' : 'open'}`}
                  style={m.status === 'live' ? { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' } : {}}>
              {m.status === 'finished' ? 'הסתיים' : m.status === 'live' ? '🔴 LIVE' : 'פעיל'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            {formatDateTime(m.kickoffAt)} · יחס {m.odds?.home}-{m.odds?.draw}-{m.odds?.away}
            {m.result && <span> · תוצאה: {m.result.home}-{m.result.away}</span>}
          </div>
          {m.status !== 'finished' ? (
            <>
              <div className="row-2" style={{ marginBottom: 8 }}>
                <button className="btn-sm btn-secondary" onClick={() => setEditing(m)}>ערוך פרטים</button>
                <button className="btn-sm btn-secondary"
                        onClick={() => setLiveUpdating(m)}
                        style={m.status === 'live' ? { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', borderColor: '#ef4444' } : {}}>
                  {m.status === 'live' ? '🔴 עדכן LIVE' : '▶️ התחל LIVE'}
                </button>
              </div>
              <div className="row-2">
                <button className="btn-sm btn-gold" onClick={() => setSettling(m)}>✓ סיים וחלק נקודות</button>
                <button className="btn-sm btn-danger" onClick={async () => {
                  if (confirm('למחוק את המשחק?')) await deleteDoc(doc(db, 'matches', m.id));
                }}>🗑️</button>
              </div>
            </>
          ) : (
            <div className="row-2">
              <button className="btn-sm btn-secondary" onClick={() => setEditing(m)}>ערוך</button>
              <button className="btn-sm btn-danger" onClick={async () => {
                if (confirm('למחוק את המשחק? הניקוד שניתן כבר לא יבוטל - להתאמת ניקוד השתמש בניהול משתמשים.')) {
                  await deleteDoc(doc(db, 'matches', m.id));
                }
              }}>🗑️ מחק</button>
            </div>
          )}
        </div>
      ))}

      {showAdd && <MatchFormModal onClose={() => setShowAdd(false)} />}
      {editing && <MatchFormModal match={editing} onClose={() => setEditing(null)} />}
      {settling && <SettleMatchModal match={settling} onClose={() => setSettling(null)} />}
      {liveUpdating && <LiveScoreModal match={liveUpdating} onClose={() => setLiveUpdating(null)} />}
    </>
  );
}

function MatchFormModal({ match, onClose }) {
  const isEdit = !!match;

  // Find team english keys from existing match (if editing)
  const findKeyFromHebrew = (he) => {
    if (!he || he === 'יקבע') return '';
    const entry = Object.entries(TEAMS).find(([_, t]) => t.he === he);
    return entry ? entry[0] : '';
  };

  const [homeKey, setHomeKey] = useState(match?.homeKey || findKeyFromHebrew(match?.homeName) || '');
  const [awayKey, setAwayKey] = useState(match?.awayKey || findKeyFromHebrew(match?.awayName) || '');
  const [kickoff, setKickoff] = useState(
    match?.kickoffAt
      ? toLocalInputValue(match.kickoffAt.toMillis ? match.kickoffAt.toMillis() : match.kickoffAt)
      : ''
  );
  const [stage, setStage] = useState(match?.stage || 'שלב הבתים');
  const [group, setGroup] = useState(match?.group || '');
  const [oh, setOh] = useState(match?.odds?.home ?? 5);
  const [od, setOd] = useState(match?.odds?.draw ?? 5);
  const [oa, setOa] = useState(match?.odds?.away ?? 5);
  const [err, setErr] = useState('');

  const homeInfo = homeKey ? getTeam(homeKey) : null;
  const awayInfo = awayKey ? getTeam(awayKey) : null;

  // Auto-fill group when both teams are from same group
  useEffect(() => {
    if (stage === 'שלב הבתים' && homeInfo && awayInfo && homeInfo.group === awayInfo.group) {
      setGroup(homeInfo.group);
    }
  }, [homeKey, awayKey]);

  const total = Number(oh) + Number(od) + Number(oa);

  const save = async () => {
    setErr('');
    if (!homeKey || !awayKey) { setErr('בחר שתי קבוצות'); return; }
    if (homeKey === awayKey) { setErr('לא ניתן לבחור אותה קבוצה פעמיים'); return; }
    if (!kickoff) { setErr('תאריך משחק חסר'); return; }
    if (total !== MATCH_POINT_TOTAL) {
      setErr(`סך היחסים חייב להיות ${MATCH_POINT_TOTAL} (כרגע ${total})`);
      return;
    }
    const data = {
      homeName: homeInfo.he,
      awayName: awayInfo.he,
      homeKey,
      awayKey,
      homeFlag: homeInfo.flag,
      awayFlag: awayInfo.flag,
      kickoffAt: new Date(kickoff),
      stage,
      group,
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
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{isEdit ? 'ערוך משחק' : 'משחק חדש'}</h3>
        {err && <div className="error-msg">{err}</div>}

        <div className="field">
          <label>קבוצת בית {homeInfo && <span style={{ marginRight: 8, fontSize: 22 }}>{homeInfo.flag}</span>}</label>
          <select value={homeKey} onChange={(e) => setHomeKey(e.target.value)}>
            <option value="">-- בחר קבוצה --</option>
            {TEAMS_LIST.map((t) => (
              <option key={t.name} value={t.name}>{t.flag} {t.he} (בית {t.group})</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>קבוצת חוץ {awayInfo && <span style={{ marginRight: 8, fontSize: 22 }}>{awayInfo.flag}</span>}</label>
          <select value={awayKey} onChange={(e) => setAwayKey(e.target.value)}>
            <option value="">-- בחר קבוצה --</option>
            {TEAMS_LIST.map((t) => (
              <option key={t.name} value={t.name}>{t.flag} {t.he} (בית {t.group})</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>תאריך ושעת בעיטה ראשונה (שעון ישראל)</label>
          <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        </div>

        <div className="row-2">
          <div className="field">
            <label>שלב</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option>שלב הבתים</option>
              <option>שמינית גמר (32)</option>
              <option>שמינית גמר (16)</option>
              <option>רבע גמר</option>
              <option>חצי גמר</option>
              <option>גמר קטן</option>
              <option>גמר</option>
            </select>
          </div>
          <div className="field">
            <label>בית (אוטומטי)</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="A" />
          </div>
        </div>

        <div className="field">
          <label>יחסים (סה"כ חייב להיות {MATCH_POINT_TOTAL})</label>
          <div className="row-3">
            <input type="number" value={oh} onChange={(e) => setOh(e.target.value)}
              placeholder={homeInfo?.he || 'בית'} min="1" max="13" />
            <input type="number" value={od} onChange={(e) => setOd(e.target.value)} placeholder="תיקו" min="1" max="13" />
            <input type="number" value={oa} onChange={(e) => setOa(e.target.value)}
              placeholder={awayInfo?.he || 'חוץ'} min="1" max="13" />
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

// Convert timestamp/date to local datetime-local input format (YYYY-MM-DDTHH:mm)
// in user's local timezone (which is Israel for our users)
function toLocalInputValue(input) {
  const d = new Date(input);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

      // 2. Get all users, generate auto-bets for missing, then calculate points.
      // ONLY for approved users - skip pending/disabled.
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();
        // Skip non-approved users (legacy users without status field are treated as approved)
        if (userData.status && userData.status !== 'approved') continue;
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
    <div className="modal-backdrop">
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

// LiveScoreModal: Sets/updates a live score without finalizing the match.
// Used while a match is in progress so players can see projected points.
function LiveScoreModal({ match, onClose }) {
  const [home, setHome] = useState(match.result?.home ?? 0);
  const [away, setAway] = useState(match.result?.away ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const update = async (newHome, newAway) => {
    const h = parseInt(newHome, 10);
    const a = parseInt(newAway, 10);
    if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
      setErr('תוצאה לא תקינה');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await updateDoc(doc(db, 'matches', match.id), {
        result: { home: h, away: a },
        status: 'live',
        liveUpdatedAt: serverTimestamp(),
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const stopLive = async () => {
    if (!confirm('להפסיק את שידור ה-LIVE? התוצאה תישאר אבל המשחק יחזור למצב "פעיל" (כאילו לא התחיל). לא יחושבו נקודות.')) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'matches', match.id), {
        status: 'scheduled',
        result: null,
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const adjustScore = (which, delta) => {
    const newHome = which === 'home' ? Math.max(0, home + delta) : home;
    const newAway = which === 'away' ? Math.max(0, away + delta) : away;
    setHome(newHome);
    setAway(newAway);
    update(newHome, newAway);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">🔴 תוצאה חיה</h3>
        <p style={{ marginBottom: 16, color: 'var(--text-dim)' }}>
          {match.homeFlag} {match.homeName} vs {match.awayName} {match.awayFlag}
        </p>
        {err && <div className="error-msg">{err}</div>}

        {/* Quick score buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{match.homeFlag} {match.homeName}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <button className="btn-sm btn-secondary" onClick={() => adjustScore('home', -1)} disabled={busy || home <= 0} style={{ width: 40, fontSize: 20, padding: 8 }}>−</button>
              <div style={{ fontFamily: 'Frank Ruhl Libre, serif', fontSize: 48, fontWeight: 900, color: 'var(--gold)', minWidth: 60 }}>{home}</div>
              <button className="btn-sm btn-gold" onClick={() => adjustScore('home', 1)} disabled={busy} style={{ width: 40, fontSize: 20, padding: 8 }}>+</button>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{match.awayName} {match.awayFlag}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <button className="btn-sm btn-secondary" onClick={() => adjustScore('away', -1)} disabled={busy || away <= 0} style={{ width: 40, fontSize: 20, padding: 8 }}>−</button>
              <div style={{ fontFamily: 'Frank Ruhl Libre, serif', fontSize: 48, fontWeight: 900, color: 'var(--gold)', minWidth: 60 }}>{away}</div>
              <button className="btn-sm btn-gold" onClick={() => adjustScore('away', 1)} disabled={busy} style={{ width: 40, fontSize: 20, padding: 8 }}>+</button>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: 12,
          marginBottom: 12,
          fontSize: 13,
          color: '#fca5a5',
        }}>
          🔴 משחק במצב LIVE. כל השחקנים רואים את הצפי שלהם בלשונית "🔴 LIVE".
          לא יחושבו נקודות עד לחיצה על "סיים וחלק נקודות" במסך הקודם.
        </div>

        <div className="row-2">
          <button className="btn btn-secondary" onClick={stopLive} disabled={busy}>
            הפסק LIVE
          </button>
          <button className="btn btn-gold" onClick={onClose}>
            ✓ סיים עריכה
          </button>
        </div>
      </div>
    </div>
  );
}

// =================== LIVE BETS ===================
function ManageLiveBets() {
  const [liveBets, setLiveBets] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [settling, setSettling] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'liveBets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLiveBets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Cancel a live bet: refund all stakes back to users, mark as cancelled
  const cancelLiveBet = async (lb) => {
    if (!confirm(`לבטל את ההימור "${lb.title}"?\nכל הנקודות שהושקעו יוחזרו לשחקנים.`)) return;
    setBusy(lb.id);
    setMsg('');
    try {
      // Get all entries for this live bet across all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let refundedCount = 0;
      let refundedTotal = 0;

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const entryRef = doc(db, 'users', uid, 'liveEntries', lb.id);
        const entrySnap = await getDoc(entryRef);
        if (!entrySnap.exists()) continue;
        const entry = entrySnap.data();
        if (entry.settled) continue; // skip already settled (shouldn't happen but safe)

        const stake = entry.stake || 0;
        // Refund stake back to balance
        batch.update(doc(db, 'users', uid), {
          balance: (userDoc.data().balance || 0) + stake,
        });
        // Delete the entry (or mark cancelled)
        batch.delete(entryRef);
        refundedCount++;
        refundedTotal += stake;
      }

      // Mark live bet as cancelled
      batch.update(doc(db, 'liveBets', lb.id), {
        cancelled: true,
        cancelledAt: serverTimestamp(),
        settled: true, // so it won't be shown as active
        outcome: 'cancelled',
      });

      await batch.commit();
      setMsg(`✓ בוטל. הוחזרו ${refundedTotal} נק׳ ל-${refundedCount} שחקנים.`);
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg('שגיאה: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  // Hard delete: only if nobody has bet on it
  const hardDeleteLiveBet = async (lb) => {
    // Check if anyone has entries
    const usersSnap = await getDocs(collection(db, 'users'));
    let hasEntries = false;
    for (const userDoc of usersSnap.docs) {
      const entrySnap = await getDoc(doc(db, 'users', userDoc.id, 'liveEntries', lb.id));
      if (entrySnap.exists()) { hasEntries = true; break; }
    }
    if (hasEntries) {
      alert('יש שחקנים שכבר הימרו על ההימור הזה.\nהשתמש ב"בטל" כדי להחזיר להם את הנקודות.');
      return;
    }
    if (!confirm('למחוק את ההימור (אין שום הימורים עליו)?')) return;
    await deleteDoc(doc(db, 'liveBets', lb.id));
  };

  return (
    <>
      <button className="btn btn-gold" onClick={() => setShowAdd(true)} style={{ marginBottom: 16 }}>
        + הוסף הימור לייב
      </button>

      {msg && (
        <div className={msg.includes('✓') ? 'success-msg' : 'error-msg'}>{msg}</div>
      )}

      {liveBets.map((lb) => (
        <div key={lb.id} className="admin-card">
          <div className="flex-between" style={{ marginBottom: 6 }}>
            <strong>{lb.title}</strong>
            <span className="multiplier-pill">x{lb.multiplier}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
            נסגר: {formatDateTime(lb.closesAt)}
            {lb.maxStake && <span> · מקס׳ {lb.maxStake}</span>}
            {lb.cancelled && <span style={{ color: 'var(--loss)' }}> · ❌ בוטל</span>}
            {lb.settled && !lb.cancelled && <span> · {lb.outcome === 'yes' ? '✓ קרה' : '✗ לא קרה'}</span>}
          </div>
          {lb.matchIds && lb.matchIds.length > 0 && (
            <RelatedMatches matchIds={lb.matchIds} />
          )}
          {lb.cancelled ? (
            <div className="row-2">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>בוטל - נקודות הוחזרו</div>
              <button className="btn-sm btn-danger" onClick={() => hardDeleteLiveBet(lb)} disabled={busy === lb.id}>
                🗑️ הסר מהרשימה
              </button>
            </div>
          ) : !lb.settled ? (
            <div className="row-3">
              <button className="btn-sm btn-gold" onClick={() => setSettling(lb)} disabled={busy === lb.id}>הכרע</button>
              <button className="btn-sm btn-secondary" onClick={() => cancelLiveBet(lb)} disabled={busy === lb.id}>
                {busy === lb.id ? '…' : '❌ בטל'}
              </button>
              <button className="btn-sm btn-danger" onClick={() => hardDeleteLiveBet(lb)} disabled={busy === lb.id}>
                🗑️
              </button>
            </div>
          ) : (
            <div className="row-2">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>הוכרע</div>
              <button className="btn-sm btn-danger" onClick={() => hardDeleteLiveBet(lb)} disabled={busy === lb.id}>
                🗑️ הסר
              </button>
            </div>
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
  const [closesAtAuto, setClosesAtAuto] = useState(true); // auto-calc by default
  const [maxStake, setMaxStake] = useState('');
  const [hasNoOption, setHasNoOption] = useState(false);
  const [matchIds, setMatchIds] = useState([]);
  const [err, setErr] = useState('');

  // Auto-update closesAt when matches are picked (2h before earliest kickoff)
  const handleMatchesChange = (ids, earliestMillis) => {
    setMatchIds(ids);
    if (closesAtAuto && earliestMillis) {
      const closeMillis = earliestMillis - 2 * 60 * 60 * 1000;
      const d = new Date(closeMillis);
      const pad = (n) => String(n).padStart(2, '0');
      setClosesAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
  };

  const save = async () => {
    setErr('');
    if (!title) { setErr('כותרת חובה'); return; }
    if (!closesAt) { setErr('זמן סגירה חובה'); return; }
    if (multiplier < 1.1) { setErr('יחס לפחות 1.1'); return; }
    await addDoc(collection(db, 'liveBets'), {
      title, description,
      multiplier: Number(multiplier),
      closesAt: new Date(closesAt),
      maxStake: maxStake ? Number(maxStake) : null,
      hasNoOption,
      matchIds, // array of match IDs this live bet relates to
      settled: false,
      createdAt: serverTimestamp(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
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

        <div className="field">
          <label>משחקים רלוונטיים</label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            בחר טווח תאריכים או בחירה ידנית. זמן הסגירה יחושב אוטומטית - שעתיים לפני המשחק הראשון.
          </div>
          <MatchPicker selectedIds={matchIds} onChange={handleMatchesChange} />
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={closesAtAuto} onChange={(e) => setClosesAtAuto(e.target.checked)} style={{ width: 'auto' }} />
            חשב אוטומטית (שעתיים לפני המשחק הראשון)
          </label>
          <label>זמן סגירה</label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => { setClosesAt(e.target.value); setClosesAtAuto(false); }}
          />
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
    <div className="modal-backdrop">
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
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'duels'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDuels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Cancel open duel - refund challenger only (no opponent yet)
  const cancelOpen = async (duel) => {
    if (!confirm('לבטל את הדו-קרב? הנקודות יוחזרו למזמין')) return;
    setBusy(duel.id);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', duel.challengerId);
        const u = await tx.get(userRef);
        tx.update(userRef, { balance: (u.data().balance || 0) + duel.stake });
        tx.delete(doc(db, 'duels', duel.id));
      });
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  // Cancel accepted duel - refund both players
  const cancelAccepted = async (duel) => {
    if (!confirm(`לבטל את הדו-קרב המתקיים?\n${duel.stake} נק׳ יוחזרו ל${duel.challengerName} ול-${duel.opponentName}.`)) return;
    setBusy(duel.id);
    try {
      await runTransaction(db, async (tx) => {
        const challengerRef = doc(db, 'users', duel.challengerId);
        const opponentRef = doc(db, 'users', duel.opponentId);
        const c = await tx.get(challengerRef);
        const o = await tx.get(opponentRef);
        tx.update(challengerRef, { balance: (c.data().balance || 0) + duel.stake });
        tx.update(opponentRef, { balance: (o.data().balance || 0) + duel.stake });
        tx.delete(doc(db, 'duels', duel.id));
      });
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  // Delete settled duel from list (no refunds - already done)
  const deleteSettled = async (duel) => {
    if (!confirm('להסיר את הדו-קרב מהרשימה? (הנקודות לא ישתנו)')) return;
    await deleteDoc(doc(db, 'duels', duel.id));
  };

  return (
    <>
      <p className="section-subtitle">דו-קרבים נסגרים אוטומטית — האדמין רק מכריע את המנצח</p>
      {duels.map((duel) => (
        <div key={duel.id} className="admin-card">
          <div className="duel-claim">"{duel.claim}"</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            {duel.challengerName} (פתח) · {duel.opponentName || 'ממתין ליריב'}  · {duel.stake} נק׳ לכל צד
          </div>
          {duel.matchIds && duel.matchIds.length > 0 && (
            <RelatedMatches matchIds={duel.matchIds} />
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            סטטוס: {duel.status === 'open' ? '🟢 פתוח' : duel.status === 'accepted' ? '🟡 ממתין להכרעה' : '🔴 הוכרע'}
          </div>
          {duel.status === 'open' && (
            <button className="btn-sm btn-danger" onClick={() => cancelOpen(duel)} disabled={busy === duel.id}>
              {busy === duel.id ? '…' : '❌ בטל'}
            </button>
          )}
          {duel.status === 'accepted' && (
            <div className="row-2">
              <button className="btn-sm btn-gold" onClick={() => setSettling(duel)} disabled={busy === duel.id}>הכרע מנצח</button>
              <button className="btn-sm btn-danger" onClick={() => cancelAccepted(duel)} disabled={busy === duel.id}>
                {busy === duel.id ? '…' : '❌ בטל והחזר נק׳'}
              </button>
            </div>
          )}
          {duel.status === 'settled' && (
            <button className="btn-sm btn-secondary" onClick={() => deleteSettled(duel)}>
              🗑️ הסר מהרשימה
            </button>
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
    <div className="modal-backdrop">
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
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [adjusting, setAdjusting] = useState(null);
  const [viewingLog, setViewingLog] = useState(null);
  const [filter, setFilter] = useState('all'); // all | pending | approved | disabled

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

  const setStatus = async (u, newStatus) => {
    const messages = {
      approved: `לאשר את ${u.displayName} להשתתפות בתחרות?`,
      disabled: `להשבית את הגישה של ${u.displayName}? הוא לא יוכל להמשיך להמר עד שתפעיל מחדש.`,
      pending: `להחזיר את ${u.displayName} למצב 'ממתין לאישור'?`,
    };
    if (!confirm(messages[newStatus])) return;
    await updateDoc(doc(db, 'users', u.uid), { status: newStatus });
  };

  // Treat missing status (existing pre-feature users) as 'approved' so they don't get locked out
  const effectiveStatus = (u) => u.status || 'approved';

  const filteredUsers = users.filter((u) => {
    if (filter === 'all') return true;
    return effectiveStatus(u) === filter;
  });

  const pendingCount = users.filter((u) => effectiveStatus(u) === 'pending').length;

  return (
    <>
      {pendingCount > 0 && (
        <div className="admin-card" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, rgba(255,107,26,0.15) 100%)', borderColor: 'var(--flame)' }}>
          <strong>⏳ {pendingCount} משתמשים ממתינים לאישור</strong>
          <button className="btn-sm btn-gold" style={{ marginTop: 8 }} onClick={() => setFilter('pending')}>
            הצג ממתינים
          </button>
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          הכל ({users.length})
        </button>
        <button className={`tab-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          ממתינים ({pendingCount})
        </button>
        <button className={`tab-btn ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>
          מאושרים
        </button>
        <button className={`tab-btn ${filter === 'disabled' ? 'active' : ''}`} onClick={() => setFilter('disabled')}>
          מושבתים
        </button>
      </div>

      <p className="section-subtitle">
        משתמש חדש שנרשם יופיע ב"ממתינים" - אשר אותו כדי שיוכל להשתתף בתחרות
      </p>

      {filteredUsers.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">👥</div>
          <p>אין משתמשים בקטגוריה הזו</p>
        </div>
      ) : filteredUsers.map((u) => {
        const status = effectiveStatus(u);
        const statusInfo = {
          pending: { label: '⏳ ממתין', color: 'var(--gold)' },
          approved: { label: '✓ מאושר', color: 'var(--win)' },
          disabled: { label: '🚫 מושבת', color: 'var(--loss)' },
        }[status];

        return (
          <div key={u.id} className="admin-card">
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <div>
                <strong>{u.displayName}</strong>
                {u.isAdmin && <span className="admin-badge" style={{ marginRight: 8 }}>אדמין</span>}
                <span style={{ fontSize: 11, fontWeight: 700, marginRight: 8, color: statusInfo.color }}>
                  {statusInfo.label}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{u.email}</div>
                {status === 'approved' && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    💰 {u.balance || 0} · ⚽ {u.matchPoints || 0} · 🔥 {u.livePoints || 0} · ⚔️ {u.duelPoints || 0}
                  </div>
                )}
              </div>
            </div>

            {/* Status control buttons */}
            {status === 'pending' && (
              <div className="row-2" style={{ marginBottom: 8 }}>
                <button className="btn-sm btn-gold" onClick={() => setStatus(u, 'approved')}>
                  ✓ אשר משתמש
                </button>
                <button className="btn-sm btn-danger" onClick={() => setStatus(u, 'disabled')}>
                  🚫 דחה
                </button>
              </div>
            )}
            {status === 'approved' && !u.isAdmin && (
              <button className="btn-sm btn-secondary" style={{ marginBottom: 8 }} onClick={() => setStatus(u, 'disabled')}>
                🚫 השבת גישה
              </button>
            )}
            {status === 'disabled' && (
              <button className="btn-sm btn-gold" style={{ marginBottom: 8 }} onClick={() => setStatus(u, 'approved')}>
                ✓ הפעל מחדש
              </button>
            )}

            {/* Admin actions only for approved users */}
            {status === 'approved' && (
              <>
                <div className="row-2" style={{ marginBottom: 8 }}>
                  <button className="btn-sm btn-secondary" onClick={() => toggleAdmin(u)}>
                    {u.isAdmin ? 'בטל אדמין' : 'הפוך לאדמין'}
                  </button>
                </div>
                <div className="row-2">
                  <button className="btn-sm btn-gold" onClick={() => setAdjusting(u)}>
                    ⚙️ התאם נקודות
                  </button>
                  <button className="btn-sm btn-ghost" onClick={() => setViewingLog(u)}>
                    📜 היסטוריה
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {adjusting && (
        <AdjustPointsModal
          user={adjusting}
          adminProfile={adminProfile}
          onClose={() => setAdjusting(null)}
        />
      )}
      {viewingLog && (
        <AdjustmentLogModal user={viewingLog} onClose={() => setViewingLog(null)} />
      )}
    </>
  );
}

function AdjustPointsModal({ user, adminProfile, onClose }) {
  const [field, setField] = useState('balance');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const fields = [
    { key: 'balance', label: '💰 מאזן זמין', current: user.balance || 0 },
    { key: 'matchPoints', label: '⚽ נקודות משחקים', current: user.matchPoints || 0 },
    { key: 'livePoints', label: '🔥 נקודות לייב', current: user.livePoints || 0 },
    { key: 'duelPoints', label: '⚔️ נקודות דו-קרב', current: user.duelPoints || 0 },
  ];

  const currentField = fields.find((f) => f.key === field);
  const deltaNum = parseInt(delta, 10);
  const newValue = !Number.isNaN(deltaNum) ? currentField.current + deltaNum : currentField.current;

  const submit = async () => {
    setErr('');
    if (Number.isNaN(deltaNum) || deltaNum === 0) {
      setErr('הכנס סכום שינוי (חיובי או שלילי)');
      return;
    }
    if (!reason.trim()) {
      setErr('סיבה חובה למעקב');
      return;
    }
    if (field === 'balance' && newValue < 0) {
      setErr('המאזן לא יכול להיות שלילי');
      return;
    }

    setBusy(true);
    try {
      // 1. Update user value
      await updateDoc(doc(db, 'users', user.uid), {
        [field]: newValue,
      });
      // 2. Log the adjustment
      await addDoc(collection(db, 'users', user.uid, 'adjustments'), {
        field,
        delta: deltaNum,
        previousValue: currentField.current,
        newValue,
        reason: reason.trim(),
        adminId: adminProfile?.uid,
        adminName: adminProfile?.displayName,
        createdAt: serverTimestamp(),
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
        <h3 className="modal-title">⚙️ התאם נקודות</h3>
        <p style={{ marginBottom: 16, color: 'var(--text-dim)' }}>
          משתמש: <strong>{user.displayName}</strong>
        </p>

        {err && <div className="error-msg">{err}</div>}

        <div className="field">
          <label>איזה ערך לשנות?</label>
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>{f.label} (כרגע: {f.current})</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>שינוי (חיובי = הוסף, שלילי = הורד)</label>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="לדוגמה: 10 או -5"
          />
          {!Number.isNaN(deltaNum) && deltaNum !== 0 && (
            <div style={{ fontSize: 13, marginTop: 8, padding: 8, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              {currentField.current} {deltaNum >= 0 ? '+' : ''}{deltaNum} = <strong style={{ color: 'var(--gold)' }}>{newValue}</strong>
            </div>
          )}
        </div>

        <div className="field">
          <label>סיבה (חובה - לתיעוד)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="לדוגמה: 'תיקון לאחר ביטול הימור', 'בונוס יום הולדת'"
            rows="2"
          />
        </div>

        <button className="btn btn-gold" onClick={submit} disabled={busy}>
          {busy ? 'משנה…' : '✓ אישור התאמה'}
        </button>
      </div>
    </div>
  );
}

function AdjustmentLogModal({ user, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'adjustments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  const fieldLabel = (f) => ({
    balance: '💰 מאזן',
    matchPoints: '⚽ משחקים',
    livePoints: '🔥 לייב',
    duelPoints: '⚔️ דו-קרב',
  }[f] || f);

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">📜 היסטוריית התאמות</h3>
        <p style={{ marginBottom: 16, color: 'var(--text-dim)' }}>
          משתמש: <strong>{user.displayName}</strong>
        </p>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <p>אין עדיין התאמות ידניות</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{
              padding: 10,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 8,
              fontSize: 13,
            }}>
              <div className="flex-between" style={{ marginBottom: 4 }}>
                <strong>{fieldLabel(log.field)}</strong>
                <span className={`points-badge ${log.delta >= 0 ? 'win' : 'loss'}`}>
                  {log.delta >= 0 ? '+' : ''}{log.delta}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {log.previousValue} → {log.newValue} · {formatDateTime(log.createdAt)} · ע"י {log.adminName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <strong>סיבה:</strong> {log.reason}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
