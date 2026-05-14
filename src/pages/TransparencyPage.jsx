import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { isMatchOpen, calculateMatchPoints, formatDateTime } from '../utils/scoring';
import { MATCH_LOCK_HOURS_BEFORE } from '../utils/constants';
import { TEAMS_LIST } from '../utils/teams';

const STAGE_FILTERS = [
  { value: '', label: 'כל השלבים' },
  { value: 'שלב הבתים', label: 'שלב הבתים' },
  { value: 'שמינית גמר (32)', label: 'שמינית 32' },
  { value: 'שמינית גמר (16)', label: 'שמינית 16' },
  { value: 'רבע גמר', label: 'רבע גמר' },
  { value: 'חצי גמר', label: 'חצי גמר' },
  { value: 'גמר קטן', label: 'גמר קטן' },
  { value: 'גמר', label: 'גמר' },
];

export default function TransparencyPage() {
  const [subTab, setSubTab] = useState('matches');

  return (
    <div className="container">
      <h2 className="section-title">🔍 תזוזה</h2>
      <p className="section-subtitle">שקיפות מלאה - מי הימר על מה וכמה נקודות הרוויח</p>

      <div className="tabs">
        <button className={`tab-btn ${subTab === 'matches' ? 'active' : ''}`} onClick={() => setSubTab('matches')}>⚽ משחקים</button>
        <button className={`tab-btn ${subTab === 'live' ? 'active' : ''}`} onClick={() => setSubTab('live')}>🔥 לייב</button>
        <button className={`tab-btn ${subTab === 'duels' ? 'active' : ''}`} onClick={() => setSubTab('duels')}>⚔️ דו-קרבים</button>
      </div>

      {subTab === 'matches' && <MatchesTransparency />}
      {subTab === 'live' && <LiveTransparency />}
      {subTab === 'duels' && <DuelsTransparency />}
    </div>
  );
}

