import React, { useEffect, useMemo, useState } from 'react';
import { listRoles, saveRoleHierarchy } from '../../api/roles.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';

/** All roles below `id` (so they cannot be picked as its boss: that would make a loop). */
function descendantsOf(id, parentOf) {
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    Object.entries(parentOf).forEach(([child, parent]) => {
      if (parent === cur && !out.has(child)) { out.add(child); stack.push(child); }
    });
  }
  return out;
}

function Box({ role }) {
  return (
    <div className={`min-w-[150px] max-w-[190px] rounded-xl border px-3 py-2 text-center shadow-sm ${role.superAdmin ? 'border-ink-900 bg-ink-900 text-white' : 'border-cream-300 bg-white text-ink-900'}`}>
      <div className="text-sm font-semibold leading-tight">{role.name}</div>
      <div className={`mt-0.5 text-[11px] ${role.superAdmin ? 'text-white/70' : 'text-ink-500'}`}>
        {role.userCount} user{role.userCount === 1 ? '' : 's'}{role.branchType ? ` · ${role.branchType.toLowerCase()}` : ''}
      </div>
    </div>
  );
}

/** One role and everything below it, drawn as a classic org chart (connector lines are plain borders). */
function Node({ role, childrenOf }) {
  const kids = childrenOf[role.id] || [];
  return (
    <li className="relative flex flex-col items-center px-2 pt-4 before:absolute before:left-0 before:top-0 before:h-4 before:w-1/2 before:border-r before:border-t before:border-ink-300 after:absolute after:right-0 after:top-0 after:h-4 after:w-1/2 after:border-t after:border-ink-300 first:before:border-0 last:after:border-0 only:before:hidden only:after:hidden">
      <Box role={role} />
      {kids.length > 0 && (
        <ul className="relative mt-0 flex pt-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:border-l before:border-ink-300">
          {kids.map((k) => <Node key={k.id} role={k} childrenOf={childrenOf} />)}
        </ul>
      )}
    </li>
  );
}

/**
 * Role Hierarchy. Pick, for every role, the role it reports to; the chart below redraws instantly.
 * The hierarchy is organisational (who is above whom): what a role may DO is still set on Roles & Permissions.
 */
export default function RoleHierarchyPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [roles, setRoles] = useState([]);
  const [parentOf, setParentOf] = useState({}); // roleId -> parent roleId | ''
  const [saved, setSaved] = useState({});
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const apply = (list) => {
    const map = Object.fromEntries(list.map((r) => [r.id, r.parentRoleId || '']));
    setRoles(list); setParentOf(map); setSaved(map);
  };

  useEffect(() => {
    listRoles().then((list) => { apply(list); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  }, []);

  const childrenOf = useMemo(() => {
    const m = {};
    roles.forEach((r) => {
      const p = parentOf[r.id];
      if (p) (m[p] = m[p] || []).push(r);
    });
    Object.values(m).forEach((l) => l.sort((a, b) => a.name.localeCompare(b.name)));
    return m;
  }, [roles, parentOf]);

  const tops = useMemo(() => roles.filter((r) => !parentOf[r.id])
    .sort((a, b) => (b.superAdmin - a.superAdmin) || a.name.localeCompare(b.name)), [roles, parentOf]);

  const dirty = JSON.stringify(parentOf) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const list = await saveRoleHierarchy(roles.map((r) => ({ roleId: r.id, parentRoleId: parentOf[r.id] || null })));
      apply(list); setMessage('Hierarchy saved.');
    } catch (e) { setError(extractErrorMessage(e)); } finally { setSaving(false); }
  };

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Role Hierarchy</h1>
          <p className="text-sm text-ink-500">Choose who each role reports to. The chart redraws as you change it. What each role can do is still set in Roles &amp; Permissions.</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            {dirty && <button type="button" className="rounded-lg border border-cream-300 px-3 py-2 text-sm" onClick={() => setParentOf(saved)}>Undo changes</button>}
            <button type="button" disabled={!dirty || saving} onClick={save} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save hierarchy'}</button>
          </div>
        )}
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && !dirty && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      {!isSuperAdmin && <div className="rounded-lg bg-cream-100 px-3 py-2 text-sm text-ink-600">Only a Super Admin can change the hierarchy.</div>}

      <section className="overflow-x-auto rounded-xl border border-cream-300 bg-white p-4">
        <ul className="mx-auto flex w-max min-w-full justify-center">
          {tops.map((r) => <Node key={r.id} role={r} childrenOf={childrenOf} />)}
        </ul>
      </section>

      <section className="rounded-xl border border-cream-300 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Who reports to whom</h2>
        <div className="divide-y divide-cream-200">
          {roles.map((r) => {
            const blocked = descendantsOf(r.id, parentOf);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div><span className="font-medium text-ink-900">{r.name}</span><span className="ml-2 text-xs text-ink-500">{r.userCount} user{r.userCount === 1 ? '' : 's'}</span></div>
                {r.superAdmin ? <span className="text-sm text-ink-500">Top of the company</span> : (
                  <label className="flex items-center gap-2 text-sm text-ink-600">Reports to
                    <select disabled={!isSuperAdmin} value={parentOf[r.id] || ''} onChange={(e) => setParentOf({ ...parentOf, [r.id]: e.target.value })} className="rounded-lg border border-cream-300 bg-white px-2 py-1.5 text-ink-900">
                      <option value="">— nobody (top level) —</option>
                      {roles.filter((o) => o.id !== r.id && !blocked.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
