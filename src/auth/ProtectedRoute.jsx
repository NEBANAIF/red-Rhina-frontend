import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import LoadingState from '../components/LoadingState.jsx';

/**
 * requiredPermission is a UI-convenience gate only (hides a nav link /
 * shows a friendly message) - it is NOT the source of authorization.
 * Every real enforcement happens server-side via @PreAuthorize; a user
 * who bypasses this and calls the API directly still gets a 403 there.
 */
/**
 * requiredPermission is a UI-convenience gate only (hides a nav link /
 * shows a friendly message) - it is NOT the source of authorization.
 * Every real enforcement happens server-side via @PreAuthorize; a user
 * who bypasses this and calls the API directly still gets a 403 there.
 *
 * Accepts a single permission string OR an array (OR semantics) - several
 * backend endpoints authorize on more than one permission (e.g. Customers:
 * SALES_VIEW or POS_ACCESS), and gating on only one of them here would
 * incorrectly block a user the backend would actually let through.
 */
export default function ProtectedRoute({ children, requiredPermission }) {
  const { status, user, hasPermission } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingState label="Checking your session..." />;
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : requiredPermission ? [requiredPermission] : [];
  const allowed = permissions.length === 0 || permissions.some((p) => hasPermission(p));

  if (!allowed) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium text-ink-700">You don't have access to this page.</p>
          <p className="mt-1 text-sm text-ink-500">
            Ask a manager if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
