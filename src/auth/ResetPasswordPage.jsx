import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordWithToken } from '../api/auth.js';
import { extractErrorMessage } from '../api/client.js';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { isPasswordValid } from '../utils/passwordPolicy.js';

/** The page the e-mailed link opens: /reset-password?token=... */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(next)) { setError('The new password does not meet all the requirements below.'); return; }
    if (next !== again) { setError('The two passwords are not the same.'); return; }
    setBusy(true);
    try { await resetPasswordWithToken(token, next); setDone(true); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-cream-300 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-ink-900">Choose a new password</h1>
        {done ? (
          <>
            <p className="text-sm text-ink-600">Your password was changed. You can sign in with it now.</p>
            <Link to="/login" className="inline-block rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white">Go to sign in</Link>
          </>
        ) : !token ? (
          <p className="text-sm text-red-700">This link is missing its token. Open the link from your e-mail again, or <Link to="/forgot-password" className="underline">ask for a new one</Link>.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error} <Link to="/forgot-password" className="underline">Ask for a new link</Link></div>}
            <label className="block text-sm text-ink-700">New password
              <PasswordInput required autoFocus autoComplete="new-password" className="input mt-1" value={next} onChange={(e) => setNext(e.target.value)} />
              <PasswordChecklist password={next} />
            </label>
            <label className="block text-sm text-ink-700">Repeat the new password
              <PasswordInput required autoComplete="new-password" className="input mt-1" value={again} onChange={(e) => setAgain(e.target.value)} />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save new password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
