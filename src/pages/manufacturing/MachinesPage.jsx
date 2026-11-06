import React, { useEffect, useState } from 'react';
import { listMachines, getMachine, createMachine, updateMachine, recordMaintenance } from '../../api/manufacturing.js';
import { listBranches } from '../../api/branches.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import Icon from '../../components/Icon.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';

const STATUSES = ['OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE'];
const statusLabel = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const TYPES = ['PREVENTIVE', 'REPAIR', 'INSPECTION'];
const typeLabel = (t) => t.charAt(0) + t.slice(1).toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS = [
  { key: 'name', header: 'Machine', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
  { key: 'code', header: 'Code' },
  { key: 'branchName', header: 'Factory' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'lastMaintenanceDate', header: 'Last service', render: (r) => (r.lastMaintenanceDate ? formatDate(r.lastMaintenanceDate) : '—') },
  {
    key: 'nextMaintenanceDue', header: 'Next service due',
    render: (r) => (r.nextMaintenanceDue
      ? <span className={r.maintenanceOverdue ? 'font-medium text-red-600' : ''}>{formatDate(r.nextMaintenanceDue)}{r.maintenanceOverdue ? ' – overdue' : ''}</span>
      : '—'),
  },
];

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}
function Row({ label, value }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-ink-400">{label}</span><span className="text-right text-ink-700">{value}</span></div>;
}

