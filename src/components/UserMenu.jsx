import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import Icon from './Icon.jsx';

/**
 * The avatar + name in the top bar, click to open: My details and Sign out.
 * Replaces the separate name / avatar / Sign-out button cluster that used to
 * sit side by side in the top bar.
 */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition hover:bg-black/5 sm:pr-3"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ring-1 ring-white/30"
          style={{ background: 'var(--sidebar)', fontFamily: 'var(--font-ui)' }}
        >
          {initials(user?.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[140px] truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{user?.name}</span>
          <span className="block max-w-[140px] truncate text-xs" style={{ color: 'var(--text-muted)' }}>{user?.roleName || fmtRole(user?.role)}</span>
        </span>
        <Icon name="chevronDown" size={14} className={`hidden text-ink-400 transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-cream-300 bg-cream-50 py-1 shadow-overlay"
        >
          <div className="border-b border-cream-200 px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
            <p className="truncate text-xs text-ink-400">{user?.roleName || fmtRole(user?.role)}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => { setShowDetails(true); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-700 hover:bg-cream-100"
          >
            <Icon name="user" size={15} className="text-ink-400" />
            My details
          </button>
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </div>
      )}

      {showDetails && <MyDetailsModal onClose={() => setShowDetails(false)} />}
    </div>
  );
}

function MyDetailsModal({ onClose }) {
  const { user } = useAuth();
  const rows = [
    ['Name', user?.name],
    ['Role', user?.roleName || fmtRole(user?.role)],
    ['Branch', user?.branchName],
    ['Email', user?.email],
    ['Phone', user?.phone],
  ].filter(([, value]) => value);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-cream-50 p-5 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">My details</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
              <dd className="mt-0.5 break-words text-sm text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}
function fmtRole(role) {
  if (!role) return '';
  return role.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
