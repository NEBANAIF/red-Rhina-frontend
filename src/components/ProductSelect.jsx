import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchProducts } from '../api/products.js';

/**
 * A product picker you TYPE into instead of scrolling a dropdown. Matches on
 * product name or SKU as you type (the search runs on the server, so it works
 * with any number of products), and the list opens right under the field.
 *
 * Controlled by `value` = the chosen product object ({ id, name, sku, unit }) or
 * null; `onChange` gets the chosen product, or null when the person edits the
 * text after choosing (so a half-edited name is never mistaken for a choice).
 *
 * The list is drawn in a portal so it is not clipped by a modal's scroll area.
 *
 * `productType`: optional 'RAW_MATERIAL' | 'FINISHED_GOOD' - only products of that type are offered.
 *
 * `requireAtBranches`: an optional branch id, or array of them, to restrict results to products
 * that belong at ALL of those branches (see the Branch Products checklist) - e.g. a purchase
 * receiving into one branch passes that branch; a transfer passes both the source and destination,
 * since the product has to belong at both ends. Omit it where there's no branch to check against yet.
 */
export default function ProductSelect({ value, onChange, placeholder = 'Search product…', autoFocus = false, requireAtBranches, productType }) {
  const [text, setText] = useState(value ? value.name : '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const requestId = useRef(0);

  // Show the chosen product's name. Clearing the choice deliberately leaves the text alone:
  // that happens while the person is editing it, and their typing must not be wiped.
  useEffect(() => {
    if (value) setText(value.name);
  }, [value]);

  // What to search for: nothing (the full list) while a product is chosen and its
  // name is just sitting in the box, otherwise whatever has been typed.
  const term = value ? '' : text.trim();
  const branchKey = JSON.stringify(requireAtBranches ?? null);

  // Search on every change of the term while the list is open (debounced).
  useEffect(() => {
    if (!open) return undefined;
    const id = ++requestId.current;
    setLoading(true);
    const t = setTimeout(() => {
      searchProducts({ search: term || undefined, size: 15, requireAtBranches })
        .then((res) => {
          if (id !== requestId.current) return;
          setResults(productType ? res.content.filter((p) => p.productType === productType) : res.content);
          setActive(0);
        })
        .catch(() => { if (id === requestId.current) setResults([]); })
        .finally(() => { if (id === requestId.current) setLoading(false); });
    }, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, term, branchKey, productType]);

  // Follow the field while the list is open (window resize, scrolling inside a modal).
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const choose = (product) => {
    onChange(product);
    setText(product.name);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      // Enter picks the highlighted product instead of submitting the form.
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === 'Escape' && open) {
      // Close only the list, not the modal the field sits in.
      e.stopPropagation();
      setOpen(false);
    }
  };

  const listStyle = rect
    ? { position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 60 }
    : undefined;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        className="input"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && rect && createPortal(
        <ul
          role="listbox"
          style={listStyle}
          onMouseDown={(e) => e.preventDefault()}
          className="max-h-60 overflow-y-auto rounded-xl border border-cream-300 bg-cream-50 py-1 text-sm shadow-overlay"
        >
          {loading && results.length === 0 && <li className="px-3 py-2 text-ink-400">Searching…</li>}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-ink-400">No product matches.</li>}
          {results.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list before a click lands.
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-cream-100' : ''}`}
            >
              <span className="font-medium text-ink-900">{p.name}</span>
              <span className="ml-2 text-xs text-ink-400">{p.sku}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
