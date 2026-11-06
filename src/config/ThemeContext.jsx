import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getPublicSettings } from '../api/settings.js';
import { applyTheme, cleanTheme, parseTheme } from './theme.js';
import { cleanLogin, parseLogin } from './loginConfig.js';

const CACHE_KEY = 'erp.theme';
const LOGIN_CACHE_KEY = 'erp.login';

function readCache() {
  try { return cleanTheme(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')); } catch { return {}; }
}
function writeCache(theme) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(theme)); } catch { /* storage unavailable - fine */ }
}

function readLoginCache() {
  try { return cleanLogin(JSON.parse(localStorage.getItem(LOGIN_CACHE_KEY) || '{}')); } catch { return {}; }
}
function writeLoginCache(login) {
  try { localStorage.setItem(LOGIN_CACHE_KEY, JSON.stringify(login)); } catch { /* storage unavailable - fine */ }
}

const ThemeContext = createContext({ theme: {}, setTheme: () => {}, preview: () => {}, login: {}, setLogin: () => {} });

/**
 * Applies the chosen look to the whole app. Starts from the last look seen on this device (no flash of the
 * old colours on reload), then refreshes from the server's public settings so everyone gets the same look.
 * `preview` shows a draft without saving it (Settings > Appearance); `setTheme` is the saved look.
 * `login` is the saved sign-in page configuration (Settings > Login page), read from the same public settings.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readCache);
  const [draft, setDraft] = useState(null);
  const [login, setLoginState] = useState(readLoginCache);

  const setTheme = useCallback((next) => {
    const clean = cleanTheme(next);
    setThemeState(clean);
    setDraft(null);
    writeCache(clean);
  }, []);

  const setLogin = useCallback((next) => {
    const clean = cleanLogin(next);
    setLoginState(clean);
    writeLoginCache(clean);
  }, []);

  useEffect(() => {
    getPublicSettings()
      .then((res) => { setTheme(parseTheme(res?.themeJson)); setLogin(parseLogin(res?.loginJson)); })
      .catch(() => { /* keep the cached look if the server can't be reached */ });
  }, [setTheme, setLogin]);

  useEffect(() => { applyTheme(draft || theme); }, [theme, draft]);

  const value = useMemo(() => ({ theme, setTheme, preview: setDraft, login, setLogin }), [theme, setTheme, login, setLogin]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
