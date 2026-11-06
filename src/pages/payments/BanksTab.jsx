import React, { useEffect, useState } from 'react';
import { listBanks, createBank, updateBank, setBankActive } from '../../api/banks.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Badge from '../../components/Badge.jsx';
import Icon from '../../components/Icon.jsx';

/**
 * The registered banks. Anyone with BANK_VIEW sees the table (account numbers included); only
 * BANK_MANAGE holders get the Register / Edit / Deactivate buttons. A bank is never deleted - past
 * payments refer to it - only switched off, which removes it from the payment dropdowns.
 */
export default function BanksTab() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('BANK_MANAGE');

  const [banks, setBanks] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // the bank being edited, or null when registering
  const [deactivating, setDeactivating] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setStatus('loading');
    listBanks()
      .then((rows) => { setBanks(rows); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(() => {
    load();
  }, []);

  const openForm = (bank) => {
    setEditing(bank);
    setFormOpen(true);
  };

  const changeStatus = async (bank, active) => {
    setBusy(true);
    setActionError('');
    try {
      await setBankActive(bank.id, active);
      setDeactivating(null);
      load();
    } catch (err) {
      setActionError(extractErrorMessage(err));
      setDeactivating(null);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Bank', primary: true, render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'accountNumber', header: 'Account number', render: (r) => <span className="tabular">{r.accountNumber}</span> },
    { key: 'accountName', header: 'Account name', render: (r) => r.accountName || '—' },
    { key: 'notes', header: 'Notes', hideOnMobile: true, render: (r) => r.notes || '—' },
    { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
    ...(canManage ? [{
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-icon" onClick={() => openForm(r)} title="Edit" aria-label="Edit bank"><Icon name="edit" size={15} /></button>
          {r.active ? (
            <button type="button" className="btn-icon-danger" onClick={() => setDeactivating(r)} title="Deactivate" aria-label="Deactivate bank"><Icon name="close" size={15} /></button>
          ) : (
            <button type="button" className="btn-icon" disabled={busy} onClick={() => changeStatus(r, true)} title="Activate" aria-label="Activate bank"><Icon name="check" size={15} /></button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-500">
          Banks payments are paid into. They appear in the bank dropdown at the POS and when recording a loan repayment.
        </p>
        {canManage && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openForm(null)}>
            + Register bank
          </button>
        )}
      </div>

      {actionError && <p className="alert alert-error mb-3">{actionError}</p>}

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'ready' && banks.length === 0 && (
        <EmptyState
          title="No banks registered yet"
          description={canManage ? 'Register a bank to make it available at the POS.' : 'An administrator can register one.'}
        />
      )}
      {status === 'ready' && banks.length > 0 && <DataTable columns={columns} rows={banks} />}

      <BankFormModal
        open={formOpen}
        bank={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deactivate this bank?"
        description={deactivating
          ? `"${deactivating.name}" will no longer appear in the payment dropdowns. Past payments keep their bank, and you can activate it again at any time.`
          : ''}
        confirmLabel="Deactivate"
        busy={busy}
        onConfirm={() => changeStatus(deactivating, false)}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}

/** Register when `bank` is null, edit otherwise. */
function BankFormModal({ open, bank, onClose, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(bank ? formFromBank(bank) : blankForm());
      setError('');
    }
  }, [open, bank]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        accountNumber: form.accountNumber,
        accountName: form.accountName || null,
        notes: form.notes || null,
      };
      if (bank) {
        await updateBank(bank.id, payload);
      } else {
        await createBank(payload);
      }
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={bank ? 'Edit bank' : 'Register bank'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label">Bank name</span>
          <input
            required
            autoFocus
            className="input"
            placeholder="For example: Commercial Bank of Ethiopia"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">Account number</span>
          <input
            required
            className="input"
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">Account name (optional)</span>
          <input
            className="input"
            placeholder="Who the account is in the name of"
            value={form.accountName}
            onChange={(e) => setForm({ ...form, accountName: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">Notes (optional)</span>
          <textarea
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        {error && <p className="alert alert-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : bank ? 'Save changes' : 'Register bank'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blankForm() {
  return { name: '', accountNumber: '', accountName: '', notes: '' };
}

function formFromBank(bank) {
  return {
    name: bank.name ?? '',
    accountNumber: bank.accountNumber ?? '',
    accountName: bank.accountName ?? '',
    notes: bank.notes ?? '',
  };
}
