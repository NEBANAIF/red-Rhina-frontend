import React, { useEffect, useMemo, useRef, useState } from 'react';
import { updateSettings } from '../../api/settings.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAppName } from '../../config/BrandContext.jsx';
import { useTheme } from '../../config/ThemeContext.jsx';
import {
  LAYOUTS, LOGIN_DEFAULTS, MAX_BULLETS, MAX_BULLET_LENGTH, PATTERNS, TEXT_FIELDS, cleanLogin, parseLogin,
} from '../../config/loginConfig.js';
import LoginScreen, { PreviewForm } from '../../auth/LoginScreen.jsx';

const COLOR_FIELDS = [
  { key: 'panelColor', label: 'Side panel color', hint: 'Empty = follows the app look (sidebar colors)', fallback: '#7a7d55' },
  { key: 'panelColor2', label: 'Side panel 2nd color', hint: 'Optional - makes a soft gradient', fallback: '#4a5438' },
  { key: 'buttonColor', label: 'Sign-in button', hint: 'Empty = the app\'s main button color', fallback: '#7a7d55' },
];

const PREVIEW_WIDTH = 1000;
const PREVIEW_HEIGHT = 620;

/**
 * Settings > Login page: the wording, layout and colors of the sign-in screen everyone sees before signing in.
 * The preview below is a picture of that screen; nothing changes for anyone until "Save login page" is pressed.
 */
export default function LoginPageCard({ settings, onSaved }) {
  const { login: saved, setLogin } = useTheme();
  const { appName } = useAppName();
  const [draft, setDraft] = useState(() => parseLogin(settings.loginJson));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const clean = useMemo(() => cleanLogin(draft), [draft]);
  const dirty = JSON.stringify(clean) !== JSON.stringify(cleanLogin(saved));
  const set = (key, value) => { setMsg(null); setDraft((d) => ({ ...d, [key]: value })); };
  const unset = (key) => { setMsg(null); setDraft((d) => { const n = { ...d }; delete n[key]; return n; }); };

  const bullets = draft.bullets ?? LOGIN_DEFAULTS.bullets;
  const setBullet = (i, text) => {
    const next = Array.from({ length: MAX_BULLETS }, (_, k) => bullets[k] || '');
    next[i] = text;
    setMsg(null);
    // Keep the boxes as typed; blanks are dropped when the page is saved (cleanLogin).
    setDraft((d) => ({ ...d, bullets: next }));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await updateSettings({ ...settings, loginJson: JSON.stringify(clean) });
      onSaved(res);
      setLogin(parseLogin(res.loginJson));
      setDraft(parseLogin(res.loginJson));
      setMsg({ ok: true, text: 'Login page saved.' });
    } catch (err) {
      setMsg({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Login page</p>
      <p className="mb-4 text-sm text-ink-500">
        Change the words, colors and layout of the sign-in screen. Leave a box empty to keep the built-in text.
        The picture below shows how it will look; press “Save login page” to use it for everyone.
      </p>

      <h3 className="mb-2 text-sm font-semibold text-ink-900">Layout</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-ink-900">Where the side panel goes</span>
          <select className="input mt-1" value={draft.layout || 'left'} onChange={(e) => (e.target.value === 'left' ? unset('layout') : set('layout', e.target.value))}>
            {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-900">Panel pattern</span>
          <select className="input mt-1" value={draft.pattern || 'grid'} onChange={(e) => (e.target.value === 'grid' ? unset('pattern') : set('pattern', e.target.value))}>
            {PATTERNS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Words</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className={`block text-sm ${f.multiline ? 'sm:col-span-2' : ''}`}>
            <span className="font-medium text-ink-900">{f.label}</span>
            {f.multiline ? (
              <textarea
                className="input mt-1" rows={f.key === 'headline' ? 3 : 2} maxLength={f.max}
                placeholder={LOGIN_DEFAULTS[f.key]} value={draft[f.key] ?? ''}
                onChange={(e) => (e.target.value ? set(f.key, e.target.value) : unset(f.key))}
              />
            ) : (
              <input
                className="input mt-1" maxLength={f.max}
                placeholder={LOGIN_DEFAULTS[f.key]} value={draft[f.key] ?? ''}
                onChange={(e) => (e.target.value ? set(f.key, e.target.value) : unset(f.key))}
              />
            )}
          </label>
        ))}
      </div>

      <h3 className="mb-1 mt-6 text-sm font-semibold text-ink-900">Bullet points on the side panel</h3>
      <p className="mb-2 text-xs text-ink-400">Up to {MAX_BULLETS} short lines. Empty all of them to hide the list.</p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {Array.from({ length: MAX_BULLETS }, (_, i) => (
          <input
            key={i} className="input" maxLength={MAX_BULLET_LENGTH} aria-label={`Bullet ${i + 1}`}
            placeholder={LOGIN_DEFAULTS.bullets[i] || `Bullet ${i + 1}`} value={bullets[i] || ''}
            onChange={(e) => setBullet(i, e.target.value)}
          />
        ))}
      </div>
      {draft.bullets !== undefined && (
        <button type="button" className="mt-2 text-xs text-ink-400 underline hover:text-ink-700" onClick={() => unset('bullets')}>
          Use the built-in bullet points
        </button>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Colors</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {COLOR_FIELDS.map((o) => (
          <div key={o.key} className="flex items-center gap-3">
            <input
              type="color" aria-label={o.label} value={draft[o.key] || o.fallback}
              onChange={(e) => set(o.key, e.target.value)}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-cream-300 bg-transparent p-0.5"
            />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-ink-900">{o.label}</p>
              <p className="truncate text-xs text-ink-400">{o.hint}</p>
            </div>
            {draft[o.key] && (
              <button type="button" className="text-xs text-ink-400 underline hover:text-ink-700" onClick={() => unset(o.key)}>Reset</button>
            )}
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Preview</h3>
      <ScaledPreview>
        <LoginScreen config={clean} appName={appName} preview>
          <PreviewForm config={clean} />
        </LoginScreen>
      </ScaledPreview>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={save}>
          {saving ? 'Saving...' : 'Save login page'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving || Object.keys(draft).length === 0}
          onClick={() => { setMsg(null); setDraft({}); }}>
          Back to the built-in login page
        </button>
        {dirty && !saving && <span className="text-sm text-amber-700">Not saved yet — nobody sees this until you save.</span>}
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

/** Draws its children at a fixed desktop size and shrinks them to fit the card. */
function ScaledPreview({ children }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / PREVIEW_WIDTH));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl border border-cream-300" style={{ height: PREVIEW_HEIGHT * scale }}>
      <div
        className="pointer-events-none select-none"
        style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}
