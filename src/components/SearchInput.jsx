import React, { useRef, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * Elegant search input with:
 * - Sage left-border accent that lights up on focus
 * - Animated search icon that slides aside when typing
 * - One-click clear (×) button
 * - Cormorant Garamond typed text, Inter placeholder
 * - Subtle warm glow on focus
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  width = 'max-w-xs',
  autoFocus = false,
  onClear,
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const hasValue = value && value.length > 0;

  return (
    <div
      className={`relative flex items-center transition-all duration-200 ${width} ${className}`}
      style={{ minWidth: 180 }}
    >
      {/* Left accent bar */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full transition-all duration-200"
        style={{
          background: focused ? 'var(--sidebar)' : 'transparent',
          opacity: focused ? 1 : 0,
        }}
      />

      {/* Search icon */}
      <span
        className="pointer-events-none absolute left-3 flex items-center transition-all duration-200"
        style={{
          color: focused ? 'var(--sidebar)' : 'var(--text-muted)',
          transform: focused && hasValue ? 'scale(0.85)' : 'scale(1)',
        }}
      >
        <Icon name="search" size={15} strokeWidth={2} />
      </span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-xl border py-2 pl-9 pr-8 text-sm outline-none transition-all duration-200"
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
          caretColor: 'var(--sidebar)',
        }}
      />

      {/* Clear button — only visible when there's text */}
      {hasValue && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // don't steal focus from input
            onChange('');
            onClear?.();
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-150 hover:bg-cream-200"
          style={{ color: 'var(--kpi-accent, #a3a676)' }}
          aria-label="Clear search"
          tabIndex={-1}
        >
          <Icon name="close" size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
