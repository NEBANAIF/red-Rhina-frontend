import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getSettings, updateSettings } from '../../api/settings.js';
import { extractErrorMessage } from '../../api/client.js';
import LoadingState from '../../components/LoadingState.jsx';
import { useAppName } from '../../config/BrandContext.jsx';
import AppearanceCard from './AppearanceCard.jsx';
import LoginPageCard from './LoginPageCard.jsx';

export default function SettingsPage() {
  const { user, hasPermission } = useAuth();

  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { setAppName } = useAppName();
  const [nameDraft, setNameDraft] = useState('');
  const [nameMsg, setNameMsg] = useState(null); // { ok, text }

  useEffect(() => {
    getSettings()
      .then((res) => { setSettings(res); setNameDraft(res.appName || ''); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  }, []);

  const toggleSetting = async (key, checked) => {
    const previous = settings;
    setSettings({ ...settings, [key]: checked }); // optimistic
    setSaving(true);
    setError('');
    try {
      const saved = await updateSettings({ ...settings, [key]: checked });
      setSettings(saved);
    } catch (err) {
      setSettings(previous); // roll back
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveAppName = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNameMsg(null);
    try {
      const saved = await updateSettings({ ...settings, appName: nameDraft });
      setSettings(saved);
      setNameDraft(saved.appName);
      setAppName(saved.appName); // updates sidebar, login screen and browser tab straight away
      setNameMsg({ ok: true, text: 'App name saved.' });
    } catch (err) {
      setNameMsg({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const nameChanged = settings && nameDraft.trim() !== (settings.appName || '');

  return (
    <div>
      <h1 className="page-title mb-1">Settings</h1>
      <p className="mb-6 text-sm text-ink-500">Account and system information.</p>

      <div className="max-w-3xl space-y-4">
        <div className="card card-pad">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Your Account</p>
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={user?.name} />
            <Row label="Email" value={user?.email} />
            <Row label="Role" value={user?.roleName || user?.role?.replaceAll('_', ' ')} />
            <Row label="Branch" value={user?.branchName || 'All branches'} />
          </dl>
        </div>

        <div className="card card-pad">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">General</p>
          {status === 'ready' && (
            <form onSubmit={saveAppName}>
              <label className="block text-sm">
                <span className="font-medium text-ink-900">App name</span>
                <p className="mb-2 text-ink-500">
                  Shown on the login screen, the sidebar and the browser tab. Leave it empty to go back to
                  the default name.
                </p>
                <input
                  type="text"
                  className="input w-full"
                  maxLength={60}
                  placeholder="e.g. Betty"
                  value={nameDraft}
                  disabled={saving}
                  onChange={(e) => { setNameDraft(e.target.value); setNameMsg(null); }}
                />
              </label>
              <div className="mt-3 flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={saving || !nameChanged}>
                  {saving ? 'Saving...' : 'Save name'}
                </button>
                {nameMsg && (
                  <span className={`text-sm ${nameMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{nameMsg.text}</span>
                )}
              </div>
            </form>
          )}
        </div>

        {hasPermission('SETTINGS_MANAGE') && status === 'ready' && (
          <AppearanceCard settings={settings} onSaved={setSettings} />
        )}

        {hasPermission('SETTINGS_MANAGE') && status === 'ready' && (
          <LoginPageCard settings={settings} onSaved={setSettings} />
        )}

        <div className="card card-pad">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Inventory</p>

          {status === 'loading' && <LoadingState label="Loading settings..." />}
          {status === 'error' && <p className="text-sm text-red-600">{error}</p>}
          {status === 'ready' && (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.lockCostPrice}
                  disabled={saving}
                  onChange={(e) => toggleSetting('lockCostPrice', e.target.checked)}
                />
                <span>
                  <span className="font-medium text-ink-900">Lock cost price</span>
                  <p className="text-ink-500">
                    When on, the cost-price field on the New Product form is disabled, so whoever is adding
                    products can still record an opening quantity without needing to know the cost. The
                    stock is recorded at cost 0 until someone with stock-adjust access corrects it later.
                  </p>
                </span>
              </label>

              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.hideOutOfStockAtPos}
                  disabled={saving}
                  onChange={(e) => toggleSetting('hideOutOfStockAtPos', e.target.checked)}
                />
                <span>
                  <span className="font-medium text-ink-900">Hide out-of-stock products at POS</span>
                  <p className="text-ink-500">
                    When on, a product with zero stock at the branch making the sale won&apos;t show up when
                    searching for it in POS, so a cashier can&apos;t ring up something that isn&apos;t there.
                    Purchases, Batches and Transfers still show it — you need to find it there to restock it.
                  </p>
                </span>
              </label>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-700">{value || '—'}</dd>
    </div>
  );
}
