import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { NotificationCountsProvider } from '../notifications/NotificationCountsContext.jsx';

const COLLAPSE_KEY = 'erp.sidebarCollapsed';

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const location = useLocation();

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ok */ }
      return next;
    });
  }

  return (
    <NotificationCountsProvider>
    <div className="flex h-screen h-[100dvh] overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg)' }}>
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </NotificationCountsProvider>
  );
}
