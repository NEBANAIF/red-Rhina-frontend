import React, { useEffect, useState } from 'react';
import { searchDebts, getDebt, getDebtSummary, createDebt, updateDebt, recordDebtPayment } from '../../api/debts.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Icon from '../../components/Icon.jsx';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';

// "Still owing" (the default) hides fully paid debts; nothing is deleted - pick "All" or "Paid" to see them.
const OUTSTANDING = 'OUTSTANDING';
const STATUS_FILTERS = [OUTSTANDING, '', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
const statusLabel = (s) => (s === OUTSTANDING ? 'Still owing (default)' : s === '' ? 'All (incl. paid / cancelled)' : s.replace(/_/g, ' '));
const statusParams = (s) => {
  if (s === OUTSTANDING) return { outstandingOnly: true };
  if (s === 'OVERDUE') return { overdueOnly: true };
  return { status: s || undefined };
};

const TYPES = ['BANK_LOAN', 'SUPPLIER_CREDIT', 'PERSONAL', 'OTHER'];
const typeLabel = (t) => ({ BANK_LOAN: 'Bank loan', SUPPLIER_CREDIT: 'Supplier credit', PERSONAL: 'Borrowed from a person', OTHER: 'Other' }[t] || t);
const PAYMENT_METHODS = ['CASH', 'BANK'];
const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS = [
  { key: 'lenderName', header: 'Lender', render: (r) => <span className="font-medium text-ink-900">{r.lenderName}</span> },
  { key: 'debtType', header: 'Type', render: (r) => typeLabel(r.debtType) },
  { key: 'totalAmount', header: 'To repay', render: (r) => formatMoney(r.totalAmount), className: 'text-right' },
  { key: 'remainingAmount', header: 'Still owed', render: (r) => formatMoney(r.remainingAmount), className: 'text-right' },
  { key: 'dueDate', header: 'Due', render: (r) => (r.dueDate ? formatDate(r.dueDate) : '—') },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.overdue ? 'OVERDUE' : r.status} /> },
];

