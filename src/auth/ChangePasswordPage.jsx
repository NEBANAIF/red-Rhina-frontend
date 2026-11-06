import React, { useState } from 'react';
import { changePassword } from '../api/auth.js';
import { extractErrorMessage } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { isPasswordValid } from '../utils/passwordPolicy.js';

/** Shown instead of the app while the user still has a one-time password: they must choose their own first. */
export default function ChangePasswordPage() {
  const { user, refreshUser, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(next)) { setError('The new password does not meet all the requirements below.'); return; }
    if (next === current) { setError('Choose a password different from the temporary one.'); return; }
    if (next !== again) { setError('The two new passwords are not the same.'); return; }
    setSaving(true);
    try {
      await changePassword(current, next);
      await refreshUser();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-cream-300 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Choose your own password</h1>
          <p className="mt-1 text-sm text-ink-500">Hello {user?.name}. You signed in with a temporary password. Please set a password only you know before you continue.</p>
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="block text-sm text-ink-700">Temporary password (from your e-mail)
          <PasswordInput required autoFocus autoComplete="current-password" className="input mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="block text-sm text-ink-700">New password
          <PasswordInput required autoComplete="new-password" className="input mt-1" value={next} onChange={(e) => setNext(e.target.value)} />
          <PasswordChecklist password={next} />
        </label>
        <label className="block text-sm text-ink-700">Repeat the new password
          <PasswordInput required autoComplete="new-password" className="input mt-1" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        <div className="flex items-center justify-between">
          <button type="button" className="text-sm text-ink-500 underline" onClick={logout}>Sign out</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save and continue'}</button>
        </div>
      </form>
    </div>
  );
}
