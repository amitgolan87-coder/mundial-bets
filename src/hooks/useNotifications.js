import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const STORAGE_PREFIX = 'mb_lastSeen_';

function getLastSeen(uid, tab) {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(`${STORAGE_PREFIX}${uid}_${tab}`);
  return v ? parseInt(v, 10) : 0;
}

export function markTabSeen(uid, tab) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}${uid}_${tab}`, String(Date.now()));
  // Tell other hooks/components to re-read
  window.dispatchEvent(new CustomEvent('mb-lastseen-changed'));
}

/**
 * Counts items in a collection that are newer than lastSeen for current user.
 * For live bets - counts unsettled bets created since last visit.
 * For duels - counts OPEN duels NOT created by current user, created since last visit.
 */
export function useNotifications(uid) {
  const [counts, setCounts] = useState({ live: 0, duels: 0 });
  const [liveBets, setLiveBets] = useState([]);
  const [duels, setDuels] = useState([]);
  const [lastSeenTick, setLastSeenTick] = useState(0);

  // Re-read lastSeen when localStorage changes
  useEffect(() => {
    const handler = () => setLastSeenTick((t) => t + 1);
    window.addEventListener('mb-lastseen-changed', handler);
    return () => window.removeEventListener('mb-lastseen-changed', handler);
  }, []);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'liveBets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLiveBets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'duels'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDuels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [uid]);

  // Recalculate counts when data or lastSeen changes
  useEffect(() => {
    if (!uid) return;
    const liveLastSeen = getLastSeen(uid, 'live');
    const duelsLastSeen = getLastSeen(uid, 'duels');

    const liveCount = liveBets.filter((lb) => {
      if (lb.settled) return false;
      const ms = lb.createdAt?.toMillis ? lb.createdAt.toMillis() : 0;
      return ms > liveLastSeen;
    }).length;

    const duelCount = duels.filter((d) => {
      if (d.status !== 'open') return false;
      if (d.challengerId === uid) return false;
      const ms = d.createdAt?.toMillis ? d.createdAt.toMillis() : 0;
      return ms > duelsLastSeen;
    }).length;

    setCounts({ live: liveCount, duels: duelCount });
  }, [uid, liveBets, duels, lastSeenTick]);

  return counts;
}
