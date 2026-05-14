import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatDateTime } from '../utils/scoring';

/**
 * MatchPicker - reusable widget for selecting matches.
 *
 * Props:
 *   selectedIds: array of match IDs currently selected
 *   onChange: (newSelectedIds, earliestKickoffDate) => void
 *   onlyUpcoming: boolean - if true, hides finished matches (default true)
 */
export default function MatchPicker({ selectedIds = [], onChange, onlyUpcoming = true }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filter matches: upcoming only (if onlyUpcoming) + skip TBD knockouts without teams
  const availableMatches = useMemo(() => {
    return matches.filter((m) => {
      if (onlyUpcoming && m.status === 'finished') return false;
      return true;
    });
  }, [matches, onlyUpcoming]);

  // Helper: get date string YYYY-MM-DD from match kickoff
  const getMatchDate = (m) => {
    const d = m.kickoffAt?.toDate ? m.kickoffAt.toDate() : new Date(m.kickoffAt);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Apply date filter
  const applyDateRange = () => {
    if (!dateFrom || !dateTo) return;
    const ids = availableMatches
      .filter((m) => {
        const md = getMatchDate(m);
        return md >= dateFrom && md <= dateTo;
      })
      .map((m) => m.id);
    notifyChange(ids);
  };

  const notifyChange = (ids) => {
    // Calculate earliest kickoff among selected matches
    const selected = matches.filter((m) => ids.includes(m.id));
    let earliest = null;
    for (const m of selected) {
      const d = m.kickoffAt?.toMillis ? m.kickoffAt.toMillis() : new Date(m.kickoffAt).getTime();
      if (earliest === null || d < earliest) earliest = d;
    }
    onChange(ids, earliest);
  };

  const toggleMatch = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    notifyChange(next);
  };

  const clearAll = () => notifyChange([]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>טוען משחקים…</div>;

  const selected = matches.filter((m) => selectedIds.includes(m.id));

  return (
    <div>
      <div className="row-2" style={{ marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>מתאריך</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>עד תאריך</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={applyDateRange}
        disabled={!dateFrom || !dateTo}
        style={{ width: '100%', marginBottom: 8 }}
      >
        📅 טען משחקים בטווח
      </button>

      <div className="flex-between" style={{ marginBottom: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
          ✓ נבחרו {selectedIds.length} משחקים
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedIds.length > 0 && (
            <button type="button" className="btn-sm btn-ghost" onClick={clearAll} style={{ padding: '4px 10px', fontSize: 12 }}>
              נקה
            </button>
          )}
          <button type="button" className="btn-sm btn-secondary" onClick={() => setShowList(!showList)} style={{ padding: '4px 10px', fontSize: 12 }}>
            {showList ? 'הסתר רשימה' : 'בחירה ידנית'}
          </button>
        </div>
      </div>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 10,
          padding: 8,
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          {selected.map((m) => (
            <span key={m.id} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--surface-3)',
              padding: '4px 8px',
              borderRadius: 999,
              fontSize: 11,
              border: '1px solid var(--border)',
            }}>
              {m.homeFlag} {m.homeName} - {m.awayName} {m.awayFlag}
              <button
                type="button"
                onClick={() => toggleMatch(m.id)}
                style={{ marginRight: 2, fontSize: 14, color: 'var(--loss)', lineHeight: 1 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Manual selection list */}
      {showList && (
        <div style={{
          maxHeight: 280,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)',
          marginBottom: 8,
        }}>
          {availableMatches.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              אין משחקים זמינים
            </div>
          ) : (
            availableMatches.map((m) => {
              const isSelected = selectedIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => toggleMatch(m.id)}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(245, 197, 66, 0.1)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{
                    width: 16, height: 16, border: '2px solid var(--gold)',
                    borderRadius: 3, display: 'grid', placeItems: 'center',
                    background: isSelected ? 'var(--gold)' : 'transparent',
                    color: 'var(--bg)', fontSize: 12, fontWeight: 900,
                    flexShrink: 0,
                  }}>{isSelected ? '✓' : ''}</span>
                  <span style={{ flex: 1 }}>
                    {m.homeFlag} {m.homeName} - {m.awayName} {m.awayFlag}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {formatDateTime(m.kickoffAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
