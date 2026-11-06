import React from 'react';
import { STOCK_STATUS } from '../utils/stockStatus.js';

const OPTIONS = [
  { key: '', label: 'All', short: 'All', countKey: 'total', color: 'var(--sidebar)' },
  { key: 'IN_STOCK', label: 'In stock', short: 'In', countKey: 'inStock', color: STOCK_STATUS.IN_STOCK.color },
  { key: 'LOW_STOCK', label: 'Low stock', short: 'Low', countKey: 'lowStock', color: STOCK_STATUS.LOW_STOCK.color },
  { key: 'OUT_OF_STOCK', label: 'Out of stock', short: 'Out', countKey: 'outOfStock', color: STOCK_STATUS.OUT_OF_STOCK.color },
];

/**
 * Sliding segmented filter: All / In stock / Low stock / Out of stock, each with its count.
 * One coloured thumb glides behind the chosen option and takes that option's colour
 * (sage for All, green, amber, red). The four options are equal width, so the thumb is
 * simply moved by whole steps of its own width.
 *
 *   value     '' (all) or IN_STOCK / LOW_STOCK / OUT_OF_STOCK
 *   counts    { total, inStock, lowStock, outOfStock } - or null while they load
 *   onChange  (value) => void
 */
export default function StockStatusFilter({ value, counts, onChange }) {
  const index = Math.max(0, OPTIONS.findIndex((o) => o.key === value));
  const active = OPTIONS[index];

  return (
    <div
      role="radiogroup"
      aria-label="Filter products by stock level"
      className="relative grid w-full grid-cols-4 rounded-lg border border-cream-300 bg-cream-50 p-0.5 shadow-xs sm:w-auto"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0.5 left-0.5 top-0.5 rounded-md shadow-sm"
        style={{
          width: 'calc((100% - 4px) / 4)',
          transform: `translateX(${index * 100}%)`,
          backgroundColor: active.color,
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms',
        }}
      />
      {OPTIONS.map((o) => {
        const selected = o.key === value;
        const count = counts ? counts[o.countKey] : null;
        return (
          <button
            key={o.key || 'all'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.key)}
            aria-label={`${o.label}${count == null ? '' : `, ${count}`}`}
            className={`relative z-10 flex flex-row items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[12px] font-medium leading-tight transition-colors duration-300 sm:min-w-[88px] sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-[13px] ${
              selected ? 'text-white' : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {o.key && (
                <span
                  aria-hidden="true"
                  className="hidden h-1.5 w-1.5 rounded-full transition-colors duration-300 sm:block"
                  style={{ backgroundColor: selected ? '#fff' : o.color }}
                />
              )}
              <span className="sm:hidden">{o.short}</span>
              <span className="hidden sm:inline">{o.label}</span>
            </span>
            <span className={`tabular-nums text-[11px] ${selected ? 'text-white/85' : 'text-ink-400'}`}>
              {count == null ? '–' : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
