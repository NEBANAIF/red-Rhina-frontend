import React from 'react';
import { DATE_PRESETS, presetRange } from '../utils/dateRange.js';

/**
 * The filters of a list page, always visible above the table: quick date ranges, From / To, and any extra
 * filters the page passes as children (product, status, ...). The same choices pre-fill the Export dialog.
 *
 * Props
 *  - from, to        'YYYY-MM-DD' strings ('' = no limit); leave both out to hide the date part
 *  - onDates         ({ from, to }) => void
 *  - dateLabel       what the dates mean, e.g. "Sale date"
 *  - active          true when any filter (including the extras) is in use - shows "Clear filters"
 *  - onClear         () => void - the page resets all of its filters
 */
export default function FilterBar({ from, to, onDates, dateLabel = 'Date', active = false, onClear, children }) {
  const hasDates = typeof onDates === 'function';
  const rangeInvalid = Boolean(from && to && from > to);
  const picked = hasDates ? DATE_PRESETS.find(([key]) => {
    const r = presetRange(key);
    return r.from === (from || '') && r.to === (to || '');
  })?.[0] : null;

  return (
    <div className="mb-3 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {hasDates && (
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-500">{dateLabel}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_PRESETS.map(([key, label]) => (
                <button
                  key={key} type="button"
                  className={`btn btn-sm !px-2 !py-1 text-xs ${picked === key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { const r = presetRange(key); onDates(r); }}
                >
                  {label}
                </button>
              ))}
              <input
                type="date" aria-label={`${dateLabel} from`} className="input !w-auto !py-1 text-sm"
                value={from || ''} max={to || undefined} onChange={(e) => onDates({ from: e.target.value, to })}
              />
              <span className="text-xs text-ink-400">to</span>
              <input
                type="date" aria-label={`${dateLabel} to`} className="input !w-auto !py-1 text-sm"
                value={to || ''} min={from || undefined} onChange={(e) => onDates({ from, to: e.target.value })}
              />
            </div>
          </div>
        )}
        {children}
        {active && onClear && (
          <button type="button" className="btn btn-ghost btn-sm text-xs underline" onClick={onClear}>Clear filters</button>
        )}
      </div>
      {rangeInvalid && <p className="mt-1 text-xs text-red-600">“From” must be on or before “To”.</p>}
    </div>
  );
}

/** A labelled slot for one extra filter inside FilterBar. */
export function FilterField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>
      {children}
    </div>
  );
}
