const currencyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Backend amounts are already the branch's currency unit (no currency-conversion concept exists yet) - this just gives consistent grouping/decimals. */
export function formatMoney(value) {
  if (value === null) return '—';   // hidden from this role (or unknown)
  const n = Number(value ?? 0);
  return currencyFormatter.format(n);
}

const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** Short form for chart axes and tight spaces: 1250000 -> "1.3M". */
export function formatCompact(value) {
  return compactFormatter.format(Number(value ?? 0));
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** For date <input type="date"> values / API query params. */
export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate() {
  return toIsoDate(new Date());
}

/**
 * Local-calendar date helpers. toIsoDate() above goes through UTC, which can be
 * off by a day for a few hours around midnight in timezones ahead of / behind UTC;
 * these stay on the user's own calendar day.
 */
export function toLocalIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' -> Date at local midnight. */
export function parseIsoDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Number of calendar days from..to, both ends included. */
export function daysInRange(fromIso, toIso) {
  const ms = parseIsoDate(toIso) - parseIsoDate(fromIso);
  return Math.round(ms / 86400000) + 1;
}

/** 'YYYY-MM-DD' -> "21 Sep 2026", without a timezone shift. */
export function formatIsoDate(iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  return parseIsoDate(iso).toLocaleDateString(undefined, options);
}
