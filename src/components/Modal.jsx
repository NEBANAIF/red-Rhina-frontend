import React, { useEffect } from 'react';
import Icon from './Icon.jsx';

/**
 * Bare shell for create/edit forms - ConfirmDialog handles the confirm/cancel
 * case, this handles everything else that needs a form in an overlay.
 *
 * Adds (without changing the existing props): Escape to close, a locked
 * background scroll, a sticky header so long forms keep their title, and a
 * full-height sheet on phones instead of a cramped centred box.
 */
export default function Modal({ open, title, description, onClose, children, footer, wide = false, size }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === 'lg' || wide ? 'sm:max-w-2xl' : size === 'xl' ? 'sm:max-w-4xl' : 'sm:max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink-900/55 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl shadow-overlay animate-scale-in sm:rounded-xl ${width}`}
        style={{ background: 'var(--card-bg)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-1.5 -mt-1" aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 bg-cream-50/70 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
