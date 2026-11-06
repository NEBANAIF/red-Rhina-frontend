import React from 'react';
import { emptyStage, previewDaysAtStage, STAGE_STATUSES, withAutoStatus } from './shipment.js';

/**
 * Edits the route of a global purchase: every stop between the country the goods start in and the destination
 * warehouse. Each stop records its country, place, status, arrival and departure dates; the days spent there are
 * worked out as you type (the server works them out again when saved). Needs a <datalist id="country-options">
 * somewhere on the page for the country suggestions.
 *
 * `lockEnds` keeps the first and last country fixed (they are the order's origin and destination).
 */
export default function RouteEditor({ stages, onChange, lockEnds = false }) {
  const update = (i, patch) => onChange(stages.map((s, k) => (k === i ? withAutoStatus(s, patch) : s)));
  const addStop = () => {
    const next = [...stages];
    next.splice(Math.max(1, stages.length - 1), 0, emptyStage());
    onChange(next);
  };
  const removeStop = (i) => onChange(stages.filter((_, k) => k !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 1 || j > stages.length - 2) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const first = i === 0;
        const last = i === stages.length - 1;
        const days = previewDaysAtStage(s);
        const heading = first ? 'Start' : last ? 'Final destination' : `Transit stop ${i}`;
        const lockedCountry = lockEnds && (first || last);
        return (
          <div key={i} className="rounded-lg border border-cream-300 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {i + 1}. {heading}
              </p>
              {!first && !last && (
                <div className="flex items-center gap-1 text-ink-400">
                  <button type="button" className="rounded px-1.5 py-0.5 hover:bg-cream-100" onClick={() => move(i, -1)} disabled={i === 1} aria-label="Move up">↑</button>
                  <button type="button" className="rounded px-1.5 py-0.5 hover:bg-cream-100" onClick={() => move(i, 1)} disabled={i === stages.length - 2} aria-label="Move down">↓</button>
                  <button type="button" className="rounded px-1.5 py-0.5 hover:bg-cream-100 hover:text-red-600" onClick={() => removeStop(i)} aria-label="Remove stop">✕</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Country</span>
                <input
                  required className="input" list="country-options" value={s.country} readOnly={lockedCountry}
                  onChange={(e) => update(i, { country: e.target.value })} placeholder="e.g. Djibouti"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Port / city / warehouse</span>
                <input className="input" value={s.location} onChange={(e) => update(i, { location: e.target.value })} placeholder="optional" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Status</span>
                <select className="input" value={s.status} onChange={(e) => update(i, { status: e.target.value })}>
                  {STAGE_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Arrival date</span>
                <input type="date" className="input" value={s.arrivalDate} onChange={(e) => update(i, { arrivalDate: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Departure date</span>
                <input
                  type="date" className="input" value={s.departureDate} disabled={last} min={s.arrivalDate || undefined}
                  onChange={(e) => update(i, { departureDate: e.target.value })}
                />
              </label>
              <div className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Days at this stop</span>
                <p className="flex h-10 items-center text-sm text-ink-700">
                  {days == null ? '—' : `${days} day${days === 1 ? '' : 's'}${!s.departureDate ? ' so far' : ''}`}
                </p>
              </div>
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-xs font-medium text-ink-500">Notes</span>
                <input className="input" value={s.notes} maxLength={300} onChange={(e) => update(i, { notes: e.target.value })} placeholder="optional — e.g. waiting for customs clearance" />
              </label>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={addStop} className="text-xs font-medium text-sage-600 hover:underline">+ Add a transit stop</button>
    </div>
  );
}

/** One shared list of country suggestions for every country box on the page. */
export function CountryDatalist({ countries }) {
  return (
    <datalist id="country-options">
      {countries.map((c) => <option key={c} value={c} />)}
    </datalist>
  );
}
