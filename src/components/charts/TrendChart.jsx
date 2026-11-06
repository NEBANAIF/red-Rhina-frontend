import React, { useState } from 'react';
import { formatCompact, formatMoney, formatIsoDate } from '../../utils/format.js';
import { niceScale, useContainerWidth } from './chartUtils.js';

/**
 * Line/area chart over consecutive days.
 *
 *   points        [{ date: 'YYYY-MM-DD', <key>: number, ... }]  one entry per day, gaps already filled
 *   series        [{ key, label, color, area? }]                lines to draw (area: true tints under the line)
 *   tooltipExtras [{ key, label }]                              extra plain numbers shown only in the tooltip
 *
 * Hover (or touch-drag) anywhere on the chart to read a day's exact figures.
 */

const HEIGHT = 240;
const PAD = { top: 12, right: 14, bottom: 30, left: 52 };

export default function TrendChart({ points, series, tooltipExtras = [], formatValue = formatMoney }) {
  const [wrapRef, containerW] = useContainerWidth();
  const [hover, setHover] = useState(null);

  const n = points.length;
  const width = Math.max(containerW, 280);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const all = points.flatMap((p) => series.map((s) => Number(p[s.key] ?? 0)));
  const { min, max, ticks } = niceScale(Math.min(...all), Math.max(...all));
  const x = (i) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const zeroY = y(0);

  const linePath = (key) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(Number(p[key] ?? 0)).toFixed(1)}`).join(' ');
  const areaPath = (key) => `${linePath(key)} L${x(n - 1).toFixed(1)} ${zeroY.toFixed(1)} L${x(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  // Date labels every 1, 2, 3, 5, 7... days (whatever fits ~80px each), so the axis reads evenly.
  const maxLabels = Math.max(2, Math.floor(plotW / 80));
  const step = [1, 2, 3, 5, 7, 10, 14, 15, 30, 60, 90, 180].find((s) => Math.ceil(n / s) <= maxLabels) ?? n;
  const labelIdx = Array.from({ length: Math.ceil(n / step) }, (_, k) => k * step);
  const showDots = n <= 45;

  const pickIndex = (clientX, svg) => {
    const px = clientX - svg.getBoundingClientRect().left;
    const idx = n <= 1 ? 0 : Math.round(((px - PAD.left) / plotW) * (n - 1));
    setHover(Math.min(Math.max(idx, 0), n - 1));
  };

  const hovered = hover != null ? points[hover] : null;

  return (
    <div>
      <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="relative">
        {containerW > 0 && (
          <>
            <svg
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              className="block touch-pan-y"
              role="img"
              aria-label={`Line chart of ${series.map((s) => s.label).join(' and ')} for each day`}
              onMouseMove={(e) => pickIndex(e.clientX, e.currentTarget)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={(e) => pickIndex(e.touches[0].clientX, e.currentTarget)}
              onTouchMove={(e) => pickIndex(e.touches[0].clientX, e.currentTarget)}
              onTouchEnd={() => setHover(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#cbd5e1' : '#f1f5f9'} strokeWidth="1" />
                  <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10.5" fill="#94a3b8">
                    {formatCompact(t)}
                  </text>
                </g>
              ))}

              {labelIdx.map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={HEIGHT - 10}
                  textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
                  fontSize="11"
                  fill="#64748b"
                >
                  {formatIsoDate(points[i].date, { day: 'numeric', month: 'short' })}
                </text>
              ))}

              {series.filter((s) => s.area).map((s) => (
                <path key={`a-${s.key}`} d={areaPath(s.key)} fill={s.color} opacity="0.10" />
              ))}
              {series.map((s) => (
                <path key={`l-${s.key}`} d={linePath(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {(showDots || n === 1) && series.map((s) => points.map((p, i) => (
                <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(Number(p[s.key] ?? 0))} r="2.5" fill="#fff" stroke={s.color} strokeWidth="1.5" />
              )))}

              {hovered && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#cbd5e1" strokeDasharray="3 3" />
                  {series.map((s) => (
                    <circle key={s.key} cx={x(hover)} cy={y(Number(hovered[s.key] ?? 0))} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />
                  ))}
                </g>
              )}
            </svg>

            {hovered && (
              <div
                className="pointer-events-none absolute top-1 z-10 min-w-[160px] rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs shadow-raised"
                style={{ left: x(hover), transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})` }}
              >
                <p className="mb-1 font-semibold text-slate-800">
                  {formatIsoDate(hovered.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {series.map((s) => (
                  <p key={s.key} className="flex items-center justify-between gap-4 text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                      {s.label}
                    </span>
                    <span className="font-medium tabular text-ink-900">{formatValue(Number(hovered[s.key] ?? 0))}</span>
                  </p>
                ))}
                {tooltipExtras.map((e) => (
                  <p key={e.key} className="flex items-center justify-between gap-4 text-ink-500">
                    <span className="pl-3.5">{e.label}</span>
                    <span className="font-medium tabular text-ink-900">{Number(hovered[e.key] ?? 0)}</span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
