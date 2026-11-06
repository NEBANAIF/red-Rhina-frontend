import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listRoles, getPermissionCatalog, createRole, updateRole, deleteRole } from '../../api/roles.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { buildModules, moduleFitsBranchType } from './permissionModules.js';

/**
 * Roles & Permissions. Every role - the five built-in ones and any you create - is a named set of
 * switches. Each switch is either "can open this page", "can do this action" or "can see this
 * information" (costs, profit, inventory value, dashboard panels...). The switches that exist are
 * defined by the system and listed here in groups; which role holds which is what you choose.
 *
 * Only an Administrator can change anything. The Administrator role itself always has every switch.
 */
export default function RolesPage() {
  const { user } = useAuth();
  const isAdministrator = user?.role === 'ADMINISTRATOR';

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null); // a role id, or 'new' while creating
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState('edit'); // 'edit' | 'chart'

  const load = async (selectId) => {
    try {
      const [roleList, permissionList] = await Promise.all([listRoles(), getPermissionCatalog()]);
      setRoles(roleList);
      setCatalog(permissionList);
      const toSelect = roleList.find((r) => r.id === selectId) || roleList[0] || null;
      if (toSelect) {
        setSelectedId(toSelect.id);
        setDraft(draftFromRole(toSelect));
      }
      setStatus('ready');
    } catch (err) {
      setError(extractErrorMessage(err));
      setStatus('error');
    }
  };

  useEffect(() => {
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One tick per area of the app (see permissionModules.js).
  const modules = useMemo(() => buildModules(catalog), [catalog]);

  const isNew = selectedId === 'new';
  const current = roles.find((r) => r.id === selectedId) || null; // null while creating
  const readOnly = !isAdministrator || Boolean(current && current.administrator);
  const nameEditable = isNew || Boolean(current && !current.systemRole);

  // ---- hierarchy (saved together with the permissions: one place, one definition)
  // the selected role is shown with its not-yet-saved "reports to", so the chart and levels follow the dropdown at once
  const parentOf = useMemo(() => {
    const m = {};
    roles.forEach((r) => { m[r.id] = r.id === selectedId && draft ? (draft.parentRoleId || '') : (r.parentRoleId || ''); });
    return m;
  }, [roles, selectedId, draft]);
  const childrenOf = useMemo(() => {
    const m = {};
    roles.forEach((r) => { const p = parentOf[r.id]; if (p) (m[p] = m[p] || []).push(r); });
    Object.values(m).forEach((l) => l.sort((a, b) => a.name.localeCompare(b.name)));
    return m;
  }, [roles, parentOf]);
  const levelOf = (id) => { let n = 0; const seen = new Set(); for (let p = parentOf[id]; p && !seen.has(p); p = parentOf[p]) { seen.add(p); n += 1; } return n; };
  const below = (id) => { const out = new Set(); const stack = [id]; while (stack.length) { (childrenOf[stack.pop()] || []).forEach((c) => { if (!out.has(c.id)) { out.add(c.id); stack.push(c.id); } }); } return out; };
  const parentChoices = roles.filter((r) => r.id !== selectedId && !below(selectedId).has(r.id));
  const parentRole = roles.find((r) => r.id === draft?.parentRoleId) || null;
  const beyondBoss = parentRole && draft ? [...draft.permissions].filter((k) => !new Set(parentRole.permissions).has(k)).length : 0;

  const dirty = isNew
    ? true
    : Boolean(draft && current && (
      draft.name !== current.name
      || (draft.description || '') !== (current.description || '')
      || !sameSet(draft.permissions, new Set(current.permissions))
      || (draft.parentRoleId || '') !== (current.parentRoleId || '')
    ));

  const selectRole = (role) => {
    setSelectedId(role.id);
    setDraft(draftFromRole(role));
    setFormError('');
    setNotice('');
  };

  const startNew = () => {
    setSelectedId('new');
    setDraft(newDraft(roles.find((r) => r.administrator)?.id || ''));
    setFormError('');
    setNotice('');
  };

  const discard = () => {
    if (isNew) {
      if (roles[0]) selectRole(roles[0]);
    } else if (current) {
      selectRole(current);
    }
  };

  const togglePermission = (key) => {
    const next = new Set(draft.permissions);
    if (next.has(key)) next.delete(key); else next.add(key);
    setDraft({ ...draft, permissions: next });
  };

  const setGroup = (items, on) => {
    const next = new Set(draft.permissions);
    items.forEach((p) => { if (on) next.add(p.key); else next.delete(p.key); });
    setDraft({ ...draft, permissions: next });
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        branchType: draft.branchType,
        canManageBranch: draft.canManageBranch,
        permissions: [...draft.permissions],
        parentRoleId: draft.parentRoleId || undefined,
      };
      const saved = isNew ? await createRole(payload) : await updateRole(selectedId, payload);
      await load(saved.id);
      setNotice(isNew
        ? 'Role created. You can now assign it to users on the Users page.'
        : 'Saved. The change applies the next time each person reloads the page or signs in.');
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    setFormError('');
    try {
      await deleteRole(selectedId);
      setConfirmDelete(false);
      await load(null);
      setNotice('Role deleted.');
    } catch (err) {
      setConfirmDelete(false);
      setFormError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState message={error} onRetry={() => load(selectedId)} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Roles &amp; Permissions</h1>
          <p className="text-sm text-ink-500">
            Choose what each role can open, do and see. A change applies the next time a person reloads the page or signs in.
          </p>
        </div>
        {isAdministrator && (
          <button
            onClick={startNew}
            className="btn btn-primary btn-sm"
          >
            + New role
          </button>
        )}
      </div>

      {!isAdministrator && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Only an Administrator can change roles. You can look at them here.
        </p>
      )}

      <div className="mb-3 flex gap-1 border-b border-cream-300 text-sm">
        {[['edit', 'Roles & permissions'], ['chart', 'Hierarchy chart']].map(([k, t]) => (
          <button key={k} type="button" onClick={() => setView(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 font-medium ${view === k ? 'border-sage-600 text-sage-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>{t}</button>
        ))}
      </div>

      {view === 'chart' && (
        <div className="card card-pad overflow-x-auto">
          <ul className="mx-auto flex w-max min-w-full justify-center">
            {roles.filter((r) => !parentOf[r.id]).sort((a, b) => (b.administrator - a.administrator) || a.name.localeCompare(b.name))
              .map((r) => <RoleChartNode key={r.id} role={r} childrenOf={childrenOf} onPick={(role) => { selectRole(role); setView('edit'); }} />)}
          </ul>
          <p className="mt-3 text-xs text-ink-400">Click a role to edit it. Who is above whom is set with "Reports to" in the role's editor, together with its permissions.</p>
        </div>
      )}

      <div className={`grid gap-4 lg:grid-cols-[260px_1fr] ${view === 'chart' ? 'hidden' : ''}`}>
        <div className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role)}
              className={`block w-full rounded-xl border px-3 py-2 text-left transition ${
                selectedId === role.id ? 'border-brand-500 bg-cream-100' : 'border-cream-300 bg-cream-50 hover:bg-cream-50'
              }`}
            >
              <p className="text-sm font-medium text-ink-900">{role.name}</p>
              <p className="text-xs text-ink-500">
                Level {levelOf(role.id) + 1} · {role.systemRole ? 'Built-in' : 'Custom'} · {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
              </p>
            </button>
          ))}
          {isNew && (
            <div className="rounded-xl border border-brand-500 bg-cream-100 px-3 py-2">
              <p className="text-sm font-medium text-ink-900">{draft?.name || 'New role'}</p>
              <p className="text-xs text-ink-500">Not saved yet</p>
            </div>
          )}
        </div>

        {draft && (
          <div className="card card-pad space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Role name</span>
                <input
                  className="input"
                  value={draft.name}
                  disabled={readOnly || !nameEditable}
                  placeholder="For example: Cashier"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Description (optional)</span>
                <input
                  className="input"
                  value={draft.description}
                  disabled={readOnly || !nameEditable}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
            </div>

            {!(current && current.administrator) && (
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">Reports to (the role above this one){!isNew && ` · this role is at level ${levelOf(selectedId) + 1}`}</span>
                  <select className="input sm:max-w-sm" disabled={readOnly} value={draft.parentRoleId} onChange={(e) => setDraft({ ...draft, parentRoleId: e.target.value })}>
                    {parentChoices.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                {beyondBoss > 0 && (
                  <p className="mt-1 text-xs text-amber-700">Heads-up: this role can do {beyondBoss} thing{beyondBoss === 1 ? '' : 's'} that "{parentRole.name}" above it cannot.</p>
                )}
              </div>
            )}

            {isNew ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">This role works at</span>
                  <select
                    className="input"
                    value={draft.branchType}
                    onChange={(e) => {
                      const branchType = e.target.value;
                      // drop switches of areas that do not fit the newly chosen kind of place
                      const allowed = new Set(modules.filter((m) => moduleFitsBranchType(m, branchType)).flatMap((m) => m.keys));
                      const hidden = new Set(modules.filter((m) => !moduleFitsBranchType(m, branchType)).flatMap((m) => m.keys));
                      const permissions = new Set([...draft.permissions].filter((k) => allowed.has(k) || !hidden.has(k)));
                      setDraft({ ...draft, branchType, permissions });
                    }}
                  >
                    <option value="STORE">A store</option>
                    <option value="WAREHOUSE">A warehouse</option>
                    <option value="FACTORY">A factory</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700 sm:pt-5">
                  <input
                    type="checkbox"
                    checked={draft.canManageBranch}
                    onChange={(e) => setDraft({ ...draft, canManageBranch: e.target.checked })}
                  />
                  Can be set as the manager of a branch
                </label>
                <p className="text-xs text-ink-400 sm:col-span-2">
                  This is fixed once the role is created. It only decides which kind of branch people in this role
                  can be placed in - what they can do is the list below.
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-500">
                {current && current.administrator
                  ? 'Full access to everything, in every branch. This role cannot be changed.'
                  : `Works at a ${current && current.branchType ? current.branchType.toLowerCase() : 'branch'}`
                    + `${current && current.canManageBranch ? ' and can be set as a branch manager' : ''}.`}
              </p>
            )}

            {!(current && current.administrator) && (
              <div className="space-y-3">
                <p className="text-sm text-ink-600">
                  Tick an area to give everything in it, or tick only the pages and actions you want inside it.
                  Each page (for example Inventory, Batches, Stock History) has its own tick.
                </p>
                {modules
                  // Show the areas that fit this kind of role - plus any area the role already holds a switch from,
                  // so an old switch can still be unticked.
                  .filter((m) => moduleFitsBranchType(m, draft.branchType) || m.keys.some((k) => draft.permissions.has(k)))
                  .map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    permissions={draft.permissions}
                    readOnly={readOnly}
                    onToggleAll={(on) => setGroup(m.items, on)}
                    onToggleOne={togglePermission}
                  />
                ))}
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {notice && <p className="text-sm text-emerald-700">{notice}</p>}

            {!readOnly && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div>
                  {current && !current.systemRole && (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={current.userCount > 0}
                        className="btn btn-sm border border-red-200 bg-cream-50 text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        Delete role
                      </button>
                      {current.userCount > 0 && (
                        <span className="ml-2 text-xs text-ink-400">Move its users to another role first.</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={discard}
                    className="btn btn-secondary btn-sm"
                  >
                    {isNew ? 'Cancel' : 'Discard changes'}
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !dirty || !draft.name.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? 'Saving...' : isNew ? 'Create role' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this role?"
        description={current ? `"${current.name}" will be removed. Nobody is using it, so no one loses access.` : ''}
        confirmLabel="Delete"
        busy={saving}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function draftFromRole(role) {
  return {
    name: role.name,
    description: role.description || '',
    branchType: role.branchType || 'STORE',
    canManageBranch: Boolean(role.canManageBranch),
    permissions: new Set(role.permissions),
    parentRoleId: role.parentRoleId || '',
  };
}

function newDraft(parentRoleId = '') {
  return { name: '', description: '', branchType: 'STORE', canManageBranch: false, permissions: new Set(), parentRoleId };
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/** One area of the app: a single tick for the whole area, with optional fine-tuning of each switch. */
export function ModuleCard({ module: m, permissions, readOnly, onToggleAll, onToggleOne }) {
  const [open, setOpen] = useState(true);
  const boxRef = useRef(null);
  const on = m.items.filter((p) => permissions.has(p.key)).length;
  const all = on === m.items.length;
  const some = on > 0 && !all;
  const expandable = m.items.length > 1; // a single-item area has nothing to pick inside

  useEffect(() => { if (boxRef.current) boxRef.current.indeterminate = some; }, [some]);

  return (
    <div className={`rounded-lg border p-3 ${all ? 'border-brand-500 bg-cream-100' : 'border-cream-300'}`}>
      <div className="flex items-start gap-3">
        <input
          ref={boxRef}
          type="checkbox"
          className="mt-1 h-4 w-4"
          aria-label={m.label}
          checked={all}
          disabled={readOnly}
          onChange={(e) => onToggleAll(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {m.label} <span className="ml-1 text-xs font-normal text-ink-400">{on} of {m.items.length}</span>
          </p>
          <p className="text-xs text-ink-500">{m.description}</p>
          {m.pages.length > 0 && <p className="mt-0.5 text-xs text-ink-400">Opens: {m.pages.join(', ')}</p>}
        </div>
        {expandable && <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-xs text-sage-600 hover:underline">
          {open ? 'Hide' : 'Show pages & actions'}
        </button>}
      </div>

      {expandable && open && (
        <div className="mt-3 space-y-3 border-t border-cream-200 pt-3 pl-7">
          {m.pageItems.length > 0 && (
            <SwitchGroup
              title="Pages"
              hint="Each one lets the role open that page."
              items={m.pageItems}
              permissions={permissions}
              readOnly={readOnly}
              onToggleOne={onToggleOne}
            />
          )}
          {m.actionItems.length > 0 && (
            <SwitchGroup
              title={m.pageItems.length > 0 ? 'Actions' : null}
              hint={m.pageItems.length > 0 ? 'What the role can do on those pages.' : null}
              items={m.actionItems}
              permissions={permissions}
              readOnly={readOnly}
              onToggleOne={onToggleOne}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** A titled list of single switches inside an area card. */
function SwitchGroup({ title, hint, items, permissions, readOnly, onToggleOne }) {
  return (
    <div className="space-y-2">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {title}
          {hint && <span className="ml-2 font-normal normal-case tracking-normal text-ink-400">{hint}</span>}
        </p>
      )}
      {items.map((p) => (
        <label key={p.key} className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={permissions.has(p.key)}
            disabled={readOnly}
            onChange={() => onToggleOne(p.key)}
          />
          <span>
            <span className="text-sm text-slate-800">{p.label}</span>
            <span className="block text-xs text-ink-500">{p.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** One role in the hierarchy chart: its name, level and the people who hold it, with the roles that report to it below. */
function RoleChartNode({ role, childrenOf, onPick }) {
  const kids = childrenOf[role.id] || [];
  const people = role.members || [];
  return (
    <li className="relative flex flex-col items-center px-2 pt-4 before:absolute before:left-0 before:top-0 before:h-4 before:w-1/2 before:border-r before:border-t before:border-ink-300 after:absolute after:right-0 after:top-0 after:h-4 after:w-1/2 after:border-t after:border-ink-300 first:before:border-0 last:after:border-0 only:before:hidden only:after:hidden">
      <button type="button" onClick={() => onPick(role)}
        className={`min-w-[150px] max-w-[200px] rounded-xl border px-3 py-2 text-center shadow-sm transition hover:shadow ${role.administrator ? 'border-ink-900 bg-ink-900 text-white' : 'border-cream-300 bg-white text-ink-900'}`}>
        <div className="text-sm font-semibold leading-tight">{role.name}</div>
        <div className={`mt-0.5 text-[11px] ${role.administrator ? 'text-white/70' : 'text-ink-500'}`}>{role.userCount} {role.userCount === 1 ? 'user' : 'users'}</div>
        {people.length > 0 && (
          <div className={`mt-1 text-[10px] leading-tight ${role.administrator ? 'text-white/80' : 'text-ink-400'}`}>
            {people.slice(0, 4).join(', ')}{people.length > 4 ? ` +${people.length - 4}` : ''}
          </div>
        )}
      </button>
      {kids.length > 0 && (
        <ul className="relative flex pt-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:border-l before:border-ink-300">
          {kids.map((k) => <RoleChartNode key={k.id} role={k} childrenOf={childrenOf} onPick={onPick} />)}
        </ul>
      )}
    </li>
  );
}
