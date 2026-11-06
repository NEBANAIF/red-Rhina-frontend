import React from 'react';
import Icon from './Icon.jsx';

const TONES = ['kpi-0','kpi-1','kpi-2','kpi-3','kpi-4','kpi-5','kpi-6','kpi-7','kpi-8','kpi-9'];

export default function KpiCard({ label, value, emphasize = false, warn = false, icon, hint, trend, index = 0 }) {
  const tone = TONES[Math.abs(index) % TONES.length];
  const valColor = warn ? '#c0392b' : emphasize ? '#3a6040' : 'var(--text)';
  const iconBg   = warn ? 'rgba(220,80,60,0.1)' : emphasize ? 'rgba(90,150,90,0.12)' : 'var(--kpi-accent-soft, rgba(163,166,118,0.18))';
  const iconCol  = warn ? '#c0392b' : emphasize ? '#3a6040' : 'var(--kpi-accent, #a3a676)';
  const accentColor = warn ? '#e07070' : emphasize ? '#5e7852' : 'var(--kpi-accent, #a3a676)';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border shadow-kpi transition duration-150 hover:shadow-raised ${tone}`}
    >
      {/* Top accent stripe */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] opacity-70 transition-opacity group-hover:opacity-100"
        style={{ background: accentColor }}
      />

      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <p
            className="truncate text-[11px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}
            title={label}
          >
            {label}
          </p>
          {icon && (
            <span
              className="-mt-0.5 shrink-0 rounded-lg p-1.5"
              style={{ background: iconBg, color: iconCol }}
            >
              <Icon name={icon} size={13} strokeWidth={2} />
            </span>
          )}
        </div>

        <p
          className="mt-2 truncate text-[22px] font-bold leading-tight tabular"
          style={{ color: valColor, fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em', fontSize: 26 }}
          title={String(value)}
        >
          {value}
        </p>

        {(hint || trend) && (
          <div
            className="mt-1.5 flex items-center gap-1 text-[11px]"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}
          >
            {trend != null && trend !== 0 && (
              <span style={{ color: trend > 0 ? '#3a6040' : '#c0392b' }}>
                <Icon name={trend > 0 ? 'trendUp' : 'trendDown'} size={12} />
              </span>
            )}
            {hint && <span className="truncate">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
