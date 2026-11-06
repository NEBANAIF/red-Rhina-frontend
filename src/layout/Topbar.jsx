import React from 'react';
import { useLocation } from 'react-router-dom';
import BranchSelector from '../branch/BranchSelector.jsx';
import Icon from '../components/Icon.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import UserMenu from '../components/UserMenu.jsx';
import { NAV_SECTIONS } from '../navigation.js';

export default function Topbar({ onOpenMenu }) {
  const { pathname } = useLocation();
  const current = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.to === pathname);

  return (
    <header
      className="sticky top-0 z-20 flex min-h-14 flex-nowrap items-center justify-between gap-x-2 px-3 py-2 sm:gap-x-3 sm:px-5"
      style={{
        background: 'var(--bg-translucent)',
        borderBottom: '1px solid var(--card-border)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button onClick={onOpenMenu} className="btn-icon md:hidden" aria-label="Open menu">
          <Icon name="menu" size={20} />
        </button>
        {current && (
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span style={{ color: 'var(--kpi-accent, #a3a676)' }}>
              <Icon name={current.icon || 'dashboard'} size={16} />
            </span>
            <span className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
              {current.label}
            </span>
            <span className="mx-1 h-4 w-px" style={{ background: 'var(--card-border)' }} aria-hidden="true" />
          </div>
        )}
        <BranchSelector />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
