import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * RelatedMatches - shows a compact list of match chips for given match IDs.
 * Used in LiveBet and Duel cards to show what the bet relates to.
 */
export default function RelatedMatches({ matchIds = [] }) {
  const [matches, setMatches] = useState({});

  useEffect(() => {
    if (!matchIds || matchIds.length === 0) return;
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => {
        if (matchIds.includes(d.id)) map[d.id] = { id: d.id, ...d.data() };
      });
      setMatches(map);
    });
    return () => unsub();
  }, [matchIds.join(',')]);

  if (!matchIds || matchIds.length === 0) return null;

  const matchList = matchIds.map((id) => matches[id]).filter(Boolean);
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
