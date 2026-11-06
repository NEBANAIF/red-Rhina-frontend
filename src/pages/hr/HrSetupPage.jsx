import React, { useEffect, useState } from 'react';
import { listDepartments, saveDepartment, listShifts, saveShift, listPositions, savePosition, listEmployees, listLoginRoles } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import { Field, minutes, time } from './hrCommon.jsx';
import NewRoleModal from './NewRoleModal.jsx';

/** Departments (with parent and manager), positions and working shifts used by employees, the company hierarchy and attendance. */
export default function HrSetupPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('HR_MANAGE');
  const [departments, setDepartments] = useState(null);
  const [shifts, setShifts] = useState(null);
  const [positions, setPositions] = useState(null);
  const [edit, setEdit] = useState(null); // { kind: 'department' | 'shift', row? }
  const [error, setError] = useState('');

  const load = () => {
    listDepartments().then(setDepartments).catch((e) => setError(extractErrorMessage(e)));
    listShifts().then(setShifts).catch((e) => setError(extractErrorMessage(e)));
    listPositions().then(setPositions).catch((e) => setError(extractErrorMessage(e)));
  };
  useEffect(load, []);

  const link = (kind, row) => canManage && <button type="button" className="text-xs font-medium text-sage-600 hover:underline" onClick={() => setEdit({ kind, row })}>Edit</button>;

  return (
    <div>
      <h1 className="page-title mb-4">Departments & Shifts</h1>
      {error && <p className="alert alert-error mb-3">{error}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">Departments</h2>
            {canManage && <button className="btn btn-primary btn-sm" onClick={() => setEdit({ kind: 'department', row: null })}>+ Add</button>}
          </div>
          {!departments ? <LoadingState /> : (
            <DataTable
              columns={[
                { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
                { key: 'parentName', header: 'Part of', render: (r) => r.parentName ?? '—' },
                { key: 'managerName', header: 'Manager', render: (r) => r.managerName ?? <span className="text-amber-700">not assigned</span> },
                { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
                { key: 'edit', header: '', className: 'text-right', render: (r) => link('department', r) },
              ]}
              rows={departments} emptyMessage="No departments yet (e.g. Production, Sales, Warehouse)." />
          )}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">Shifts</h2>
            {canManage && <button className="btn btn-primary btn-sm" onClick={() => setEdit({ kind: 'shift', row: null })}>+ Add</button>}
          </div>
          {!shifts ? <LoadingState /> : (
            <DataTable
              columns={[
                { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
                { key: 'time', header: 'Hours', render: (r) => `${time(r.startTime)} – ${time(r.endTime)}` },
                { key: 'expectedMinutes', header: 'Normal work', render: (r) => minutes(r.expectedMinutes), className: 'text-right' },
                { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
                { key: 'edit', header: '', className: 'text-right', render: (r) => link('shift', r) },
              ]}
              rows={shifts} emptyMessage="No shifts yet. Without a shift a normal day counts 8 hours." />
          )}
        </div>
        <div className="card card-pad lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">Positions</h2>
            {canManage && <button className="btn btn-primary btn-sm" onClick={() => setEdit({ kind: 'position', row: null })}>+ Add</button>}
          </div>
          {!positions ? <LoadingState /> : (
            <DataTable
              columns={[
                { key: 'title', header: 'Position', render: (r) => <span className="font-medium text-ink-900">{r.title}</span> },
                { key: 'level', header: 'Level', render: (r) => LEVELS.find((l) => l.value === r.level)?.label ?? r.level },
                { key: 'departmentNames', header: 'Departments', render: (r) => (r.departmentNames?.length ? r.departmentNames.join(', ') : <span className="text-amber-700">None - edit</span>) },
                { key: 'accessRoleName', header: 'System login', render: (r) => (r.needsLogin ? r.accessRoleName : <span className="text-ink-400">Not needed</span>) },
                { key: 'description', header: 'Description', render: (r) => r.description ?? '—' },
                { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
                { key: 'edit', header: '', className: 'text-right', render: (r) => link('position', r) },
              ]}
              rows={positions} emptyMessage="No positions yet (e.g. Production Supervisor, Sales Lead). Employees are placed in one." />
          )}
        </div>
      </div>
      {edit?.kind === 'position' && <PositionModal row={edit.row} departments={departments ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {edit?.kind === 'department' && <DepartmentModal row={edit.row} departments={departments ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {edit?.kind === 'shift' && <ShiftModal row={edit.row} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function DepartmentModal({ row, departments, onClose, onSaved }) {
  const [f, setF] = useState({ name: row?.name ?? '', description: row?.description ?? '', active: row?.active ?? true, parentId: row?.parentId ?? '', managerId: row?.managerId ?? '' });
  const [people, setPeople] = useState([]);
  useEffect(() => { if (!row) return; listEmployees({ status: 'ACTIVE', departmentId: row.id, size: 500 }).then((d) => setPeople(d.content ?? [])).catch(() => {}); }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try { await saveDepartment(row?.id, { name: f.name.trim(), description: f.description.trim() || undefined, active: f.active, parentId: f.parentId || null, managerId: row ? (f.managerId || null) : null }); onSaved(); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };
  return (
    <Modal open title={row ? 'Edit department' : 'Add department'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field text="Name"><input required autoFocus maxLength={120} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field text="Description"><input maxLength={500} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field text="Part of department (optional)">
          <select className="input" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
            <option value="">— top level —</option>
            {departments.filter((d) => d.id !== row?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        {row ? (
          <Field text="Head of department (highest reporting level)">
            <select className="input" value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })}>
              <option value="">— not assigned —</option>
              {people.filter((p) => p.departmentId === row.id).map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.employeeNumber})</option>)}
            </select>
          </Field>
        ) : <p className="text-xs text-ink-500">After saving, add the department's employees, then edit the department to choose its head. Everyone without a manager then reports to the head.</p>}
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

const LEVELS = [
  { value: 'EXECUTIVE', label: 'Executive' }, { value: 'MANAGER', label: 'Manager' },
  { value: 'SUPERVISOR', label: 'Supervisor' }, { value: 'WORKER', label: 'Worker' },
];

function PositionModal({ row, departments, onClose, onSaved }) {
  const { user } = useAuth();
  const isAdministrator = user?.role === 'ADMINISTRATOR';
  const [roles, setRoles] = useState([]);
  const loadRoles = () => listLoginRoles().then(setRoles).catch(() => setRoles([]));
  useEffect(() => { loadRoles(); }, []);
  const [f, setF] = useState({
    level: row?.level ?? 'WORKER', needsLogin: Boolean(row?.accessRoleId), accessRoleId: row?.accessRoleId ?? '', title: row?.title ?? '',
    departmentIds: row?.departmentIds ?? [], description: row?.description ?? '', active: row?.active ?? true,
  });
  const [newRole, setNewRole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toggleDepartment = (id) => setF((cur) => ({ ...cur, departmentIds: cur.departmentIds.includes(id) ? cur.departmentIds.filter((x) => x !== id) : [...cur.departmentIds, id] }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.departmentIds.length === 0) { setError('Choose at least one department - every position belongs to a department.'); return; }
    if (f.needsLogin && !f.accessRoleId) { setError('This position needs a system login, so choose its role - or create a new role for it. If nobody in this position uses the system, untick the box.'); return; }
    setSaving(true);
    try {
      await savePosition(row?.id, { title: f.title.trim(), departmentIds: f.departmentIds, description: f.description.trim() || undefined, active: f.active, level: f.level, accessRoleId: f.needsLogin ? f.accessRoleId : null });
      onSaved();
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };
  return (
    <>
      <Modal open title={row ? 'Edit position' : 'Add position'} onClose={() => { if (!newRole) onClose(); }}>
        <form onSubmit={submit} className="space-y-3">
          <Field text="Title"><input required autoFocus maxLength={150} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-500">Departments (tick every department this position works in)</span>
            {departments.length === 0 ? <p className="text-sm text-amber-700">No departments yet - create a department first.</p> : (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-cream-300 p-2">
                {departments.filter((d) => d.active !== false || f.departmentIds.includes(d.id)).map((d) => (
                  <label key={d.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${f.departmentIds.includes(d.id) ? 'border-sage-600 bg-sage-50 text-ink-900' : 'border-cream-300 text-ink-700'}`}>
                    <input type="checkbox" checked={f.departmentIds.includes(d.id)} onChange={() => toggleDepartment(d.id)} /> {d.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <p className="-mt-1 text-xs text-ink-500">Most positions belong to one department. Tick more than one only when the job really crosses teams (for example a Sales Engineer in Sales and Technical). Each employee still sits in one main department, chosen from these.</p>
          <Field text="Level">
            <select className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          <p className="-mt-1 text-xs text-ink-500">The level orders the company chart: people report to somebody of a higher level.</p>
          <div className="rounded-lg border border-cream-300 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
              <input type="checkbox" checked={f.needsLogin} onChange={(e) => setF({ ...f, needsLogin: e.target.checked, accessRoleId: e.target.checked ? f.accessRoleId : '' })} />
              People in this position need a system login
            </label>
            {f.needsLogin ? (
              <div className="mt-2 space-y-2">
                <Field text="Role">
                  <select className="input" value={f.accessRoleId} onChange={(e) => { if (e.target.value === '__new') setNewRole(true); else setF({ ...f, accessRoleId: e.target.value }); }}>
                    <option value="">Choose a role…</option>
                    {roles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    {isAdministrator && <option value="__new">+ Create a new role for this position</option>}
                  </select>
                </Field>
                {!isAdministrator && <p className="text-xs text-ink-500">Only an Administrator can create a new role (Users &amp; Roles). Pick an existing one, or ask the Administrator.</p>}
                <p className="text-xs text-ink-500">Several positions can share one role. The role is pre-selected when a login is created for someone in this position.</p>
              </div>
            ) : <p className="mt-1 text-xs text-ink-500">Leave unticked for jobs that do not use the system (for example a cleaner or a machine operator). Those employees are not offered when you create a login.</p>}
          </div>
          <Field text="Description"><input maxLength={500} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      {newRole && (
        <NewRoleModal initialName={f.title.trim()} onClose={() => setNewRole(false)}
          onCreated={(role) => { loadRoles().then(() => { setF((cur) => ({ ...cur, accessRoleId: role.id })); setNewRole(false); }); }} />
      )}
    </>
  );
}

function ShiftModal({ row, onClose, onSaved }) {
  const [f, setF] = useState({ name: row?.name ?? '', startTime: row ? time(row.startTime) : '08:00', endTime: row ? time(row.endTime) : '17:00', breakMinutes: row?.breakMinutes ?? 60, active: row?.active ?? true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try { await saveShift(row?.id, { name: f.name.trim(), startTime: f.startTime, endTime: f.endTime, breakMinutes: Number(f.breakMinutes) || 0, active: f.active }); onSaved(); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };
  return (
    <Modal open title={row ? 'Edit shift' : 'Add shift'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field text="Name"><input required autoFocus maxLength={120} className="input" placeholder="e.g. Day shift" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field text="Starts"><input required type="time" className="input" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field text="Ends"><input required type="time" className="input" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
          <Field text="Unpaid break (min)"><input type="number" min="0" className="input" value={f.breakMinutes} onChange={(e) => setF({ ...f, breakMinutes: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-ink-500">A shift that ends before it starts (22:00 – 06:00) runs overnight.</p>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