// ========== MATCHES TRANSPARENCY ==========
function MatchesTransparency() {
  const [matches, setMatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [allBets, setAllBets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('locked'); // locked = visible matches (default)

  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [showDetailMode, setShowDetailMode] = useState(false);

  useEffect(() => {
    const q1 = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    const u1 = onSnapshot(q1, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    // Listen to ALL bets across all users using collectionGroup
    const u3 = onSnapshot(collectionGroup(db, 'bets'), (snap) => {
      setAllBets(snap.docs.map((d) => ({
        id: d.id,
        userId: d.ref.parent.parent.id,
        ...d.data(),
      })));
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  // Apply filters
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Date filter
      if (dateFrom || dateTo) {
        const d = m.kickoffAt?.toDate ? m.kickoffAt.toDate() : new Date(m.kickoffAt);
        const pad = (n) => String(n).padStart(2, '0');
        const ms = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (dateFrom && ms < dateFrom) return false;
        if (dateTo && ms > dateTo) return false;
      }
      // Team filter
      if (teamFilter) {
        if (m.homeKey !== teamFilter && m.awayKey !== teamFilter) return false;
      }
      // Stage filter
      if (stageFilter && m.stage !== stageFilter) return false;
      // Status: only show locked/finished matches (where bets are visible)
      if (statusFilter === 'locked') {
        if (isMatchOpen(m, MATCH_LOCK_HOURS_BEFORE)) return false;
      } else if (statusFilter === 'finished') {
        if (m.status !== 'finished') return false;
      }
      return true;
    });
  }, [matches, dateFrom, dateTo, teamFilter, stageFilter, statusFilter]);

  // Map of userId -> name for quick lookup
  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => { m[u.uid] = u.displayName; });
    return m;
  }, [users]);

  // Helper: get all bets for a specific match
  const getBetsForMatch = (matchId) => {
    return allBets.filter((b) => b.matchId === matchId);
  };

  // Multi-match aggregation
  const selectedMatches = useMemo(() => {
    return filteredMatches.filter((m) => selectedMatchIds.includes(m.id));
  }, [filteredMatches, selectedMatchIds]);

  const toggleMatchSelection = (id) => {
    setSelectedMatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="admin-card">
        <h4 style={{ marginBottom: 12, fontFamily: 'Frank Ruhl Libre, serif', fontSize: 16 }}>🔍 סינון</h4>

        <div className="row-2" style={{ marginBottom: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>מתאריך</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>עד תאריך</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="row-2" style={{ marginBottom: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>קבוצה</label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">כל הקבוצות</option>
              {TEAMS_LIST.map((t) => (
                <option key={t.name} value={t.name}>{t.flag} {t.he}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>שלב</label>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              {STAGE_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>סטטוס</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="locked">כל המשחקים הסגורים/הסתיימו (הימורים גלויים)</option>
            <option value="finished">רק משחקים שהסתיימו</option>
            <option value="all">הכל (כולל פתוחים - הימורים מוסתרים)</option>
          </select>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
          📊 מציג {filteredMatches.length} משחקים
        </div>

        <div className="row-2" style={{ marginTop: 10 }}>
          <button
            className={showDetailMode ? 'btn' : 'btn btn-secondary'}
            onClick={() => setShowDetailMode(!showDetailMode)}
            style={{ fontSize: 13 }}
          >
            {showDetailMode ? '✓ מצב בחירה מרובה' : '📋 בחירה מרובה'}
          </button>
          {selectedMatchIds.length > 0 && (
            <button className="btn btn-gold" onClick={() => setSelectedMatchIds([])} style={{ fontSize: 13 }}>
              נקה ({selectedMatchIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Multi-match aggregation summary */}
      {selectedMatches.length > 1 && (
        <MultiMatchSummary
          matches={selectedMatches}
          allBets={allBets}
          userMap={userMap}
        />
      )}

      {filteredMatches.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <p>אין משחקים שמתאימים לסינון</p>
        </div>
      ) : (
        filteredMatches.map((m) => {
          const matchBets = getBetsForMatch(m.id);
          const open = isMatchOpen(m, MATCH_LOCK_HOURS_BEFORE);
          const isHidden = open;

          return (
            <MatchTransparencyCard
              key={m.id}
              match={m}
              bets={matchBets}
              userMap={userMap}
              isHidden={isHidden}
              showDetailMode={showDetailMode}
              isSelected={selectedMatchIds.includes(m.id)}
              onToggleSelect={() => toggleMatchSelection(m.id)}
            />
          );
        })
      )}
    </>
  );
}

function MatchTransparencyCard({ match, bets, userMap, isHidden, showDetailMode, isSelected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);

  // Sort bets: those with points (desc), then by user name
  const sortedBets = useMemo(() => {
    return [...bets].sort((a, b) => {
      const pa = a.earnedPoints || 0;
      const pb = b.earnedPoints || 0;
      if (pa !== pb) return pb - pa;
      const na = userMap[a.userId] || '';
      const nb = userMap[b.userId] || '';
      return na.localeCompare(nb, 'he');
    });
  }, [bets, userMap]);

  return (
    <div className="match-card fade-up" style={isSelected ? { borderColor: 'var(--gold)', borderWidth: 2 } : {}}>
      <div className="match-header">
        <span className="stage">{match.stage}{match.group && ` · בית ${match.group}`}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {formatDateTime(match.kickoffAt)}
        </span>
      </div>
      <div className="match-body">
        <div
          onClick={() => showDetailMode ? onToggleSelect() : setExpanded(!expanded)}
          style={{ cursor: 'pointer' }}
        >
          <div className="match-teams" style={{ marginBottom: 8 }}>
            <div className="team">
              <div className="team-flag">{match.homeFlag}</div>
              <div className="team-name">{match.homeName}</div>
            </div>
            <div className="vs">
              {match.status === 'finished' && match.result
                ? `${match.result.home} : ${match.result.away}`
                : 'נגד'}
            </div>
            <div className="team">
              <div className="team-flag">{match.awayFlag}</div>
              <div className="team-name">{match.awayName}</div>
            </div>
          </div>

          <div className="flex-between" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            <span>📊 {bets.length} הימורים</span>
            {isHidden ? (
              <span className="match-status open">🔒 הימורים מוסתרים</span>
            ) : showDetailMode ? (
              <span style={{ color: isSelected ? 'var(--gold)' : 'var(--text-muted)' }}>
                {isSelected ? '✓ נבחר' : 'הקש לבחירה'}
              </span>
            ) : (
              <span style={{ color: 'var(--gold)' }}>{expanded ? '▲ סגור' : '▼ הצג הימורים'}</span>
            )}
          </div>
        </div>

        {expanded && !isHidden && !showDetailMode && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            {sortedBets.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 10 }}>
                אין הימורים על המשחק
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  כל ההימורים ({sortedBets.length})
                </div>
                {sortedBets.map((bet) => {
                  const points = bet.earnedPoints != null
                    ? bet.earnedPoints
                    : (match.status === 'finished' && match.result)
                      ? calculateMatchPoints(bet, match.result, match.odds)
                      : null;
                  return (
                    <div
                      key={bet.id}
                      className="flex-between"
                      style={{
                        padding: '8px 10px',
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: 6,
                        fontSize: 13,
                      }}
                    >
                      <span>
                        <strong>{userMap[bet.userId] || 'משתמש'}</strong>
                        {bet.isAuto && <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 11 }}>(אוטו׳)</span>}
                      </span>
                      <span style={{ fontFamily: 'Frank Ruhl Libre, serif', fontWeight: 700, color: 'var(--text)' }}>
                        {bet.home}-{bet.away}
                      </span>
                      {points != null && (
                        <span className={`points-badge ${points > 0 ? 'win' : 'loss'}`}>
                          {points > 0 ? `+${points}` : '0'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MultiMatchSummary({ matches, allBets, userMap }) {
  // Aggregate points per user across selected matches
  const aggregated = useMemo(() => {
    const byUser = {};
    matches.forEach((m) => {
      const matchBets = allBets.filter((b) => b.matchId === m.id);
      matchBets.forEach((bet) => {
        if (!byUser[bet.userId]) {
          byUser[bet.userId] = { uid: bet.userId, name: userMap[bet.userId] || 'משתמש', points: 0, count: 0, hits: 0 };
        }
        const pts = bet.earnedPoints || 0;
        byUser[bet.userId].points += pts;
        byUser[bet.userId].count += 1;
        if (pts > 0) byUser[bet.userId].hits += 1;
      });
    });
    return Object.values(byUser).sort((a, b) => b.points - a.points);
  }, [matches, allBets, userMap]);

  return (
    <div className="admin-card" style={{ borderColor: 'var(--gold)' }}>
      <h4 style={{ marginBottom: 8, fontFamily: 'Frank Ruhl Libre, serif', fontSize: 18 }}>
        📊 סיכום ל-{matches.length} משחקים נבחרים
      </h4>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
        מציג סיכום נקודות שכל שחקן הרוויח מהמשחקים שבחרת
      </div>
      {aggregated.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 14 }}>אין נתונים</div>
      ) : (
        aggregated.map((u, i) => (
          <div key={u.uid} className="flex-between" style={{
            padding: '8px 10px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 6,
            fontSize: 13,
          }}>
            <span><strong>#{i + 1} {u.name}</strong></span>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              {u.hits}/{u.count} פגיעות
            </span>
            <span className="points-badge win">
              {u.points} נק׳
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ========== LIVE BETS TRANSPARENCY ==========
function LiveTransparency() {
  const [liveBets, setLiveBets] = useState([]);
  const [users, setUsers] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('settled'); // settled | closed | all

  useEffect(() => {
    const q = query(collection(db, 'liveBets'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q, (snap) => {
      setLiveBets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u3 = onSnapshot(collectionGroup(db, 'liveEntries'), (snap) => {
      setAllEntries(snap.docs.map((d) => ({
        id: d.id,
        userId: d.ref.parent.parent.id,
        ...d.data(),
      })));
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => { m[u.uid] = u.displayName; });
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    return liveBets.filter((lb) => {
      const closesMs = lb.closesAt?.toMillis ? lb.closesAt.toMillis() : new Date(lb.closesAt).getTime();
      const isClosed = Date.now() > closesMs;
      if (filter === 'settled') return lb.settled;
      if (filter === 'closed') return isClosed; // include settled
      return true;
    });
  }, [liveBets, filter]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab-btn ${filter === 'settled' ? 'active' : ''}`} onClick={() => setFilter('settled')}>שהוכרעו</button>
        <button className={`tab-btn ${filter === 'closed' ? 'active' : ''}`} onClick={() => setFilter('closed')}>שנסגרו</button>
        <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>הכל</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <p>אין הימורים בקטגוריה הזו</p>
        </div>
      ) : (
        filtered.map((lb) => {
          const entries = allEntries.filter((e) => e.liveBetId === lb.id);
          return <LiveBetTransparencyCard key={lb.id} liveBet={lb} entries={entries} userMap={userMap} />;
        })
      )}
    </>
  );
}

function LiveBetTransparencyCard({ liveBet, entries, userMap }) {
  const [expanded, setExpanded] = useState(false);

  const closesMs = liveBet.closesAt?.toMillis ? liveBet.closesAt.toMillis() : new Date(liveBet.closesAt).getTime();
  const isClosed = Date.now() > closesMs;
  const isHidden = !isClosed && !liveBet.settled;

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const pa = a.settledPoints != null ? a.settledPoints : -a.stake;
      const pb = b.settledPoints != null ? b.settledPoints : -b.stake;
      return pb - pa;
    });
  }, [entries]);

  const totalStaked = entries.reduce((s, e) => s + (e.stake || 0), 0);

  return (
    <div className="livebet-card fade-up">
      <div className="livebet-title">{liveBet.title}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
        <span className="multiplier-pill">x{liveBet.multiplier}</span>
        <span>📊 {entries.length} השתתפו</span>
        <span>💰 {totalStaked} נק׳ סה"כ</span>
        {liveBet.settled && (
          <span style={{ color: liveBet.outcome === 'yes' ? 'var(--win)' : 'var(--loss)' }}>
            {liveBet.outcome === 'yes' ? '✓ קרה' : '✗ לא קרה'}
          </span>
        )}
      </div>

      <button
        className="btn-sm btn-secondary"
        style={{ width: '100%', fontSize: 13 }}
        onClick={() => setExpanded(!expanded)}
        disabled={isHidden}
      >
        {isHidden ? '🔒 הימורים מוסתרים עד שיסגר' : expanded ? '▲ סגור' : '▼ הצג כל ההימורים'}
      </button>

      {expanded && !isHidden && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {sortedEntries.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 10 }}>
              אף אחד לא הימר
            </div>
          ) : (
            sortedEntries.map((entry) => (
              <div key={entry.id} className="flex-between" style={{
                padding: '8px 10px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 6,
                fontSize: 13,
              }}>
                <span><strong>{userMap[entry.userId] || 'משתמש'}</strong></span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {entry.stake} נק׳ על {entry.side === 'yes' ? 'יקרה' : 'לא יקרה'}
                </span>
                {entry.settledPoints != null && (
                  <span className={`points-badge ${entry.settledPoints > 0 ? 'win' : 'loss'}`}>
                    {entry.settledPoints > 0 ? `+${entry.settledPoints}` : entry.settledPoints}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ========== DUELS TRANSPARENCY ==========
function DuelsTransparency() {
  const [duels, setDuels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('settled');

  useEffect(() => {
    const q = query(collection(db, 'duels'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q, (snap) => {
      setDuels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, []);

  const filtered = duels.filter((d) => {
    if (filter === 'settled') return d.status === 'settled';
    if (filter === 'accepted') return d.status === 'accepted';
    if (filter === 'open') return d.status === 'open';
    return true;
  });

  // Stats per user
  const userStats = useMemo(() => {
    const stats = {};
    users.forEach((u) => {
      stats[u.uid] = { uid: u.uid, name: u.displayName, won: 0, lost: 0, points: 0 };
    });
    duels.forEach((d) => {
      if (d.status !== 'settled') return;
      const loserId = d.winnerId === d.challengerId ? d.opponentId : d.challengerId;
      if (stats[d.winnerId]) {
        stats[d.winnerId].won += 1;
        stats[d.winnerId].points += d.stake;
      }
      if (stats[loserId]) {
        stats[loserId].lost += 1;
        stats[loserId].points -= d.stake;
      }
    });
    return Object.values(stats).filter((s) => s.won + s.lost > 0).sort((a, b) => b.points - a.points);
  }, [duels, users]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      {userStats.length > 0 && (
        <div className="admin-card" style={{ borderColor: 'var(--gold)' }}>
          <h4 style={{ marginBottom: 12, fontFamily: 'Frank Ruhl Libre, serif', fontSize: 16 }}>
            🏆 סטטיסטיקת דו-קרבים
          </h4>
          {userStats.map((u, i) => (
            <div key={u.uid} className="flex-between" style={{
              padding: '8px 10px',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 6,
              fontSize: 13,
            }}>
              <span><strong>#{i + 1} {u.name}</strong></span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                ✓{u.won} · ✗{u.lost}
              </span>
              <span className={`points-badge ${u.points >= 0 ? 'win' : 'loss'}`}>
                {u.points > 0 ? `+${u.points}` : u.points}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab-btn ${filter === 'settled' ? 'active' : ''}`} onClick={() => setFilter('settled')}>שהוכרעו</button>
        <button className={`tab-btn ${filter === 'accepted' ? 'active' : ''}`} onClick={() => setFilter('accepted')}>בתהליך</button>
        <button className={`tab-btn ${filter === 'open' ? 'active' : ''}`} onClick={() => setFilter('open')}>פתוחים</button>
        <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>הכל</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⚔️</div>
          <p>אין דו-קרבים בקטגוריה</p>
        </div>
      ) : (
        filtered.map((duel) => (
          <div key={duel.id} className="duel-card fade-up">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              🎯 {duel.challengerName} {duel.opponentName ? `נגד ${duel.opponentName}` : '(ממתין ליריב)'}
            </div>
            <div className="duel-claim">"{duel.claim}"</div>
            <div className="flex-between" style={{ fontSize: 13, marginTop: 8 }}>
              <span className="stake-amount" style={{ fontSize: 16 }}>{duel.stake} נק׳ לכל צד</span>
              {duel.status === 'settled' && (
                <span className="points-badge win">
                  🏆 {duel.winnerName} ניצח (+{duel.stake})
                </span>
              )}
              {duel.status === 'accepted' && (
                <span className="match-status open">בתהליך</span>
              )}
              {duel.status === 'open' && (
                <span className="match-status finished">פתוח</span>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
