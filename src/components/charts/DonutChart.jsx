import React, { useState } from 'react';

/**
 * Donut chart with an interactive legend. Plain SVG (stroke-dasharray arcs).
 *
 *   segments     [{ key, label, value, color }]
 *   centerLabel  caption under the total shown in the hole (e.g. "product lines")
 *   formatValue  how counts/amounts are printed (default: as-is; pass formatCompact for money)
 *
 * Hovering a segment or its legend row swaps the centre text to that segment's
 * count (the share is in the legend). Zero-value segments are left out of the ring but stay in the
 * legend, so "0 out of stock" is still visible.
 */

const R = 40;
const STROKE = 15;
const C = 2 * Math.PI * R;

export default function DonutChart({ segments, centerLabel = 'total', formatValue = (v) => v }) {
  const [hover, setHover] = useState(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const drawn = segments.filter((s) => s.value > 0);
  // A little breathing room between arcs, but never when a single arc fills the ring.
  const gap = drawn.length > 1 ? 1.2 : 0;

  let offset = 0;
  const arcs = drawn.map((s) => {
    const len = (s.value / total) * C;
    const arc = { ...s, len: Math.max(len - gap, 0.01), start: offset };
    offset += len;
    return arc;
  });

  const active = hover != null ? segments.find((s) => s.key === hover) : null;
  const pct = (v) => (total === 0 ? '0%' : `${Math.round((v / total) * 100)}%`);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center xl:flex-col 2xl:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`Donut chart: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
          onMouseLeave={() => setHover(null)}
        >
          <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.key ? STROKE + 2 : STROKE}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={-a.start}
              opacity={hover == null || hover === a.key ? 1 : 0.45}
              style={{ transition: 'stroke-width 120ms, opacity 120ms' }}
              onMouseEnter={() => setHover(a.key)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold leading-none tabular text-ink-900">
            {formatValue(active ? active.value : total)}
          </span>
          <span className="mt-1 text-[11px] leading-tight text-ink-400">
            {active ? active.label : centerLabel}
          </span>
        </div>
      </div>

      <ul className="w-full max-w-[280px] space-y-1 text-sm">
        {segments.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors ${
              hover === s.key ? 'bg-cream-50' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-ink-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <span className="truncate" title={s.label}>{s.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-semibold tabular text-ink-900">{formatValue(s.value)}</span>
              <span className="w-9 text-right text-xs tabular text-ink-400">{pct(s.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
