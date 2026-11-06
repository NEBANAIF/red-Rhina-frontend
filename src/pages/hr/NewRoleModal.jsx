import React, { useEffect, useMemo, useState } from 'react';
import { getPermissionCatalog, createRole } from '../../api/roles.js';
import { extractErrorMessage } from '../../api/client.js';
import Modal from '../../components/Modal.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import { buildModules, moduleFitsBranchType } from '../roles/permissionModules.js';
import { ModuleCard } from '../roles/RolesPage.jsx';
import { Field } from './hrCommon.jsx';

/**
 * A small "create a role" form used from the Position form: a position that needs a system login gets its own role here
 * (only an Administrator may create roles). onCreated receives the new role.
 */
export default function NewRoleModal({ initialName = '', onClose, onCreated }) {
  const [catalog, setCatalog] = useState(null);
  const [f, setF] = useState({ name: initialName, description: '', branchType: 'STORE', canManageBranch: false, permissions: new Set() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getPermissionCatalog().then(setCatalog).catch((e) => setError(extractErrorMessage(e))); }, []);
  const modules = useMemo(() => buildModules(catalog ?? []), [catalog]);

  const toggleOne = (key) => {
    const next = new Set(f.permissions);
    if (next.has(key)) next.delete(key); else next.add(key);
    setF({ ...f, permissions: next });
  };
  const setGroup = (items, on) => {
    const next = new Set(f.permissions);
    items.forEach((p) => { if (on) next.add(p.key); else next.delete(p.key); });
    setF({ ...f, permissions: next });
  };
  const changeKind = (branchType) => {
    const allowed = new Set(modules.filter((m) => moduleFitsBranchType(m, branchType)).flatMap((m) => m.keys));
    const hidden = new Set(modules.filter((m) => !moduleFitsBranchType(m, branchType)).flatMap((m) => m.keys));
    setF({ ...f, branchType, permissions: new Set([...f.permissions].filter((k) => allowed.has(k) || !hidden.has(k))) });
  };

  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    if (f.permissions.size === 0) { setError('Tick at least one thing this role may do - a role with no permissions can log in but see nothing.'); return; }
    setSaving(true);
    try {
      const role = await createRole({ name: f.name.trim(), description: f.description.trim() || undefined, branchType: f.branchType, canManageBranch: f.canManageBranch, permissions: [...f.permissions] });
      onCreated(role);
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title="Create a role for this position" size="lg" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field text="Role name"><input required autoFocus maxLength={100} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field text="Description"><input maxLength={500} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field text="This role works at">
            <select className="input" value={f.branchType} onChange={(e) => changeKind(e.target.value)}>
              <option value="STORE">A store</option>
              <option value="WAREHOUSE">A warehouse</option>
              <option value="FACTORY">A factory</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-700 sm:pt-5">
            <input type="checkbox" checked={f.canManageBranch} onChange={(e) => setF({ ...f, canManageBranch: e.target.checked })} />
            Can be set as the manager of a branch
          </label>
        </div>
        <p className="text-xs text-ink-500">The kind of place is fixed once the role is created. What people in the role can do is the list below.</p>
        {!catalog ? <LoadingState /> : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {modules.filter((m) => moduleFitsBranchType(m, f.branchType)).map((m) => (
              <ModuleCard key={m.id} module={m} permissions={f.permissions} readOnly={false} onToggleAll={(on) => setGroup(m.items, on)} onToggleOne={toggleOne} />
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving || !catalog} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Create role and use it'}</button>
        </div>
      </form>
    </Modal>
  );
}
