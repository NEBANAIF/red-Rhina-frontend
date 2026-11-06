import React, { useEffect, useState } from 'react';
import {
  listBranches, getBranchStats, createBranch, updateBranch, setBranchActive, assignBranchManager,
} from '../../api/branches.js';
import { searchUsers } from '../../api/users.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Badge from '../../components/Badge.jsx';
import { formatMoney } from '../../utils/format.js';
import Icon from '../../components/Icon.jsx';
import Pagination from '../../components/Pagination.jsx';
import useClientPagination from '../../utils/useClientPagination.js';

const COLUMNS = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
  { key: 'code', header: 'Code' },
  { key: 'type', header: 'Type', render: (r) => <Badge status={r.type} /> },
  { key: 'managerName', header: 'Manager', render: (r) => r.managerName || '—' },
  { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
];

/** Branch type is fixed at creation (see UpdateBranchRequest's javadoc on the backend) - never offered as an editable field here either. */
export default function BranchesPage() {
  const { hasPermission } = useAuth();
  const [branches, setBranches] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { page, setPage, pageRows, totalPages, totalElements } = useClientPagination(branches);

  const load = () => {
    setStatus('loading');
    listBranches()
      .then((res) => { setBranches(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };
  useEffect(load, []);

  const openBranch = (branch) => {
    setSelected(branch);
    setStats(null);
    setActionError('');
    getBranchStats(branch.id).then(setStats).catch(() => setStats('forbidden'));
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      const updated = await setBranchActive(selected.id, !selected.active);
      setSelected(updated);
      setDeactivateOpen(false);
      load();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">Branches</h1>
        {hasPermission('BRANCH_MANAGE') && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            + New Branch
          </button>
        )}
      </div>

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={pageRows} onRowClick={openBranch} emptyMessage="No branches yet." />
            <Pagination page={page} totalPages={totalPages} totalElements={totalElements} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected?.name} onClose={() => setSelected(null)} wide>
        {selected && (
          <BranchDetail
            branch={selected}
            stats={stats}
            busy={busy}
            actionError={actionError}
            onDeactivateClick={() => setDeactivateOpen(true)}
            onUpdated={(updated) => { setSelected(updated); load(); }}
            onManagerAssigned={(updated) => { setSelected(updated); load(); }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deactivateOpen}
        title={selected?.active ? 'Deactivate branch?' : 'Activate branch?'}
        description={selected?.active ? `${selected?.name} will stop appearing in the branch selector for new transactions. Its history is preserved.` : `${selected?.name} will become available again.`}
        confirmLabel={selected?.active ? 'Deactivate' : 'Activate'}
        danger={selected?.active}
        busy={busy}
        onConfirm={toggleActive}
        onCancel={() => setDeactivateOpen(false)}
      />

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function BranchDetail({ branch, stats, busy, actionError, onDeactivateClick, onUpdated, onManagerAssigned }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('BRANCH_MANAGE');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: branch.name, address: branch.address || '', phone: branch.phone || '', email: branch.email || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [managers, setManagers] = useState([]);
  const [managerId, setManagerId] = useState(branch.managerId || '');
  const [assigningManager, setAssigningManager] = useState(false);

  useEffect(() => {
    if (canManage) searchUsers({ branchId: branch.id, size: 100 }).then((res) => setManagers(res.content));
  }, [branch.id, canManage]);

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      onUpdated(await updateBranch(branch.id, form));
      setEditing(false);
    } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  const saveManager = async () => {
    setAssigningManager(true); setError('');
    try {
      onManagerAssigned(await assignBranchManager(branch.id, managerId || null));
    } catch (err) { setError(extractErrorMessage(err)); } finally { setAssigningManager(false); }
  };

  return (
    <div className="space-y-4 text-sm">
      {actionError && <p className="text-red-600">{actionError}</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!editing ? (
        <div className="space-y-2">
          <Row label="Code" value={branch.code} />
          <Row label="Type" value={branch.type} />
          <Row label="Address" value={branch.address || '—'} />
          <Row label="Phone" value={branch.phone || '—'} />
          <Row label="Email" value={branch.email || '—'} />
          {canManage && <button onClick={() => setEditing(true)} className="btn-icon" title="Edit branch details" aria-label="Edit branch details"><Icon name="edit" size={15} /></button>}
        </div>
      ) : (
        <form onSubmit={saveEdit} className="space-y-3">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {canManage && (
        <div className="border-t border-cream-200 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Manager</p>
          <p className="mb-2 text-xs text-ink-400">Only users already assigned to this branch can be its manager.</p>
          <div className="flex gap-2">
            <select className="input flex-1" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">Unassigned</option>
              {managers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={saveManager} disabled={assigningManager} className="btn btn-secondary btn-sm">
              {assigningManager ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-cream-200 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Live Stats (all time)</p>
        {stats === null && <p className="text-ink-400">Loading...</p>}
        {stats === 'forbidden' && <p className="text-ink-400">You don't have permission to view this branch's stats.</p>}
        {stats && stats !== 'forbidden' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Row label="Stock Units" value={stats.totalStockUnits} />
            <Row label="Inventory Value" value={formatMoney(stats.inventoryValue)} />
            <Row label="Sales" value={stats.totalSalesCount} />
            <Row label="Revenue" value={formatMoney(stats.totalRevenue)} />
            <Row label="Purchases" value={stats.totalPurchasesCount} />
            <Row label="Expenses" value={formatMoney(stats.totalExpenses)} />
            <Row label="Gross Profit" value={formatMoney(stats.grossProfit)} strong />
          </div>
        )}
      </div>

      {canManage && (
        <div className="border-t border-cream-200 pt-3">
          <button onClick={onDeactivateClick} className={`btn btn-sm ${branch.active ? 'border border-red-200 bg-cream-50 text-red-600 hover:border-red-300 hover:bg-red-50' : 'btn-secondary'}`}>
            {branch.active ? 'Deactivate Branch' : 'Activate Branch'}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className={strong ? 'font-semibold text-ink-900' : 'text-ink-700'}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>
      <input type={type} required={required} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CreateBranchModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm(blank()); setError(''); } }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await createBranch(form);
      onCreated();
    } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title="New Branch" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required />
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Type</span>
          <select required className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="STORE">Store</option>
            <option value="WAREHOUSE">Warehouse</option>
            <option value="FACTORY">Factory</option>
            <option value="SHOWROOM">Showroom</option>
          </select>
        </label>
        <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Creating...' : 'Create Branch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { name: '', code: '', type: 'STORE', address: '', phone: '', email: '' };
}
