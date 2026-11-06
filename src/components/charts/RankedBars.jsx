import React from 'react';

/**
 * A ranked list where each row carries a bar sized relative to the biggest row -
 * quicker to read than a table for "top 10" style lists.
 *
 *   rows  [{ id, title, subtitle?, value, valueLabel, detail? }]
 *         value drives the bar length; valueLabel / detail are the printed text.
 */
export default function RankedBars({ rows, color = '#4470e6' }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <ol className="space-y-3.5">
      {rows.map((row, i) => (
        <li key={row.id} className="flex items-start gap-3">
          <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-medium tabular text-ink-400">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium text-slate-800" title={row.title}>{row.title}</p>
              <p className="shrink-0 text-sm font-semibold tabular text-ink-900">{row.valueLabel}</p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${max > 0 ? Math.max((row.value / max) * 100, 2) : 0}%`, backgroundColor: color }}
              />
            </div>
            {(row.subtitle || row.detail) && (
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-ink-400">
                <span className="truncate">{row.subtitle}</span>
                <span className="shrink-0 tabular">{row.detail}</span>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
