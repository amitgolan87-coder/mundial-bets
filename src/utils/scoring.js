import { EXACT_SCORE_MULTIPLIER } from './constants';

/**
 * Returns 'home', 'away', or 'draw' for a score.
 */
export function directionOf(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

/**
 * Calculates points for a match prediction.
 *
 * Match has odds: { home: 2, draw: 6, away: 7 } (sums to MATCH_POINT_TOTAL)
 * - Wrong direction => 0 points
 * - Correct direction only => odds points for that direction
 * - Correct direction + exact score => odds points * 2
 */
export function calculateMatchPoints(prediction, actualResult, odds) {
  if (!prediction || !actualResult || !odds) return 0;

  const predDir = directionOf(prediction.home, prediction.away);
  const actDir = directionOf(actualResult.home, actualResult.away);

  if (predDir !== actDir) return 0;

  const directionPoints = odds[actDir] || 0;
  const isExact =
    prediction.home === actualResult.home &&
    prediction.away === actualResult.away;

  return isExact ? directionPoints * EXACT_SCORE_MULTIPLIER : directionPoints;
}

/**
 * Returns true if the match betting window is still open.
 * Match locks `hoursBefore` hours before kickoff.
 */
export function isMatchOpen(match, hoursBefore = 24) {
  if (!match.kickoffAt) return false;
  if (match.status === 'finished') return false;
  const kickoff = match.kickoffAt.toMillis
    ? match.kickoffAt.toMillis()
    : new Date(match.kickoffAt).getTime();
  const lockTime = kickoff - hoursBefore * 60 * 60 * 1000;
  return Date.now() < lockTime;
}

export function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeUntil(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'התחיל';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  if (days > 0) return `בעוד ${days} ימים`;
  if (hours > 0) return `בעוד ${hours} שעות`;
  const mins = Math.floor(ms / (60 * 1000));
  return `בעוד ${mins} דקות`;
}
