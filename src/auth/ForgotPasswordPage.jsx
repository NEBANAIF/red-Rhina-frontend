import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth.js';
import { extractErrorMessage } from '../api/client.js';

/** "Forgot password": ask for a reset link by username or e-mail. */
export default function ForgotPasswordPage() {
  const [login, setLogin] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await forgotPassword(login.trim()); setSent(true); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-cream-300 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-ink-900">Forgot your password?</h1>
        {sent ? (
          <>
            <p className="text-sm text-ink-600">If an account with that username or e-mail exists, we sent a link to its e-mail address. The link works for 1 hour.</p>
            <Link to="/login" className="text-sm text-ink-700 underline">Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-ink-500">Enter your username or e-mail and we will send you a link to choose a new password.</p>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <input required autoFocus className="input" placeholder="username or you@company.com" value={login} onChange={(e) => setLogin(e.target.value)} />
            <div className="flex items-center justify-between">
              <Link to="/login" className="text-sm text-ink-500 underline">Back to sign in</Link>
              <button type="submit" disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send reset link'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
