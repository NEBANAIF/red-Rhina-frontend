import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dropdown you can TYPE into: the list narrows as you type. `options` = [{ value, label }]; `value` = the chosen option's value
 * ('' = none); `onChange` gets the chosen value, or '' when the text is edited after choosing (so a half-typed name is never taken for a
 * choice). `required` makes the form refuse to submit without a choice. The list is drawn in a portal so a modal's scroll area does not clip it.
 */
export default function SearchableSelect({ options, value, onChange, placeholder = 'Search…', required = false, disabled = false, emptyText = 'No match.' }) {
  const chosen = options.find((o) => o.value === value) || null;
  const [text, setText] = useState(chosen ? chosen.label : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);

  // show the chosen option's label (also when the choice is set from outside, or the options arrive later)
  useEffect(() => {
    const c = options.find((o) => o.value === value);
    setText(c ? c.label : (value ? '' : ''));
  }, [value, options]);

  // while a choice is sitting in the box, show the whole list; otherwise filter by what was typed
  const term = chosen ? '' : text.trim().toLowerCase();
  const shown = options.filter((o) => !term || o.label.toLowerCase().includes(term));

  useEffect(() => {
    if (!open) return undefined;
    const place = () => { if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  const choose = (o) => { onChange(o.value); setText(o.label); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };

  return (
    <>
      <input
        ref={inputRef} type="text" role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off"
        className="input" placeholder={placeholder} disabled={disabled} value={text}
        onChange={(e) => { setText(e.target.value); if (value) onChange(''); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
      />
      {/* keeps the browser's "please fill this in" check working for a typed-in field */}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value || ''} onChange={() => {}}
        style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />}
      {open && rect && createPortal(
        <ul role="listbox" onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 60 }}
          className="max-h-60 overflow-y-auto rounded-xl border border-cream-300 bg-cream-50 py-1 text-sm shadow-overlay">
          {shown.length === 0 && <li className="px-3 py-2 text-ink-400">{emptyText}</li>}
          {shown.map((o, i) => (
            <li key={o.value} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-cream-100' : ''}`}>
              <span className="font-medium text-ink-900">{o.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
