import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getNotificationCounts } from '../api/notifications.js';
import { useAuth } from '../auth/AuthContext.jsx';

const POLL_MS = 30000;

const NotificationCountsContext = createContext({ counts: null, refresh: () => {} });

/**
 * The numbers behind the bell: { unread, toReview }. Fetched when the app opens, every 30 seconds
 * while the tab is visible, whenever the tab comes back into view, and on demand (refresh) right
 * after the Notifications page changes something - so the bell never lags behind the list.
 * Only runs for a role that can see notifications (ACTIVITY_VIEW).
 */
export function NotificationCountsProvider({ children }) {
  const { hasPermission } = useAuth();
  const enabled = hasPermission('ACTIVITY_VIEW');
  const [counts, setCounts] = useState(null);

  const refresh = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return getNotificationCounts().then(setCounts).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCounts(null);
      return undefined;
    }
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  const value = useMemo(() => ({ counts, refresh }), [counts, refresh]);
  return <NotificationCountsContext.Provider value={value}>{children}</NotificationCountsContext.Provider>;
}

export function useNotificationCounts() {
  return useContext(NotificationCountsContext);
}
