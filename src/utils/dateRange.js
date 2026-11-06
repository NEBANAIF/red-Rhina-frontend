import { toLocalDay } from './exporter.js';

/** Ready-made date ranges used by the Export dialog and by the filter bar on list pages. */
export const DATE_PRESETS = [
  ['today', 'Today'], ['7d', 'Last 7 days'], ['month', 'This month'],
  ['lastMonth', 'Last month'], ['year', 'This year'], ['all', 'All dates'],
];

/** { from, to } as 'YYYY-MM-DD' local days for a preset key ('all' = both empty). */
export function presetRange(key) {
  const now = new Date();
  const day = (d) => toLocalDay(d);
  switch (key) {
    case 'today': return { from: day(now), to: day(now) };
    case '7d': return { from: day(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: day(now) };
    case 'month': return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) };
    case 'lastMonth': return {
      from: day(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: day(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    case 'year': return { from: day(new Date(now.getFullYear(), 0, 1)), to: day(now) };
    default: return { from: '', to: '' };
  }
}

const parts = (day) => day.split('-').map(Number);

/** The exact moment a local calendar day starts, as an ISO instant the server understands. */
export function dayStartIso(day) {
  if (!day) return undefined;
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** The last moment of a local calendar day, as an ISO instant. */
export function dayEndIso(day) {
  if (!day) return undefined;
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}
