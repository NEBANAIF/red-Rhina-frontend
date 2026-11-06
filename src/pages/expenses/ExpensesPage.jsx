import React, { useEffect, useState } from 'react';
import { searchExpenses, createExpense } from '../../api/expenses.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import ElegantSelect from '../../components/ElegantSelect.jsx';

const CATEGORIES = ['RENT', 'ELECTRICITY', 'SALARIES', 'LABOR', 'TRANSPORT', 'INTERNET', 'MAINTENANCE', 'OTHER'];
const PAYMENT_METHODS = ['CASH', 'BANK', 'CREDIT'];

const COLUMNS = [
  { key: 'expenseDate', header: 'Date', render: (r) => formatDate(r.expenseDate) },
  { key: 'category', header: 'Category' },
  { key: 'description', header: 'Description' },
  { key: 'branchName', header: 'Branch' },
  { key: 'saleNumber', header: 'Sale', render: (r) => r.saleNumber || '—' },
  { key: 'amount', header: 'Amount', render: (r) => formatMoney(r.amount), className: 'text-right' },
  { key: 'createdByName', header: 'Logged By' },
];

const EXPORT_COLUMNS = [
  { header: 'Date', value: (r) => r.expenseDate, type: 'date' },
  { header: 'Category', value: (r) => r.category },
  { header: 'Description', value: (r) => r.description },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Sale', value: (r) => r.saleNumber },
  { header: 'Payment method', value: (r) => r.paymentMethod },
  { header: 'Reference', value: (r) => r.reference },
  { header: 'Logged by', value: (r) => r.createdByName },
  { header: 'Amount', value: (r) => r.amount, type: 'money', total: true },
];

/**
 * EXPENSE_CREATE is held by every branch role, but listing/browsing
 * requires EXPENSE_VIEW (managers only) - see ExpenseController's
 * javadoc. A STORE_STAFF sees only the "log an expense" form; a manager
 * sees the full list plus the same form.
 */
export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canView = hasPermission('EXPENSE_VIEW');
  const canCreate = hasPermission('EXPENSE_CREATE');

  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(canView ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    if (!canView) return;
    setStatus('loading');
    searchExpenses({ ...scopeParams, page, from: from || undefined, to: to || undefined, category: categoryFilter || undefined })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(from || to || categoryFilter);
  const clearFilters = () => { setPage(0); setFrom(''); setTo(''); setCategoryFilter(''); };

  useEffect(() => { if (!rangeInvalid) load(); }, [page, scopeParams.scope, scopeParams.branchId, from, to, categoryFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">Expenses</h1>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            + Log Expense
          </button>
        )}
      </div>

      {canView ? (
        <div className="card card-pad">
          <div className="mb-3 flex justify-end">
            <ExportButton
              title="Expenses" columns={EXPORT_COLUMNS} scoped
              dateField="expenseDate" dateLabel="Expense date"
              nameFields={['category', 'description', 'branchName', 'createdByName', 'reference']} nameLabel="Category, description or staff"
              initialFrom={from} initialTo={to}
              fetchRows={({ serverFrom, serverTo, scopeParams: sp }) => fetchAllPages(searchExpenses, {
                ...sp, from: serverFrom, to: serverTo, category: categoryFilter || undefined,
              })}
            />
          </div>
          <FilterBar
            from={from} to={to} dateLabel="Expense date"
            onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
            active={filtersActive} onClear={clearFilters}
          >
            <FilterField label="Category">
              <ElegantSelect value={categoryFilter} onChange={(v) => { setPage(0); setCategoryFilter(v); }} ariaLabel="Filter by category" minWidth={160}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </ElegantSelect>
            </FilterField>
          </FilterBar>
          {status === 'loading' && <LoadingState />}
          {status === 'error' && <ErrorState message={error} onRetry={load} />}
          {status === 'ready' && (
            <>
              <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No expenses recorded yet." />
              <div className="mt-3">
                <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card p-6 text-sm text-ink-500">
          You can log expenses, but viewing the expense list requires manager access.
        </div>
      )}

      <CreateExpenseModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function CreateExpenseModal({ open, onClose, onCreated }) {
  const { scopeParams } = useBranchScope();
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm(blank()); setError(''); } }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createExpense({
        branchId: form.branchId || scopeParams.branchId,
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Log Expense" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Category</span>
            <select required className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Amount</span>
            <input required type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Description</span>
          <input required className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Date</span>
            <input required type="date" className="input" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Payment Method</span>
            <select required className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Reference (optional)</span>
          <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Log Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { branchId: '', category: '', amount: '', description: '', expenseDate: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH', reference: '' };
}
