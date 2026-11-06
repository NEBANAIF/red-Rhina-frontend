import React, { useState } from 'react';
import { formatCompact, formatMoney } from '../../utils/format.js';
import { niceScale, truncate, useContainerWidth } from './chartUtils.js';

/**
 * Grouped bar chart: one group per branch, one bar per series (e.g. Revenue /
 * Gross Profit / Net Profit). Plain SVG - no chart dependency, in keeping with
 * the inline Icon set.
 *
 *   rows    [{ id, label, ...numeric fields }]   - one entry per branch
 *   series  [{ key, label, color }]              - which fields to draw
 *
 * Negative values hang below the zero line and are drawn red, matching the
 * red negative-profit figures in the tables.
 */

const HEIGHT = 260;
const PAD = { top: 12, right: 12, bottom: 34, left: 52 };
const MIN_BAND = 84; // px per branch before the chart starts scrolling sideways
const NEGATIVE = '#ef4444';

export default function BranchBarChart({ rows, series }) {
  const [hover, setHover] = useState(null);
  // Draw at the real pixel width (1:1); with many branches the chart keeps a
  // minimum width and scrolls sideways.
  const [wrapRef, containerW] = useContainerWidth();

  const width = Math.max(containerW, rows.length * MIN_BAND + PAD.left + PAD.right);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const values = rows.flatMap((r) => series.map((s) => Number(r[s.key] ?? 0)));
  const { min, max, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const y = (v) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const zeroY = y(0);

  const band = plotW / rows.length;
  const groupW = Math.min(band * 0.72, series.length * 34);
  const barGap = 3;
  const barW = (groupW - barGap * (series.length - 1)) / series.length;

  const hovered = hover != null ? rows[hover] : null;

  return (
    <div>
      {/* Legend */}
      <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="overflow-x-auto">
        <div className="relative" style={{ width }}>
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="block"
            role="img"
            aria-label={`Bar chart comparing ${series.map((s) => s.label).join(', ')} across ${rows.length} branches`}
            onMouseLeave={() => setHover(null)}
          >
            {/* Gridlines + y axis labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? '#cbd5e1' : '#f1f5f9'}
                  strokeWidth="1"
                />
                <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10.5" fill="#94a3b8">
                  {formatCompact(t)}
                </text>
              </g>
            ))}

            {rows.map((row, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x0 = cx - groupW / 2;
              const active = hover === i;
              return (
                <g key={row.id}>
                  {active && (
                    <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="#f8fafc" />
                  )}
                  {series.map((s, si) => {
                    const v = Number(row[s.key] ?? 0);
                    const top = Math.min(y(v), zeroY);
                    const h = Math.max(Math.abs(y(v) - zeroY), v === 0 ? 0 : 1);
                    return (
                      <rect
                        key={s.key}
                        x={x0 + si * (barW + barGap)}
                        y={top}
                        width={barW}
                        height={h}
                        rx="2"
                        fill={v < 0 ? NEGATIVE : s.color}
                        opacity={hover == null || active ? 1 : 0.55}
                      />
                    );
                  })}
                  <text x={cx} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize="11" fill="#64748b">
                    {truncate(row.label, Math.max(6, Math.floor((band - 8) / 6.2)))}
                  </text>
                  {/* Hit area for the whole column so thin bars are easy to hover. */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={HEIGHT - PAD.top}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs shadow-raised"
              style={{
                left: PAD.left + band * hover + band / 2,
                transform: `translateX(${hover > rows.length / 2 ? '-105%' : '5%'})`,
              }}
            >
              <p className="mb-1 font-semibold text-slate-800">{hovered.label}</p>
              {series.map((s) => {
                const v = Number(hovered[s.key] ?? 0);
                return (
                  <p key={s.key} className="flex items-center justify-between gap-4 text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                      {s.label}
                    </span>
                    <span className={`font-medium tabular ${v < 0 ? 'text-red-600' : 'text-ink-900'}`}>{formatMoney(v)}</span>
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
