import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, login as loginRequest } from '../api/auth.js';
import { getBranch } from '../api/branches.js';
import { getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' until we've resolved whether an existing token is still
  // valid, so ProtectedRoute doesn't flash a login screen on every reload.
  const [status, setStatus] = useState('loading');

  const loadCurrentUser = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(await enrichBranchName(me));
      setStatus('authenticated');
    } catch {
      setToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      loadCurrentUser();
    } else {
      setStatus('anonymous');
    }
  }, [loadCurrentUser]);

  // A 401 from any API call (client.js) means the token is no longer
  // good - drop the local session immediately rather than waiting for the
  // user to hit something that triggers a re-check.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('erp:unauthorized', onUnauthorized);
    return () => window.removeEventListener('erp:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await loginRequest(email, password);
    setToken(response.accessToken);
    setUser(await enrichBranchName(response));
    setStatus('authenticated');
    return response;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const hasPermission = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, status, login, logout, hasPermission, refreshUser: loadCurrentUser }),
    [user, status, login, logout, hasPermission, loadCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * LoginResponse/CurrentUserResponse both carry branchId but branchName is
 * always null (a documented gap in AuthService - see its comment: "branch
 * name is enriched by the controller/service in Phase 3 once BranchService
 * exists", which happened, but AuthService itself was never revisited to
 * use it). Rather than show a blank branch name in the topbar, fetch it
 * once here. Falls back to null gracefully (e.g. a stale/deleted branch)
 * rather than blocking login.
 */
async function enrichBranchName(userLike) {
  if (userLike.branchName || !userLike.branchId) return userLike;
  try {
    const branch = await getBranch(userLike.branchId);
    return { ...userLike, branchName: branch.name };
  } catch {
    return userLike;
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
