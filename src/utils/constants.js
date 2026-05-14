// Starting balance for every player
export const STARTING_POINTS = 30;

// Total points distributed per match across W-D-L (admin sets each)
export const MATCH_POINT_TOTAL = 15;

// Cutoff: bets close 24h before match kickoff
export const MATCH_LOCK_HOURS_BEFORE = 24;

// Live bets close 2h before earliest applicable match kickoff
export const LIVE_LOCK_HOURS_BEFORE = 2;

// Exact-score multiplier
export const EXACT_SCORE_MULTIPLIER = 2;

// Realistic football scorelines weighted by frequency (FIFA WC historical)
// Used for auto-bets when user forgot to predict
export const REALISTIC_SCORES = [
  // [home, away, weight]
  [1, 0, 12], [0, 1, 10], [2, 1, 10], [1, 2, 9],
  [1, 1, 11], [0, 0, 7], [2, 0, 9], [0, 2, 7],
  [2, 2, 5], [3, 1, 6], [1, 3, 4], [3, 0, 4],
  [0, 3, 3], [3, 2, 3], [2, 3, 2], [4, 0, 1],
  [0, 4, 1], [3, 3, 1], [4, 1, 1], [1, 4, 1],
];

export function pickRandomRealisticScore() {
  const totalWeight = REALISTIC_SCORES.reduce((s, r) => s + r[2], 0);
  let rnd = Math.random() * totalWeight;
  for (const [h, a, w] of REALISTIC_SCORES) {
    rnd -= w;
    if (rnd <= 0) return { home: h, away: a };
  }
  return { home: 1, away: 1 };
}

// Tab identifiers
export const TABS = {
  MATCHES: 'matches',
  LIVE: 'live',
  DUELS: 'duels',
  LEADERBOARD: 'leaderboard',
  PROFILE: 'profile',
  ADMIN: 'admin',
};
