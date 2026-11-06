import React, { useEffect, useState } from 'react';
import { searchCustomerReturns } from '../../api/returns.js';
import { searchSales, getSale } from '../../api/sales.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import CustomerReturnDialog from '../sales-history/CustomerReturnDialog.jsx';
import { formatMoney, formatDateTime } from '../../utils/format.js';
import SearchInput from '../../components/SearchInput.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import { dayStartIso, dayEndIso } from '../../utils/dateRange.js';

const COLUMNS = [
  { key: 'saleNumber', header: 'Sale #', render: (r) => <span className="font-medium text-ink-900">{r.saleNumber}</span> },
  { key: 'customerName', header: 'Customer' },
  { key: 'branchName', header: 'Branch' },
  { key: 'refundAmount', header: 'Refund', render: (r) => formatMoney(r.refundAmount), className: 'text-right' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'createdAt', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
];

const EXPORT_COLUMNS = [
  { header: 'Sale #', value: (r) => r.saleNumber },
  { header: 'Date', value: (r) => r.createdAt, type: 'datetime' },
  { header: 'Customer', value: (r) => r.customerName },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Status', value: (r) => r.status },
  { header: 'Refund', value: (r) => r.refundAmount, type: 'money', total: true },
];

export default function CustomerReturnsTab() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialogSale, setDialogSale] = useState(null);

  const load = () => {
    setStatus('loading');
    searchCustomerReturns({ ...scopeParams, page, fromAt: dayStartIso(from), toAt: dayEndIso(to), search: listSearch || undefined })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };
  const rangeInvalid = Boolean(from && to && from > to);
  useEffect(() => {
    if (rangeInvalid) return undefined;
    const t = setTimeout(load, listSearch ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, from, to, listSearch, scopeParams.scope, scopeParams.branchId]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <ExportButton
          title="Customer Returns" columns={EXPORT_COLUMNS} scoped
          dateField="createdAt" dateLabel="Return date"
          nameFields={['saleNumber', 'customerName', 'branchName']} nameLabel="Customer or sale number"
          initialFrom={from} initialTo={to}
          fetchRows={({ serverFrom, serverTo, scopeParams: sp }) => fetchAllPages(searchCustomerReturns, { ...sp, from: serverFrom, to: serverTo, search: listSearch || undefined })}
        />
        {hasPermission('SALES_RETURN') && (
          <button onClick={() => setPickerOpen(true)} className="btn btn-primary btn-sm">
            + New Customer Return
          </button>
        )}
      </div>

      <FilterBar
        from={from} to={to} dateLabel="Return date"
        onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
        active={Boolean(from || to || listSearch)} onClear={() => { setPage(0); setFrom(''); setTo(''); setListSearch(''); }}
      >
        <FilterField label="Customer or sale #">
          <SearchInput value={listSearch} onChange={(v) => { setPage(0); setListSearch(v); }} placeholder="Search customer name, phone or sale #…" width="w-full sm:w-64" />
        </FilterField>
      </FilterBar>

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No customer returns yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {pickerOpen && (
        <SalePickerModal
          onClose={() => setPickerOpen(false)}
          onPicked={(sale) => { setPickerOpen(false); setDialogSale(sale); }}
        />
      )}

      {dialogSale && (
        <CustomerReturnDialog
          sale={dialogSale}
          onClose={() => setDialogSale(null)}
          onCompleted={() => { setDialogSale(null); load(); }}
        />
      )}
    </div>
  );
}

/** Search-by-sale-number step before handing off to the existing CustomerReturnDialog, which needs the full sale (with allocations) already loaded. */
function SalePickerModal({ onClose, onPicked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const t = setTimeout(() => {
      searchSales({ search: query, size: 8 }).then((res) => setResults(res.content)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pick = async (row) => {
    setLoading(true); setError('');
    try { onPicked(await getSale(row.id)); }
    catch (err) { setError(extractErrorMessage(err)); } finally { setLoading(false); }
  };

  return (
    <Modal open title="Find the sale to return" onClose={onClose}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search sale number…" autoFocus className="mb-3" width="w-full" />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-ink-400">Loading sale...</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {results.map((r) => (
          <button key={r.id} onClick={() => pick(r)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-cream-50">
            <span>{r.saleNumber} <span className="text-ink-400">· {r.customerName || 'Walk-in'}</span></span>
            <span className="text-ink-400">{formatDateTime(r.createdAt)}</span>
          </button>
        ))}
        {query && results.length === 0 && !loading && <p className="px-3 py-2 text-sm text-ink-400">No matching sales.</p>}
      </div>
    </Modal>
  );
}