/** The business's OWN credits and loans - money it owes to banks, suppliers and people. Customer loans live on the Loans page. */
export default function DebtsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('DEBT_MANAGE');

  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState(OUTSTANDING);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [formFor, setFormFor] = useState(undefined); // undefined = closed, null = new, object = edit
  const [payOpen, setPayOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    setStatus('loading');
    Promise.all([
      searchDebts({ ...statusParams(statusFilter), type: typeFilter || undefined, search: search || undefined, page }),
      getDebtSummary(),
    ])
      .then(([list, sum]) => { setData(list); setSummary(sum); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, typeFilter, search]);

  const openDebt = (row) => {
    getDebt(row.id).then(setSelected).catch((err) => setError(extractErrorMessage(err)));
  };

  const filtersActive = statusFilter !== OUTSTANDING || typeFilter || search;
  const clearFilters = () => { setPage(0); setStatusFilter(OUTSTANDING); setTypeFilter(''); setSearch(''); };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">My Credits &amp; Loans</h1>
        {canManage && (
          <button onClick={() => setFormFor(null)} className="btn btn-primary btn-sm">+ New Credit / Loan</button>
        )}
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">Money your business owes to banks, suppliers and other people. Customer credit is on the Loans page.</p>

      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} label="Still owed" value={formatMoney(summary.totalRemaining)} warn={summary.totalRemaining > 0} hint={`${summary.openCount} open`} />
          <KpiCard index={1} label="Overdue" value={formatMoney(summary.overdueRemaining)} warn={summary.overdueCount > 0} hint={`${summary.overdueCount} overdue`} />
          <KpiCard index={2} label="Total borrowed" value={formatMoney(summary.totalBorrowed)} />
          <KpiCard index={3} label="Total repaid" value={formatMoney(summary.totalPaid)} emphasize />
        </div>
      )}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Lender</span>
            <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Search lender or note…" width="w-full sm:w-64" />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Status</span>
            <ElegantSelect value={statusFilter} onChange={(v) => { setPage(0); setStatusFilter(v); }} ariaLabel="Filter by status" minWidth={170}>
              {STATUS_FILTERS.map((s) => <option key={s || 'all'} value={s}>{statusLabel(s)}</option>)}
            </ElegantSelect>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Type</span>
            <ElegantSelect value={typeFilter} onChange={(v) => { setPage(0); setTypeFilter(v); }} ariaLabel="Filter by type" minWidth={170}>
              <option value="">All types</option>
              {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </ElegantSelect>
          </label>
          {filtersActive && <button onClick={clearFilters} className="btn btn-secondary btn-sm">Clear filters</button>}
        </div>

        {status === 'loading' && !data && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && status !== 'error' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={openDebt} emptyMessage="No credits or loans found." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected ? selected.lenderName : ''} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4 text-sm">
            <Row label="Type" value={typeLabel(selected.debtType)} />
            {selected.purchaseOrderNumber && <Row label="Purchase order" value={selected.purchaseOrderNumber} />}
            {selected.description && <Row label="Description" value={selected.description} />}
            <Row label="Amount borrowed" value={formatMoney(selected.principalAmount)} />
            {selected.interestAmount > 0 && <Row label="Interest / fees" value={formatMoney(selected.interestAmount)} />}
            <Row label="Total to repay" value={formatMoney(selected.totalAmount)} />
            <Row label="Repaid so far" value={formatMoney(selected.paidAmount)} />
            <Row label="Still owed" value={formatMoney(selected.remainingAmount)} strong />
            <Row label="Started" value={formatDate(selected.startDate)} />
            <Row label="Due date" value={selected.dueDate ? formatDate(selected.dueDate) : '—'} />
            <Row label="Status" value={<Badge status={selected.overdue ? 'OVERDUE' : selected.status} />} />
            {selected.notes && <Row label="Notes" value={selected.notes} />}

            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Repayment History</p>
              {selected.payments.length === 0 ? (
                <p className="text-ink-400">No repayments recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {selected.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <span className="text-ink-500">
                        {formatDate(p.paymentDate)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}
                      </span>
                      <span className="shrink-0 font-medium text-slate-800">{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage && selected.status !== 'CANCELLED' && (
              <div className="flex justify-end gap-2 border-t border-cream-200 pt-3">
                <button onClick={() => setFormFor(selected)} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5">
                  <Icon name="edit" size={14} /> Edit
                </button>
                {selected.status !== 'PAID' && (
                  <button onClick={() => setPayOpen(true)} className="btn btn-primary btn-sm">Record Repayment</button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {formFor !== undefined && (
        <DebtFormModal
          debt={formFor}
          onClose={() => setFormFor(undefined)}
          onSaved={(saved, wasNew) => {
            setFormFor(undefined);
            setSelected(wasNew ? null : saved);
            setNotice(wasNew ? 'Credit / loan added.' : 'Changes saved.');
            load();
          }}
        />
      )}

      {payOpen && selected && (
        <PayDebtModal
          debt={selected}
          onClose={() => setPayOpen(false)}
          onPaid={(updated) => { setPayOpen(false); setSelected(updated); setNotice('Repayment recorded.'); load(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-400">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}

/** Add a new credit/loan, or edit an existing one (debt = null for new). */
function DebtFormModal({ debt, onClose, onSaved }) {
  const editing = !!debt;
  const [form, setForm] = useState({
    lenderName: debt?.lenderName ?? '',
    debtType: debt?.debtType ?? 'BANK_LOAN',
    description: debt?.description ?? '',
    principalAmount: debt?.principalAmount ?? '',
    interestAmount: debt?.interestAmount ?? '',
    startDate: debt?.startDate ?? today(),
    dueDate: debt?.dueDate ?? '',
    notes: debt?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const total = (Number(form.principalAmount) || 0) + (Number(form.interestAmount) || 0);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      lenderName: form.lenderName.trim(),
      debtType: form.debtType,
      description: form.description.trim() || undefined,
      principalAmount: Number(form.principalAmount),
      interestAmount: form.interestAmount === '' ? 0 : Number(form.interestAmount),
      startDate: form.startDate,
      dueDate: form.dueDate || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      const saved = editing ? await updateDebt(debt.id, payload) : await createDebt(payload);
      onSaved(saved, !editing);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? 'Edit Credit / Loan' : 'New Credit / Loan'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Lender (who you owe)">
            <input required maxLength={200} className="input" placeholder="e.g. Awash Bank, Wang Trading" value={form.lenderName} onChange={(e) => set({ lenderName: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="input" value={form.debtType} onChange={(e) => set({ debtType: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description (optional)">
          <input maxLength={500} className="input" placeholder="e.g. working-capital loan" value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount borrowed">
            <input required type="number" min="0.01" step="0.01" className="input" value={form.principalAmount} onChange={(e) => set({ principalAmount: e.target.value })} />
          </Field>
          <Field label="Interest / fees to add (optional)">
            <input type="number" min="0" step="0.01" className="input" value={form.interestAmount} onChange={(e) => set({ interestAmount: e.target.value })} />
          </Field>
        </div>
        <p className="text-sm text-ink-500">Total to repay: <strong>{formatMoney(total)}</strong></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Start date">
            <input required type="date" className="input" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="Due date (optional)">
            <input type="date" className="input" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea rows={2} maxLength={1000} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : editing ? 'Save changes' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PayDebtModal({ debt, onClose, onPaid }) {
  const [form, setForm] = useState({ amount: debt.remainingAmount, paymentDate: today(), method: 'CASH', reference: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await recordDebtPayment(debt.id, {
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        reference: form.reference.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      onPaid(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Record Repayment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-500">{debt.lenderName} · still owed: <strong>{formatMoney(debt.remainingAmount)}</strong></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount paid">
            <input required type="number" min="0.01" max={debt.remainingAmount} step="0.01" className="input" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </Field>
          <Field label="Date paid">
            <input required type="date" max={today()} className="input" value={form.paymentDate} onChange={(e) => set({ paymentDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Paid by">
            <select className="input" value={form.method} onChange={(e) => set({ method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Reference (optional)">
            <input maxLength={255} className="input" placeholder="receipt / transfer no." value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
          </Field>
        </div>
        <Field label="Note (optional)">
          <input maxLength={400} className="input" value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Record Repayment'}</button>
        </div>
      </form>
    </Modal>
  );
}
