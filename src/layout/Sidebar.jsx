import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { visibleSections, moduleForPath } from '../navigation.js';
import { useBranchScope } from '../branch/BranchContext.jsx';
import Icon from '../components/Icon.jsx';
import { useNotificationCounts } from '../notifications/NotificationCountsContext.jsx';
import { useAppName } from '../config/BrandContext.jsx';

/*
  A richer sage sidebar - a deep-to-mid green gradient instead of the flat
  block colour from before - with the same soft gold accent for polish.

  Text hierarchy:
    Brand title     → GOLD, Cormorant Garamond (the same family as every
                       page's .page-title), tight tracking - matches the app
    Brand subtitle  → IVORY_MUTED, small caps-ish tracking
    Section labels  → IVORY_MUTED, tracked eyebrow (kept sans-serif - small
                       caps read better that way)
    Nav links       → Inter (clean sans, 14px, medium/semibold), tight
                       letter-spacing for a crisp modern feel, IVORY (rest) / GOLD (active)
    Icons           → IVORY (rest) / GOLD (active)
    Active bg       → a soft gold wash + a gold left bar, not a flat dark block
    Hover bg        → a faint warm-white wash
*/

const BG        = 'var(--sidebar-bg)';
const GOLD      = 'var(--sidebar-accent)';
const GOLD_SOFT = 'var(--sidebar-accent-soft)';
const IVORY     = 'var(--sidebar-text)';
const IVORY_MUTED = 'var(--sidebar-text-muted)';
const BORDER    = 'var(--sidebar-border)';
const ACTIVE_BG = 'var(--sidebar-active-bg)';
const HOVER_BG  = 'var(--sidebar-hover)';

export default function Sidebar({ open, onClose, collapsed = false, onToggleCollapse }) {
  const { hasPermission } = useAuth();
  const { appName } = useAppName();
  const { activeBranchType } = useBranchScope();
  const { pathname } = useLocation();
  const activeModule = moduleForPath(pathname);
  const sections = visibleSections(hasPermission, activeBranchType, activeModule?.section ?? null);
  const { counts } = useNotificationCounts();
  const unread = counts?.unread ?? 0;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-[2px] animate-fade-in md:hidden"
          style={{ background: 'rgba(44,42,28,0.55)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Main navigation"
        style={{ background: BG, borderRight: `1px solid ${BORDER}`, boxShadow: '1px 0 0 rgba(0,0,0,0.25)' }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-[transform,width] duration-200 ease-out
                    md:static md:z-auto md:translate-x-0
                    ${collapsed ? 'w-[260px] md:w-[68px]' : 'w-[260px]'}
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── Brand header ─────────────────────────────────────────────── */}
        <div
          style={{ borderBottom: `1px solid ${BORDER}` }}
          className={`flex min-h-[56px] shrink-0 items-center gap-3 px-4 py-1.5 ${collapsed ? 'md:justify-center md:px-0' : ''}`}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: GOLD_SOFT, border: `1px solid var(--sidebar-accent)`, color: GOLD }}
          >
            <Icon name="inventory" size={17} strokeWidth={2.2} />
          </span>
          <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <p style={{ fontFamily: '"Italianno",cursive', fontSize: 28, fontWeight: 400, color: GOLD, letterSpacing: 0, lineHeight: 1.05 }}>
              {appName}
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600, color: IVORY_MUTED, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {activeModule ? activeModule.label : 'Store & Warehouse'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition md:hidden"
            style={{ background: 'rgba(255,255,255,0.06)', color: IVORY }}
            aria-label="Close menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* ── Nav links ────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              {/* Section label */}
              <p
                className={`mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] ${collapsed ? 'md:sr-only' : ''}`}
                style={{ color: IVORY_MUTED, fontFamily: 'var(--font-ui)' }}
              >
                {section.label}
              </p>
              {collapsed && (
                <div className="mx-2 mb-2 hidden h-px md:block" style={{ background: BORDER }} aria-hidden="true" />
              )}

              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.label}>
                    {item.to ? (
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        title={collapsed ? item.label : undefined}
                        className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[14px] leading-none transition duration-150 ${collapsed ? 'md:justify-center md:px-0' : ''}`}
                        style={({ isActive }) => ({
                          background:  isActive ? ACTIVE_BG : 'transparent',
                          color:       isActive ? GOLD : IVORY,
                          fontFamily: 'var(--font-ui)',
                          fontWeight:  isActive ? 600 : 500,
                          letterSpacing: '0.01em',
                        })}
                        onMouseEnter={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = HOVER_BG; }}
                        onMouseLeave={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {({ isActive }) => (
                          <>
                            {/* Active left-bar indicator */}
                            <span
                              aria-hidden="true"
                              className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-150 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                              style={{ background: GOLD }}
                            />
                            <Icon
                              name={item.icon || 'dashboard'}
                              size={16}
                              strokeWidth={isActive ? 2.2 : 1.9}
                              className="shrink-0"
                              style={{ color: isActive ? GOLD : IVORY }}
                            />
                            <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                            {item.to === '/notifications' && unread > 0 && (
                              <span
                                className={`ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white tabular-nums ${collapsed ? 'md:absolute md:right-1 md:top-1 md:ml-0' : ''}`}
                              >
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ) : (
                      /* Disabled / coming-soon item */
                      <span
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[14px] leading-none cursor-not-allowed ${collapsed ? 'md:justify-center' : ''}`}
                        style={{ color: 'rgba(232,230,222,0.35)', fontFamily: 'var(--font-ui)', fontWeight: 500, letterSpacing: '0.01em' }}
                      >
                        <Icon name={item.icon || 'dashboard'} size={16} className="shrink-0" style={{ color: 'rgba(232,230,222,0.35)' }} />
                        <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                        {!collapsed && <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">Soon</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Collapse toggle — desktop only ───────────────────────────── */}
        <div className="hidden shrink-0 p-2 md:block" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] leading-none transition ${collapsed ? 'justify-center px-0' : ''}`}
            style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, letterSpacing: '0.01em', color: IVORY_MUTED }}
            onMouseEnter={e => e.currentTarget.style.background = HOVER_BG}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15} style={{ color: IVORY_MUTED }} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </nav>
    </>
  );
}
