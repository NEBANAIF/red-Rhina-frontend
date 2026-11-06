import React, { useEffect, useState } from 'react';
import { searchStockHistory } from '../../api/stockHistory.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import { formatDate } from '../../utils/format.js';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import { dayStartIso, dayEndIso } from '../../utils/dateRange.js';

/** Spec section 20: additions green, deductions red - the full inventory ledger. */
const COLUMNS = [
  { key: 'occurredAt', header: 'Date', render: (r) => (
      <div>
        <p>{formatDate(r.occurredAt)}</p>
        <p className="text-xs text-ink-400">{r.occurredAt ? new Date(r.occurredAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}</p>
      </div>
    ) },
  { key: 'productName', header: 'Product', render: (r) => (
      <div><p className="font-medium text-ink-900">{r.productName}</p><p className="text-xs text-ink-400">{r.branchName}{r.batchNumber ? ` · ${r.batchNumber}` : ''}</p></div>
    ) },
  { key: 'movementType', header: 'Movement', render: (r) => <span className="text-xs font-medium uppercase text-ink-500">{r.movementType.replace(/_/g, ' ')}</span> },
  { key: 'quantityChange', header: 'Change', className: 'text-right', render: (r) => (
      <span className={`font-semibold tabular-nums ${r.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {r.quantityChange >= 0 ? '+' : ''}{r.quantityChange}
      </span>
    ) },
  { key: 'newQuantity', header: 'Before → After', render: (r) => (
      <span className="tabular-nums text-ink-500">{r.previousQuantity} → {r.newQuantity}</span>
    ) },
  { key: 'reason', header: 'Reason', render: (r) => <span className="text-ink-500">{r.reason || '—'}</span> },
  { key: 'userName', header: 'User' },
];

const EXPORT_COLUMNS = [
  { header: 'Date', value: (r) => r.occurredAt, type: 'datetime' },
  { header: 'Product', value: (r) => r.productName },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Batch', value: (r) => r.batchNumber },
  { header: 'Movement', value: (r) => (r.movementType || '').replace(/_/g, ' ') },
  { header: 'Change', value: (r) => r.quantityChange, type: 'number' },
  { header: 'Before', value: (r) => r.previousQuantity, type: 'number' },
  { header: 'After', value: (r) => r.newQuantity, type: 'number' },
  { header: 'Reason', value: (r) => r.reason },
  { header: 'User', value: (r) => r.userName },
];

const MOVEMENT_TYPES = ['PURCHASE', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'ADJUSTMENT', 'DAMAGED', 'LOST', 'SALE_VOID', 'BATCH_ADDED'];

export default function StockHistoryPage() {
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [movementType, setMovementType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [product, setProduct] = useState(null);
  const [productBoxKey, setProductBoxKey] = useState(0); // remounts the product box so it empties when filters are cleared
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = () => {
    setStatus('loading');
    searchStockHistory({
      ...scopeParams, movementType: movementType || undefined, page,
      fromAt: dayStartIso(from), toAt: dayEndIso(to), productId: product?.id,
    })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(from || to || product || movementType);
  const clearFilters = () => { setProductBoxKey((k) => k + 1); setPage(0); setFrom(''); setTo(''); setProduct(null); setMovementType(''); };

  useEffect(() => { if (!rangeInvalid) load(); }, [page, movementType, scopeParams.scope, scopeParams.branchId, from, to, product?.id]);

  return (
    <div>
      <h1 className="page-title mb-4">Stock History</h1>

      <div className="card card-pad">
        <div className="mb-3 flex justify-end">
          <ExportButton
            title="Stock History" columns={EXPORT_COLUMNS} scoped productFilter
            dateField="occurredAt" dateLabel="Movement date"
            nameFields={['productName', 'branchName', 'batchNumber', 'userName', 'reason']} nameLabel="Product, batch or user"
            initialFrom={from} initialTo={to} initialProduct={product}
            fetchRows={({ serverFrom, serverTo, scopeParams: sp, productId }) => fetchAllPages(searchStockHistory, {
              ...sp, productId, movementType: movementType || undefined, from: serverFrom, to: serverTo,
            })}
          />
        </div>

        <FilterBar
          from={from} to={to} dateLabel="Movement date"
          onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
          active={filtersActive} onClear={clearFilters}
        >
          <FilterField label="Movement">
            <ElegantSelect
              value={movementType}
              onChange={(val) => { setPage(0); setMovementType(val); }}
              ariaLabel="Filter by movement type"
              minWidth={180}
            >
              <option value="">All movement types</option>
              {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </ElegantSelect>
          </FilterField>
          <FilterField label="Product" className="min-w-[200px] max-w-xs flex-1">
            <ProductSelect key={productBoxKey} value={product} onChange={(p) => { setPage(0); setProduct(p); }} placeholder="All products — type to pick one…" />
          </FilterField>
        </FilterBar>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No stock movements found." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
