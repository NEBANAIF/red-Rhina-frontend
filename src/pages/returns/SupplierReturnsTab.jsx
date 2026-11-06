import React, { useEffect, useState } from 'react';
import { searchSupplierReturns, createSupplierReturn } from '../../api/returns.js';
import { searchPurchaseOrders, getPurchaseOrder } from '../../api/purchases.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import { formatMoney, formatDateTime } from '../../utils/format.js';
import SearchInput from '../../components/SearchInput.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import { dayStartIso, dayEndIso } from '../../utils/dateRange.js';

const COLUMNS = [
  { key: 'purchaseOrderNumber', header: 'PO #', render: (r) => <span className="font-medium text-ink-900">{r.purchaseOrderNumber}</span> },
  { key: 'supplierName', header: 'Supplier' },
  { key: 'branchName', header: 'Branch' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'createdAt', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
];

const EXPORT_COLUMNS = [
  { header: 'PO #', value: (r) => r.purchaseOrderNumber },
  { header: 'Date', value: (r) => r.createdAt, type: 'datetime' },
  { header: 'Supplier', value: (r) => r.supplierName },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Status', value: (r) => r.status },
];

/**
 * Removal is resolved on the backend via
 * StockMutationService.issueFromPurchaseOrderItem, scoped strictly to the
 * batch(es) THIS purchase order line created - never a generic FIFO sweep
 * across the product's stock at the branch, which could otherwise draw
 * from (and misattribute cost to) an unrelated purchase or a different
 * supplier's shipment of the same product.
 */
export default function SupplierReturnsTab() {
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
  const [dialogPo, setDialogPo] = useState(null);

  const load = () => {
    setStatus('loading');
    searchSupplierReturns({ ...scopeParams, page, fromAt: dayStartIso(from), toAt: dayEndIso(to), search: listSearch || undefined })
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
          title="Supplier Returns" columns={EXPORT_COLUMNS} scoped
          dateField="createdAt" dateLabel="Return date"
          nameFields={['purchaseOrderNumber', 'supplierName', 'branchName']} nameLabel="Supplier or PO number"
          initialFrom={from} initialTo={to}
          fetchRows={({ serverFrom, serverTo, scopeParams: sp }) => fetchAllPages(searchSupplierReturns, { ...sp, from: serverFrom, to: serverTo, search: listSearch || undefined })}
        />
        {hasPermission('SUPPLIER_MANAGE') && (
          <button onClick={() => setPickerOpen(true)} className="btn btn-primary btn-sm">
            + New Supplier Return
          </button>
        )}
      </div>

      <FilterBar
        from={from} to={to} dateLabel="Return date"
        onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
        active={Boolean(from || to || listSearch)} onClear={() => { setPage(0); setFrom(''); setTo(''); setListSearch(''); }}
      >
        <FilterField label="Supplier or PO #">
          <SearchInput value={listSearch} onChange={(v) => { setPage(0); setListSearch(v); }} placeholder="Search supplier name or PO #…" width="w-full sm:w-64" />
        </FilterField>
      </FilterBar>

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No supplier returns yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {pickerOpen && (
        <PurchaseOrderPickerModal onClose={() => setPickerOpen(false)} onPicked={(po) => { setPickerOpen(false); setDialogPo(po); }} />
      )}
      {dialogPo && (
        <SupplierReturnDialog po={dialogPo} onClose={() => setDialogPo(null)} onCompleted={() => { setDialogPo(null); load(); }} />
      )}
    </div>
  );
}

function PurchaseOrderPickerModal({ onClose, onPicked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const t = setTimeout(() => {
      searchPurchaseOrders({ search: query, size: 8 }).then((res) => setResults(res.content)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pick = async (row) => {
    setLoading(true); setError('');
    try { onPicked(await getPurchaseOrder(row.id)); }
    catch (err) { setError(extractErrorMessage(err)); } finally { setLoading(false); }
  };

  return (
    <Modal open title="Find the purchase order to return against" onClose={onClose}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search PO number…" autoFocus className="mb-3" width="w-full" />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-ink-400">Loading purchase order...</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {results.map((r) => (
          <button key={r.id} onClick={() => pick(r)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-cream-50">
            <span>{r.orderNumber} <span className="text-ink-400">· {r.supplierName}</span></span>
            <Badge status={r.status} />
          </button>
        ))}
        {query && results.length === 0 && !loading && <p className="px-3 py-2 text-sm text-ink-400">No matching purchase orders.</p>}
      </div>
    </Modal>
  );
}

function SupplierReturnDialog({ po, onClose, onCompleted }) {
  const receivedItems = po.items.filter((i) => i.receivedQuantity > 0);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(receivedItems.map((i) => [i.id, 0])));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const itemsToReturn = receivedItems
    .map((i) => (quantities[i.id] > 0 ? { purchaseOrderItemId: i.id, quantity: quantities[i.id], item: i } : null))
    .filter(Boolean);

  const totalValue = itemsToReturn.reduce((sum, i) => sum + i.item.unitCost * i.quantity, 0);

  const submit = async () => {
    if (itemsToReturn.length === 0) { setError('Enter a quantity for at least one item.'); return; }
    setSubmitting(true); setError('');
    try {
      const result = await createSupplierReturn({
        purchaseOrderId: po.id,
        items: itemsToReturn.map(({ purchaseOrderItemId, quantity }) => ({ purchaseOrderItemId, quantity })),
      });
      onCompleted(result);
    } catch (err) { setError(extractErrorMessage(err)); } finally { setSubmitting(false); }
  };

  return (
    <Modal open title={`Return against ${po.orderNumber}`} onClose={onClose} wide>
      <p className="mb-3 text-sm text-ink-500">
        {po.supplierName} · {po.branchName}. Quantity is capped at what was actually received on each line.
      </p>
      <div className="space-y-3">
        {receivedItems.map((item) => (
          <div key={item.id} className="rounded-lg border border-cream-300 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">{item.productName}</p>
              <p className="text-xs text-ink-400">received {item.receivedQuantity} @ {formatMoney(item.unitCost)}</p>
            </div>
            <input
              type="number" min="0" max={item.receivedQuantity}
              value={quantities[item.id]}
              onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Math.min(item.receivedQuantity, Math.max(0, Number(e.target.value) || 0)) }))}
              className="input mt-2 w-24"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-3 text-sm font-medium">
        <span>Estimated return value</span>
        <span>{formatMoney(totalValue)}</span>
      </div>

      {error && <p className="mt-3 alert alert-error">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={submitting} className="btn btn-secondary btn-sm">Cancel</button>
        <button onClick={submit} disabled={submitting} className="btn btn-primary btn-sm">
          {submitting ? 'Processing...' : 'Process Return'}
        </button>
      </div>
    </Modal>
  );
}
