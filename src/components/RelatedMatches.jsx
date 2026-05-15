import { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * RelatedMatches - shows a compact list of match chips for given match IDs.
 * Defensive: never crashes on undefined/null/empty matchIds.
 */
export default function RelatedMatches({ matchIds }) {
  // Normalize input - never trust it
  const safeIds = useMemo(() => {
    if (!Array.isArray(matchIds)) return [];
    return matchIds.filter((id) => typeof id === 'string' && id.length > 0);
  }, [matchIds]);

  const idsKey = safeIds.join(',');

  const [matches, setMatches] = useState({});

  useEffect(() => {
    if (safeIds.length === 0) {
      setMatches({});
      return;
    }
    // Subscribe to each match individually - cheaper than full collection
    // and avoids permission/ordering complications.
    const unsubs = safeIds.map((id) => {
      try {
        return onSnapshot(
          doc(db, 'matches', id),
          (snap) => {
            if (!snap.exists()) {
              setMatches((prev) => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
              return;
            }
            setMatches((prev) => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }));
          },
          (err) => {
            console.error('RelatedMatches doc listen error:', err);
          }
        );
      } catch (e) {
        console.error('RelatedMatches subscribe error:', e);
        return () => {};
      }
    });
    return () => unsubs.forEach((u) => u && u());
  }, [idsKey]);

  if (safeIds.length === 0) return null;

  const matchList = safeIds.map((id) => matches[id]).filter(Boolean);
  if (matchList.length === 0) return null;

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      marginBottom: 10,
      borderRight: '2px solid var(--gold)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        🎯 משחקים רלוונטיים ({matchList.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {matchList.map((m) => (
          <span key={m.id} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--surface-3)',
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 11,
            border: '1px solid var(--border)',
          }}>
            {m.homeFlag} {m.homeName} - {m.awayName} {m.awayFlag}
          </span>
        ))}
      </div>
    </div>
  );
}
