import React, { useEffect } from 'react';
import Icon from './Icon.jsx';

/** Spec section 38: "clear confirmation dialogs" for destructive/irreversible actions. */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  busy = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 p-4 backdrop-blur-[2px] animate-fade-in"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl shadow-overlay animate-scale-in" style={{ background: 'var(--card-bg)' }}>
        <div className="flex gap-3.5 p-5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-red-50 text-red-600' : 'bg-cream-100 text-sage-600'
            }`}
          >
            <Icon name={danger ? 'warning' : 'info'} size={19} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-cream-200 bg-cream-50/70 px-5 py-3">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary btn-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {busy && <Spinner />}
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />;
}
