/**
 * Time calculation utilities for parking duration analysis.
 */

/**
 * Calculate duration in minutes between two dates.
 * Returns 0 if either date is missing.
 */
export function durationMinutes(start, end) {
  if (!start || !end) return 0;
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
  return Math.max(0, Math.round((endDate - startDate) / 60000));
}

/**
 * Calculate duration in minutes from a start time until now.
 */
export function durationMinutesFromNow(start) {
  if (!start) return 0;
  return durationMinutes(start, new Date());
}

/**
 * Format minutes into human-readable string.
 * e.g., 135 → "2h 15m"
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Group an array of items by a date key (YYYY-MM-DD).
 */
export function groupByDate(items, dateFn) {
  return items.reduce((groups, item) => {
    const key = dateFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}