/** Machines and production lines, their status, and the maintenance history. */
export default function MachinesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canManage = hasPermission('MACHINE_MANAGE');
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [formFor, setFormFor] = useState(undefined); // undefined closed, null new, object edit
  const [maintFor, setMaintFor] = useState(null);
  const [notice, setNotice] = useState('');

  const load = () => {
    setStatus('loading');
    listMachines(scopeParams).then((d) => { setRows(d); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  };
  useEffect(load, [scopeParams.scope, scopeParams.branchId]);

  const open = (row) => getMachine(row.id).then(setSelected).catch((e) => setError(extractErrorMessage(e)));
  const down = (rows || []).filter((m) => m.status !== 'OPERATIONAL').length;
  const overdue = (rows || []).filter((m) => m.maintenanceOverdue).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Machines &amp; Maintenance</h1>
        {canManage && <button onClick={() => setFormFor(null)} className="btn btn-primary btn-sm">+ Add Machine</button>}
      </div>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}
      {rows && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <KpiCard index={0} label="Machines" value={String(rows.length)} />
          <KpiCard index={1} label="Not operational" value={String(down)} warn={down > 0} />
          <KpiCard index={2} label="Service overdue" value={String(overdue)} warn={overdue > 0} />
        </div>
      )}
      <div className="card card-pad">
        {status === 'loading' && !rows && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {rows && status !== 'error' && <DataTable columns={COLUMNS} rows={rows} onRowClick={open} emptyMessage="No machines yet. Add the machines and production lines of your factory." />}
      </div>

      <Modal open={!!selected} title={selected ? selected.name : ''} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4 text-sm">
            <Row label="Code" value={selected.code} />
            <Row label="Factory" value={selected.branchName} />
            <Row label="Status" value={<Badge status={selected.status} />} />
            {selected.description && <Row label="Description" value={selected.description} />}
            <Row label="Installed" value={selected.installedDate ? formatDate(selected.installedDate) : '—'} />
            <Row label="Service every" value={selected.serviceIntervalDays ? `${selected.serviceIntervalDays} days` : 'not scheduled'} />
            <Row label="Last service" value={selected.lastMaintenanceDate ? formatDate(selected.lastMaintenanceDate) : '—'} />
            <Row label="Next service due" value={selected.nextMaintenanceDue ? `${formatDate(selected.nextMaintenanceDue)}${selected.maintenanceOverdue ? ' (overdue)' : ''}` : '—'} />
            {selected.notes && <Row label="Notes" value={selected.notes} />}

            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Maintenance history</p>
              {selected.history.length === 0 ? <p className="text-ink-400">No maintenance recorded yet.</p> : (
                <div className="space-y-2">
                  {selected.history.map((h) => (
                    <div key={h.id} className="rounded-lg bg-cream-100 p-2">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium text-ink-800">{typeLabel(h.maintenanceType)} · {formatDate(h.maintenanceDate)}</span>
                        <span className="text-ink-600">{formatMoney(h.cost)}</span>
                      </div>
                      <p className="text-ink-600">{h.description}</p>
                      <p className="text-xs text-ink-400">{[h.technician, h.downtimeHours != null ? `${h.downtimeHours} h downtime` : null, `by ${h.createdByName}`].filter(Boolean).join(' · ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage && (
              <div className="flex justify-end gap-2 border-t border-cream-200 pt-3">
                <button onClick={() => setFormFor(selected)} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"><Icon name="edit" size={14} /> Edit</button>
                <button onClick={() => setMaintFor(selected)} className="btn btn-primary btn-sm">Record maintenance</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {formFor !== undefined && (
        <MachineFormModal machine={formFor} onClose={() => setFormFor(undefined)}
          onSaved={(saved, wasNew) => { setFormFor(undefined); setSelected(wasNew ? null : saved); setNotice(wasNew ? 'Machine added.' : 'Changes saved.'); load(); }} />
      )}
      {maintFor && (
        <MaintenanceModal machine={maintFor} onClose={() => setMaintFor(null)}
          onSaved={(saved) => { setMaintFor(null); setSelected(saved); setNotice('Maintenance recorded.'); load(); }} />
      )}
    </div>
  );
}

function MachineFormModal({ machine, onClose, onSaved }) {
  const editing = !!machine;
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    name: machine?.name ?? '', code: machine?.code ?? '', description: machine?.description ?? '', branchId: machine?.branchId ?? '',
    status: machine?.status ?? 'OPERATIONAL', installedDate: machine?.installedDate ?? '', serviceIntervalDays: machine?.serviceIntervalDays ?? '', notes: machine?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    listBranches('FACTORY').then((list) => {
      const arr = Array.isArray(list) ? list : (list?.content ?? []);
      setBranches(arr);
      if (!machine && arr.length === 1) setForm((f) => ({ ...f, branchId: arr[0].id }));
    }).catch(() => {});
  }, [machine]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(), code: form.code.trim(), description: form.description.trim() || undefined, branchId: form.branchId,
      status: form.status, installedDate: form.installedDate || undefined,
      serviceIntervalDays: form.serviceIntervalDays === '' ? undefined : Number(form.serviceIntervalDays), notes: form.notes.trim() || undefined,
    };
    try {
      const saved = editing ? await updateMachine(machine.id, payload) : await createMachine(payload);
      onSaved(saved, !editing);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? 'Edit Machine' : 'Add Machine'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name"><input required maxLength={200} className="input" placeholder="e.g. Packaging line 1" value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Code / tag"><input required maxLength={60} className="input" value={form.code} onChange={(e) => set({ code: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Factory / branch">
            <select required className="input" value={form.branchId} onChange={(e) => set({ branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Installed on (optional)"><input type="date" className="input" value={form.installedDate} onChange={(e) => set({ installedDate: e.target.value })} /></Field>
          <Field label="Service every (days, optional)"><input type="number" min="1" className="input" placeholder="e.g. 90" value={form.serviceIntervalDays} onChange={(e) => set({ serviceIntervalDays: e.target.value })} /></Field>
        </div>
        <Field label="Description (optional)"><input maxLength={500} className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Notes (optional)"><textarea rows={2} maxLength={1000} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : editing ? 'Save changes' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MaintenanceModal({ machine, onClose, onSaved }) {
  const [form, setForm] = useState({ maintenanceType: 'PREVENTIVE', maintenanceDate: today(), description: '', cost: '', technician: '', downtimeHours: '', backInService: machine.status !== 'OPERATIONAL' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      onSaved(await recordMaintenance(machine.id, {
        maintenanceType: form.maintenanceType, maintenanceDate: form.maintenanceDate, description: form.description.trim(),
        cost: form.cost === '' ? 0 : Number(form.cost), technician: form.technician.trim() || undefined,
        downtimeHours: form.downtimeHours === '' ? undefined : Number(form.downtimeHours), backInService: form.backInService,
      }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Record maintenance – ${machine.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select className="input" value={form.maintenanceType} onChange={(e) => set({ maintenanceType: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
          </Field>
          <Field label="Date done"><input required type="date" max={today()} className="input" value={form.maintenanceDate} onChange={(e) => set({ maintenanceDate: e.target.value })} /></Field>
        </div>
        <Field label="What was done"><input required maxLength={500} className="input" placeholder="e.g. replaced belt, lubricated bearings" value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Cost"><input type="number" min="0" step="0.01" className="input" value={form.cost} onChange={(e) => set({ cost: e.target.value })} /></Field>
          <Field label="Technician / company"><input maxLength={200} className="input" value={form.technician} onChange={(e) => set({ technician: e.target.value })} /></Field>
          <Field label="Downtime (hours)"><input type="number" min="0" className="input" value={form.downtimeHours} onChange={(e) => set({ downtimeHours: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={form.backInService} onChange={(e) => set({ backInService: e.target.checked })} />
          Machine is back in service (set to Operational)
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Record'}</button>
        </div>
      </form>
    </Modal>
  );
}
