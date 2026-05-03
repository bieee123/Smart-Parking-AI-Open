/** Format a date string into a human-readable local time. */
export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format minutes into "Xh Ym" string. */
export function formatDuration(minutes) {
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/** Format number as currency (IDR). */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(amount);
}

/** Compute occupancy percentage. */
export function getOccupancyRate(occupied, total) {
  if (!total) return 0;
  return Math.round((occupied / total) * 100);
}

/** Capitalize first letter of each word. */
export function capitalize(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Return a status colour class (Tailwind). */
export function statusColor(status) {
  const map = {
    available: 'bg-green-500',
    occupied: 'bg-red-500',
    reserved: 'bg-gray-400',
    blocked: 'bg-yellow-500',
    online: 'bg-green-500',
    offline: 'bg-red-500',
  };
  return map[status] || 'bg-gray-300';
}
