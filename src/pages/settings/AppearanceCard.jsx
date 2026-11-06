import React, { useEffect, useMemo, useState } from 'react';
import { updateSettings } from '../../api/settings.js';
import { extractErrorMessage } from '../../api/client.js';
import { useTheme } from '../../config/ThemeContext.jsx';
import {
  COLOR_OPTIONS, FONT_KINDS, FONT_OPTIONS, FONTS, PRESETS, SCALE, cleanTheme, loadFont, parseTheme, themeToCssVars,
} from '../../config/theme.js';

/**
 * Settings > Appearance: background, sidebar, text, table colours and fonts.
 * Changes show live across the whole app while editing (a preview); they are only kept for everyone
 * when "Save look" is pressed, and are dropped if the person leaves without saving.
 */
export default function AppearanceCard({ settings, onSaved }) {
  const { theme: saved, setTheme, preview } = useTheme();
  const [draft, setDraft] = useState(() => parseTheme(settings.themeJson));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Show the draft live; throw it away when leaving the page.
  useEffect(() => { preview(cleanTheme(draft)); }, [draft, preview]);
  // Make sure the sample line under each font box can use the font that is picked.
  useEffect(() => { FONT_OPTIONS.forEach((o) => { if (draft[o.key]) loadFont(draft[o.key]); }); }, [draft]);
  useEffect(() => () => preview(null), [preview]);

  const clean = useMemo(() => cleanTheme(draft), [draft]);
  const dirty = JSON.stringify(clean) !== JSON.stringify(cleanTheme(saved));
  const set = (key, value) => { setMsg(null); setDraft((d) => ({ ...d, [key]: value })); };
  const unset = (key) => { setMsg(null); setDraft((d) => { const n = { ...d }; delete n[key]; return n; }); };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await updateSettings({ ...settings, themeJson: JSON.stringify(clean) });
      onSaved(res);
      setTheme(parseTheme(res.themeJson));
      setMsg({ ok: true, text: 'Look saved for everyone.' });
    } catch (err) {
      setMsg({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const vars = themeToCssVars(clean);

  return (
    <div className="card card-pad">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Appearance</p>
      <p className="mb-4 text-sm text-ink-500">
        Choose the colors and fonts of the whole app. You see the change straight away; press “Save look”
        to keep it for every user.
      </p>

      <p className="mb-2 text-sm font-semibold text-ink-900">Ready-made looks</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {PRESETS.map((p) => (
          <button key={p.name} type="button"
            className="flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-2.5 py-2 text-left text-sm text-ink-800 transition hover:border-brand-500"
            onClick={() => { setMsg(null); setDraft(p.theme); }}>
            <span className="flex h-6 w-10 shrink-0 overflow-hidden rounded border border-black/10" aria-hidden="true">
              <span className="w-1/2" style={{ background: p.theme.sidebarBg || '#707d54' }} />
              <span className="w-1/4" style={{ background: p.theme.buttonColor || '#7a7d55' }} />
              <span className="w-1/4" style={{ background: p.theme.pageBg || '#f5f5dc' }} />
            </span>
            <span className="min-w-0 truncate">{p.name}</span>
          </button>
        ))}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink-900">Colors</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {COLOR_OPTIONS.map((o) => {
          const value = draft[o.key] || o.fallback;
          const custom = Boolean(draft[o.key]);
          return (
            <div key={o.key} className="flex items-center gap-3">
              <input
                type="color" aria-label={o.label} value={value}
                onChange={(e) => set(o.key, e.target.value)}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-cream-300 bg-transparent p-0.5"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-ink-900">{o.label}</p>
                {o.hint && <p className="truncate text-xs text-ink-400">{o.hint}</p>}
              </div>
              {custom && (
                <button type="button" className="text-xs text-ink-400 underline hover:text-ink-700" onClick={() => unset(o.key)}>
                  Reset
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Text</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        {FONT_OPTIONS.map((o) => (
          <label key={o.key} className="block text-sm">
            <span className="font-medium text-ink-900">{o.label}</span>
            <select className="input mt-1" value={draft[o.key] || ''} onChange={(e) => (e.target.value ? set(o.key, e.target.value) : unset(o.key))}>
              <option value="">Default ({o.fallback})</option>
              {FONT_KINDS.map((g) => (
                <optgroup key={g.kind} label={g.label}>
                  {FONTS.filter((f) => f.kind === g.kind).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block truncate text-sm text-ink-700" style={{ fontFamily: draft[o.key] ? `"${draft[o.key]}"` : undefined }}>
              The quick brown fox 0123456789
            </span>
            <span className="mt-0.5 block text-xs text-ink-400">{o.hint}</span>
          </label>
        ))}
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-ink-900">Text size: {Math.round((draft.fontScale || 1) * 100)}%</span>
        <input
          type="range" className="mt-1 block w-full max-w-sm"
          min={SCALE.min} max={SCALE.max} step={SCALE.step} value={draft.fontScale || 1}
          onChange={(e) => { const v = Number(e.target.value); if (v === 1) unset('fontScale'); else set('fontScale', v); }}
        />
      </label>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Preview</h3>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ ...vars, borderColor: 'var(--card-border)', background: 'var(--bg)', fontSize: '0.95rem' }}
      >
        <div className="flex">
          <div className="w-32 shrink-0 space-y-1 p-3 text-xs" style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)', fontFamily: 'var(--font-ui)' }}>
            <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--sidebar-accent)' }}>Menu</p>
            <p className="rounded px-2 py-1" style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-accent)' }}>Dashboard</p>
            <p className="px-2 py-1">Sales</p>
            <p className="px-2 py-1">Inventory</p>
          </div>
          <div className="min-w-0 flex-1 p-3">
            <p className="mb-2 text-xl" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)', fontWeight: 600 }}>Sales History</p>
            <div className="rounded-lg border p-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <table className="w-full border-separate border-spacing-0 text-xs" style={{ fontFamily: 'var(--font-table)' }}>
                <thead>
                  <tr>
                    {['Sale #', 'Customer', 'Total'].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-bold uppercase" style={{ background: 'var(--th-bg)', color: 'var(--th-text)', fontFamily: 'var(--font-table)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['S-0001', 'Abel', '1,250.00'], ['S-0002', 'Walk-in', '480.50'], ['S-0003', 'Selam', '2,010.00']].map((r, i) => (
                    <tr key={r[0]} style={{ background: i % 2 === 0 ? 'var(--row-a)' : 'var(--row-b)' }}>
                      {r.map((c) => <td key={c} className="px-2 py-1.5" style={{ color: 'var(--text)', fontFamily: 'var(--font-table)' }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-primary btn-sm mt-2" tabIndex={-1}>Main button</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={save}>
          {saving ? 'Saving...' : 'Save look'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving || Object.keys(draft).length === 0} onClick={() => { setMsg(null); setDraft({}); }}>
          Back to default look
        </button>
        {dirty && !saving && <span className="text-sm text-amber-700">Not saved yet — only you see this right now.</span>}
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
