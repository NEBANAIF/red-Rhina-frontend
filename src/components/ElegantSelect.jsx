import React, { useRef, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * Elegant styled <select> wrapper with:
 * - Custom sage chevron arrow
 * - Warm cream background with focused glow
 * - Left accent bar on focus (matches SearchInput)
 * - Cormorant Garamond for the selected value text
 * - No default browser appearance
 */
export default function ElegantSelect({
  value,
  onChange,
  children,
  className = '',
  width = 'w-auto',
  ariaLabel,
  disabled = false,
  minWidth = 120,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`relative flex items-center ${width} ${className}`}
      style={{ minWidth }}
    >
      {/* Left accent bar */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full transition-all duration-200"
        style={{
          background: focused ? 'var(--sidebar)' : 'transparent',
          opacity: focused ? 1 : 0,
        }}
      />

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-full cursor-pointer appearance-none rounded-xl border py-2 pl-3.5 pr-9 text-sm outline-none transition-all duration-200"
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 15,
          letterSpacing: '0.01em',
          background: focused ? 'var(--input-bg-focus)' : 'var(--input-bg)',
          borderColor: focused ? 'var(--sidebar)' : 'var(--card-border)',
          color: 'var(--text)',
          boxShadow: focused
            ? '0 0 0 3px rgba(122,125,85,0.12), 0 1px 3px rgba(60,55,30,0.06)'
            : '0 1px 2px rgba(60,55,30,0.04)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {children}
      </select>

      {/* Custom chevron */}
      <span
        className="pointer-events-none absolute right-3 flex items-center transition-all duration-200"
        style={{
          color: focused ? 'var(--sidebar)' : 'var(--text-muted)',
          transform: focused ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
        aria-hidden="true"
      >
        <Icon name="chevronDown" size={14} strokeWidth={2.2} />
      </span>
    </div>
  );
}
