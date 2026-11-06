import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { extractErrorMessage } from '../api/client.js';
import { fetchSetupStatus } from '../api/auth.js';
import Icon from '../components/Icon.jsx';
import { useAppName } from '../config/BrandContext.jsx';
import { useTheme } from '../config/ThemeContext.jsx';
import { resolveLogin } from '../config/loginConfig.js';
import LoginScreen, { loginButtonColor } from './LoginScreen.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const { appName } = useAppName();
  const { login: loginConfig } = useTheme();
  const text = resolveLogin(loginConfig);
  const navigate  = useNavigate();
  const location  = useLocation();
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [capsLock, setCapsLock]       = useState(false);
  const [error, setError]             = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const pwdRef = useRef(null);
  useEffect(() => { fetchSetupStatus().then((s) => setSetupRequired(Boolean(s?.setupRequired))).catch(() => {}); }, []);
  const from   = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try   { await login(email, password); navigate(from, { replace: true }); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally     { setSubmitting(false); }
  }

  function togglePwd() {
    setShowPwd(v => !v);
    requestAnimationFrame(() => pwdRef.current?.focus());
  }

  return (
    <LoginScreen config={loginConfig} appName={appName}>
      {setupRequired && (
        <p className="alert alert-warning mt-6 text-sm">
          This system has not been set up yet: there are no users. The first administrator is created once with the setup call
          (POST /api/setup/first-admin, see DEPLOYMENT.md). After that you can sign in here.
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
        {/* Email */}
        <div>
          <label htmlFor="email" className="label">Username</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center" style={{ color: 'var(--kpi-accent, #a3a676)' }}>
              <Icon name="mail" size={16} />
            </span>
            <input id="email" type="text" required autoFocus autoComplete="username" spellCheck="false"
              value={email} onChange={e => setEmail(e.target.value)}
              className="input pl-10" placeholder="your username"
              aria-invalid={error ? 'true' : undefined} />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center" style={{ color: 'var(--kpi-accent, #a3a676)' }}>
              <Icon name="lock" size={16} />
            </span>
            <input id="password" ref={pwdRef}
              type={showPwd ? 'text' : 'password'}
              required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyUp={e => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
              className="input pl-10 pr-12" placeholder="••••••••"
              aria-invalid={error ? 'true' : undefined} />
            {/* type=button prevents form submission */}
            <button type="button" onClick={togglePwd} tabIndex={-1}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              aria-pressed={showPwd}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg transition"
              style={{ color: showPwd ? 'var(--kpi-accent, #a3a676)' : 'var(--text-muted)' }}>
              <Icon name={showPwd ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
          {capsLock && (
            <p className="field-hint mt-1.5 flex items-center gap-1 text-amber-700">
              <Icon name="warning" size={12} /> Caps Lock is on
            </p>
          )}
        </div>

        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-sm underline" style={{ color: 'var(--text-muted)' }}>Forgot password?</Link>
        </div>

        {error && (
          <div className="alert alert-error animate-fade-in" role="alert">
            <Icon name="error" size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn btn-lg w-full"
          style={{ background: loginButtonColor(loginConfig), color: '#fff', fontFamily: 'var(--font-ui)' }}>
          {submitting
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Signing in...</>
            : text.buttonLabel}
        </button>
      </form>
    </LoginScreen>
  );
}
