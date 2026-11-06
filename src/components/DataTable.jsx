import React from 'react';
import Icon from './Icon.jsx';

/**
 * Redesigned table:
 * - Warm sage-tinted header band (rgba of #a3a676)
 * - Alternating cream row stripes
 * - Hover row highlight
 * - No harsh borders — only subtle separators
 * - Mobile: each row becomes a cream card
 * - Action buttons in table use icon-only btn-icon / btn-icon-danger (no text)
 */
export default function DataTable({ columns, rows, keyField = 'id', onRowClick, emptyMessage = 'No results.' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full ring-1"
          style={{ background: 'var(--kpi-accent-soft, rgba(163,166,118,0.12))', color: 'var(--kpi-accent, #a3a676)' }}
        >
          <Icon name="inbox" size={20} />
        </span>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{emptyMessage}</p>
      </div>
    );
  }

  const rowKey  = (row) => (typeof keyField === 'function' ? keyField(row) : row[keyField]);
  const getAlign = (col) => {
    const hint = col.align || (/\btext-right\b/.test(col.className || '') ? 'right' : /\btext-center\b/.test(col.className || '') ? 'center' : 'left');
    return hint === 'right' ? 'text-right' : hint === 'center' ? 'text-center' : 'text-left';
  };
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key]);

  const primaryCol = columns.find((c) => c.primary) || columns[0];
  const restCols   = columns.filter((c) => c !== primaryCol && !c.hideOnMobile);

  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`th ${getAlign(col)} ${ci === 0 ? 'rounded-tl-xl' : ''} ${ci === columns.length - 1 ? 'rounded-tr-xl' : ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className="group transition-colors"
                style={{
                  background: ri % 2 === 0 ? 'var(--row-a)' : 'var(--row-b)',
                  cursor: onRowClick ? 'pointer' : undefined,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--row-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ri % 2 === 0 ? 'var(--row-a)' : 'var(--row-b)'; }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`td ${getAlign(col)} ${col.className || ''}`}
                    style={{ borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--card-border)' }}
                  >
                    {cell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ──────────────────────────────────────────────── */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
              className="rounded-xl border p-3 transition"
              style={{
                background: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                cursor: onRowClick ? 'pointer' : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2 pb-2">
                <div className="min-w-0 text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                  {cell(primaryCol, row)}
                </div>
                {onRowClick && <Icon name="chevronRight" size={15} style={{ color: 'var(--kpi-accent, #a3a676)' }} className="mt-0.5 shrink-0" />}
              </div>
              {restCols.length > 0 && (
                <dl className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
                  {restCols.map((col) => (
                    <div
                      key={col.key}
                      className="flex items-center justify-between gap-3 py-1.5"
                      style={{ borderTop: '1px solid var(--card-border)' }}
                    >
                      <dt className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{col.header}</dt>
                      <dd className="min-w-0 text-right text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>{cell(col, row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
