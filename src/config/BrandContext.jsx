import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_NAME as DEFAULT_APP_NAME } from './brand.js';
import { getPublicSettings } from '../api/settings.js';

const CACHE_KEY = 'erp.appName';

function readCache() {
  try { return localStorage.getItem(CACHE_KEY) || null; } catch { return null; }
}

function writeCache(name) {
  try { localStorage.setItem(CACHE_KEY, name); } catch { /* storage unavailable - fine */ }
}

const BrandContext = createContext({ appName: DEFAULT_APP_NAME, setAppName: () => {} });

/**
 * Holds the app's display name. Starts from the last name seen on this device (so there is no
 * flash of the default on reload), then refreshes from the server's public settings.
 */
export function BrandProvider({ children }) {
  const [appName, setAppNameState] = useState(() => readCache() || DEFAULT_APP_NAME);

  const setAppName = useCallback((name) => {
    const next = (name || '').trim() || DEFAULT_APP_NAME;
    setAppNameState(next);
    writeCache(next);
  }, []);

  useEffect(() => {
    getPublicSettings()
      .then((res) => { if (res?.appName) setAppName(res.appName); })
      .catch(() => { /* keep cached/default name if the server can't be reached */ });
  }, [setAppName]);

  useEffect(() => { document.title = appName; }, [appName]);

  const value = useMemo(() => ({ appName, setAppName }), [appName, setAppName]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useAppName() {
  return useContext(BrandContext);
}
