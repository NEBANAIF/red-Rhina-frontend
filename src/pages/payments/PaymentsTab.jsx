import React, { useEffect, useState } from 'react';
import { searchPayments } from '../../api/payments.js';
import { listBankOptions } from '../../api/banks.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import { formatMoney, formatDateTime } from '../../utils/format.js';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';

const METHODS = ['CASH', 'BANK', 'CREDIT'];
const REFERENCE_LABELS = { SALE: 'Sale', LOAN_PAYMENT: 'Loan repayment', SUPPLIER_PAYMENT: 'Supplier payment' };
const EMPTY_FILTERS = { from: '', to: '', method: '', bankId: '', referenceType: '', search: '' };

/** One label/value row inside the payment detail modal. */
function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--card-border)' }}>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
        {label}
      </span>
      <span
        className="text-right text-sm"
        style={{ fontFamily: 'var(--font-ui)', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

// The date pickers give a plain day; the server wants a moment. From = the start of that day and
// to = its very end, in the viewer's own time zone.
const startOfDay = (day) => (day ? new Date(`${day}T00:00:00`).toISOString() : undefined);
const endOfDay = (day) => (day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined);

const COLUMNS = [
  { key: 'createdAt', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
  {
    key: 'referenceNumber',
    header: 'For',
    primary: true,
    render: (r) => (
      <div>
        <span className="font-medium text-ink-900">{r.referenceNumber || '—'}</span>
        <span className="block text-xs text-ink-400">{REFERENCE_LABELS[r.referenceType] || r.referenceType}</span>
      </div>
    ),
  },
  { key: 'branchName', header: 'Branch' },
  { key: 'method', header: 'Method', render: (r) => <Badge status={r.method} dot={false} /> },
  {
    key: 'bankName',
    header: 'Bank',
    render: (r) => (r.bankName ? (
      <div>
        <span>{r.bankName}</span>
        {r.bankAccountNumber && (
          <span
            className="block text-xs"
            style={{ fontFamily: 'var(--font-ui)', fontVariantNumeric: 'tabular-nums', color: '#6b6a5a', letterSpacing: '0.01em' }}
          >
            {r.bankAccountNumber}
          </span>
        )}
      </div>
    ) : '—'),
  },
  { key: 'accountReference', header: 'Transaction ref', render: (r) => r.accountReference || '—' },
  { key: 'receivedByName', header: 'Received by', hideOnMobile: true },
  { key: 'amount', header: 'Amount', className: 'text-right font-medium text-ink-900', render: (r) => formatMoney(r.amount) },
];

const EXPORT_COLUMNS = [
  { header: 'Date', value: (r) => r.createdAt, type: 'datetime' },
  { header: 'Reference', value: (r) => r.referenceNumber },
  { header: 'Paid for', value: (r) => REFERENCE_LABELS[r.referenceType] || r.referenceType },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Method', value: (r) => r.method },
  { header: 'Bank', value: (r) => r.bankName },
  { header: 'Account number', value: (r) => r.bankAccountNumber },
  { header: 'Transaction ref', value: (r) => r.accountReference },
  { header: 'Received by', value: (r) => r.receivedByName },
  { header: 'Amount', value: (r) => r.amount, type: 'money', total: true },
];

/** The table of payments: newest first, filterable by date, method, bank and what it paid for. */
export default function PaymentsTab() {
  const { scopeParams } = useBranchScope();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [banks, setBanks] = useState([]);
  const [selected, setSelected] = useState(null);

  // For the bank filter. A role that cannot list banks simply gets no bank filter.
  useEffect(() => { listBankOptions().then(setBanks).catch(() => setBanks([])); }, []);

  const load = () => {
    setStatus('loading');
    searchPayments({
      ...scopeParams,
      page,
      method: filters.method || undefined,
      bankId: filters.bankId || undefined,
      referenceType: filters.referenceType || undefined,
      search: filters.search || undefined,
      from: startOfDay(filters.from),
      to: endOfDay(filters.to),
    })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0); // wait for typing to pause
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters, scopeParams.scope, scopeParams.branchId]);

  const setFilter = (key, value) => {
    setPage(0);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton
          title="Payments" columns={EXPORT_COLUMNS} scoped
          dateField="createdAt" dateLabel="Payment date"
          nameFields={['referenceNumber', 'branchName', 'bankName', 'accountReference', 'receivedByName']} nameLabel="Reference, bank or staff name"
          initialFrom={filters.from} initialTo={filters.to}
          fetchRows={({ serverFrom, serverTo, scopeParams: sp }) => fetchAllPages(searchPayments, {
            ...sp,
            method: filters.method || undefined,
            bankId: filters.bankId || undefined,
            referenceType: filters.referenceType || undefined,
            search: filters.search || undefined,
            from: startOfDay(serverFrom),
            to: endOfDay(serverTo),
          })}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Customer or sale #</span>
          <input type="search" className="input w-full sm:w-56" placeholder="Name, phone or sale number…" value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">From</span>
          <input type="date" className="input" value={filters.from} max={filters.to || undefined}
            onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input type="date" className="input" value={filters.to} min={filters.from || undefined}
            onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Method</span>
          <select className="input" value={filters.method} onChange={(e) => setFilter('method', e.target.value)}>
            <option value="">All</option>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        {banks.length > 0 && (
          <label className="block">
            <span className="label">Bank</span>
            <select className="input" value={filters.bankId} onChange={(e) => setFilter('bankId', e.target.value)}>
              <option value="">All banks</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.accountEnding ? `${b.name} - ending ${b.accountEnding}` : b.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="label">Paid for</span>
          <select className="input" value={filters.referenceType} onChange={(e) => setFilter('referenceType', e.target.value)}>
            <option value="">Everything</option>
            {Object.entries(REFERENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        {anyFilter && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPage(0); setFilters(EMPTY_FILTERS); }}>
            Clear filters
          </button>
        )}
      </div>

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'ready' && (
        <>
          <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No payments found." onRowClick={setSelected} />
          <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.referenceNumber || 'Payment detail'}
        description={REFERENCE_LABELS[selected?.referenceType] || selected?.referenceType}
      >
        {selected && (
          <div>
            <DetailRow label="Date" value={formatDateTime(selected.createdAt)} />
            <DetailRow label="Branch" value={selected.branchName} />
            <DetailRow label="Method" value={<Badge status={selected.method} dot={false} />} />
            <DetailRow label="Bank" value={selected.bankName} />
            <DetailRow label="Account number" value={selected.bankAccountNumber} />
            <DetailRow label="Transaction ref" value={selected.accountReference} />
            <DetailRow label="Received by" value={selected.receivedByName} />
            <DetailRow label="Amount" value={formatMoney(selected.amount)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
