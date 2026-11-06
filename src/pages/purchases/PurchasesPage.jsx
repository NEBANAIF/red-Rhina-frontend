import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  searchPurchaseOrders, createPurchaseOrder, submitPurchaseOrder,
  approvePurchaseOrder, cancelPurchaseOrder, receivePurchaseOrder,
} from '../../api/purchases.js';
import { listSuppliers } from '../../api/suppliers.js';
import { listBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import { dayStartIso, dayEndIso } from '../../utils/dateRange.js';
import SearchInput from '../../components/SearchInput.jsx';
import RouteEditor, { CountryDatalist } from './RouteEditor.jsx';
import ShipmentPanel from './ShipmentPanel.jsx';
import {
  COUNTRIES, EMPTY_PURCHASE_FILTERS, MONTHS, ORDER_STATUSES, PURCHASE_TYPES, SHIPMENT_STATUSES, SHIPPING_METHODS,
  anyPurchaseFilter, arrivalYears, defaultRoute, optionLabel, purchaseFilterParams, shipmentStatusLabel,
  stageToRequest, todayIso,
} from './shipment.js';

const BASE_COLUMNS = [
  { key: 'orderNumber', header: 'Order #', render: (r) => <span className="font-medium text-ink-900">{r.orderNumber}</span> },
  { key: 'supplierName', header: 'Supplier' },
  { key: 'branchName', header: 'Branch' },
  { key: 'orderDate', header: 'Date', render: (r) => formatDate(r.orderDate) },
  { key: 'total', header: 'Total', render: (r) => (r.purchaseType === 'GLOBAL' && r.currency ? `${formatMoney(r.total)} ${r.currency}` : formatMoney(r.total)), className: 'text-right' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'paymentType', header: 'Payment', render: (r) => <Badge status={r.paymentType || 'PAID'} /> },
];

const TYPE_COLUMN = { key: 'purchaseType', header: 'Type', render: (r) => <Badge status={r.purchaseType} /> };

/** Shown when the list is filtered to Global purchases: where the goods are, where they are going and how long it took. */
const SHIPMENT_COLUMNS = [
  { key: 'currentLocation', header: 'Current location', render: (r) => r.currentLocation || 'Not shipped yet' },
  { key: 'destinationCountry', header: 'Destination', render: (r) => `${r.destinationCountry || ''}${r.destinationWarehouse ? ` · ${r.destinationWarehouse}` : ''}` },
  { key: 'expectedArrivalDate', header: 'Expected arrival', render: (r) => (r.expectedArrivalDate ? formatDate(r.expectedArrivalDate) : '—') },
  { key: 'totalTransitDays', header: 'Transit', render: (r) => (r.totalTransitDays == null ? '—' : `${r.totalTransitDays} d`), className: 'text-right' },
  {
    key: 'shipmentStatus', header: 'Shipment',
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1">
        <Badge status={r.shipmentStatus} />
        {r.delayed && <Badge status="DELAYED">{`+${r.delayDays} d`}</Badge>}
      </span>
    ),
  },
];

function columnsFor(type) {
  const cols = [...BASE_COLUMNS];
  cols.splice(1, 0, TYPE_COLUMN);                       // Order #, Type, Supplier, ...
  if (type === 'GLOBAL') cols.splice(cols.length - 1, 0, ...SHIPMENT_COLUMNS);  // ... before the order Status
  return cols;
}

const RECEIVING_LABEL = { NOT_RECEIVED: 'Not received', PARTIALLY_RECEIVED: 'Partially received', RECEIVED: 'Received' };

const EXPORT_COLUMNS = [
  { header: 'Order #', value: (r) => r.orderNumber },
  { header: 'Date', value: (r) => r.orderDate, type: 'date' },
  { header: 'Supplier', value: (r) => r.supplierName },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Status', value: (r) => r.status },
  { header: 'Created by', value: (r) => r.createdByName },
  { header: 'Approved by', value: (r) => r.approvedByName },
  { header: 'Products', value: (r) => (r.items || []).map((i) => `${i.productName} x${i.quantity}`).join('; ') },
  { header: 'Total', value: (r) => r.total, type: 'money', total: true },
  // ---- global purchases (left empty for local ones) ----
  { header: 'Type', value: (r) => (r.purchaseType === 'GLOBAL' ? 'Global' : 'Local') },
  { header: 'Origin country', value: (r) => r.originCountry },
  { header: 'Destination country', value: (r) => r.destinationCountry },
  { header: 'Destination warehouse', value: (r) => (r.purchaseType === 'GLOBAL' ? r.destinationWarehouse : '') },
  { header: 'Shipping method', value: (r) => optionLabel(SHIPPING_METHODS, r.shippingMethod) },
  { header: 'Currency', value: (r) => r.currency },
  { header: 'Exchange rate', value: (r) => (r.purchaseType === 'GLOBAL' ? r.exchangeRate : '') },
  { header: 'Shipping cost', value: (r) => r.shippingCost, type: 'money' },
  { header: 'Expected arrival', value: (r) => r.expectedArrivalDate, type: 'date' },
  { header: 'Actual arrival', value: (r) => r.actualArrivalDate, type: 'date' },
  { header: 'Shipment status', value: (r) => (r.purchaseType === 'GLOBAL' ? shipmentStatusLabel(r.shipmentStatus) + (r.delayed ? ' (delayed)' : '') : '') },
  { header: 'Current location', value: (r) => r.currentLocation },
  { header: 'Route', value: (r) => r.route },
  { header: 'Route dates', value: (r) => r.routeDetail },
  { header: 'Total transit days', value: (r) => r.totalTransitDays, type: 'number' },
  { header: 'Delay (days)', value: (r) => (r.purchaseType === 'GLOBAL' ? r.delayDays : ''), type: 'number' },
  { header: 'Receiving status', value: (r) => RECEIVING_LABEL[r.receivingStatus] || '' },
  {
    header: 'Deliveries received',
    value: (r) => (r.receipts || []).map((d) => `${d.receivedDate}: ${d.lines.map((l) => `${l.productName} x${l.quantity}`).join(', ')}`).join('; '),
  },
];

/**
 * Lifecycle actions (spec section 17: DRAFT -> PENDING -> APPROVED ->
 * PARTIALLY_RECEIVED/RECEIVED, or CANCELLED) are exposed as buttons on
 * the detail view, gated per-action by both permission AND current status
 * - the backend is the real enforcer, these just avoid offering a button
 * that would fail.
 */
export default function PurchasesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState(null);
  const [productBoxKey, setProductBoxKey] = useState(0);
  const [pf, setPf] = useState(EMPTY_PURCHASE_FILTERS);   // purchase type, countries, warehouse, shipment status, arrival month/year
  const [warehouses, setWarehouses] = useState([]);

  const load = () => {
    setStatus('loading');
    searchPurchaseOrders({
      ...scopeParams, page, status: statusFilter || undefined, search: search || undefined,
      productId: product?.id, from: from || undefined, to: to || undefined, ...purchaseFilterParams(pf),
    })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(from || to || statusFilter || search || product || anyPurchaseFilter(pf));
  const clearFilters = () => { setProductBoxKey((k) => k + 1); setPage(0); setFrom(''); setTo(''); setStatusFilter(''); setSearch(''); setProduct(null); setPf(EMPTY_PURCHASE_FILTERS); };
  const setFilter = (key, value) => { setPage(0); setPf((f) => ({ ...f, [key]: value })); };
  const columns = useMemo(() => columnsFor(pf.purchaseType), [pf.purchaseType]);

  useEffect(() => { listBranches().then((all) => setWarehouses((Array.isArray(all) ? all : (all?.content ?? [])).filter((b) => b.type === 'WAREHOUSE' || b.type === 'FACTORY'))).catch(() => setWarehouses([])); }, []);

  useEffect(() => {
    if (rangeInvalid) return undefined;
    const textFilter = search || pf.originCountry || pf.destinationCountry || pf.currentCountry; // wait for typing to pause
    const t = setTimeout(load, textFilter ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scopeParams.scope, scopeParams.branchId, from, to, statusFilter, search, product?.id, JSON.stringify(pf)]);

  // The export dialog offers exactly the filters of the page, so what is exported matches what is on screen.
  const exportFilters = useMemo(() => {
    const opts = (list) => [{ value: '', label: 'Any' }, ...list];
    return [
      { key: 'purchaseType', label: 'Purchase type', type: 'select', options: [{ value: '', label: 'All (local and global)' }, ...PURCHASE_TYPES] },
      { key: 'status', label: 'Order status', type: 'select', options: opts(ORDER_STATUSES.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))) },
      { key: 'originCountry', label: 'Origin country', type: 'text', list: 'country-options' },
      { key: 'destinationCountry', label: 'Destination country', type: 'text', list: 'country-options' },
      { key: 'currentCountry', label: 'Current transit country', type: 'text', list: 'country-options' },
      { key: 'warehouseId', label: 'Destination warehouse', type: 'select', options: opts(warehouses.map((w) => ({ value: w.id, label: w.name }))) },
      { key: 'shipmentStatus', label: 'Shipment status', type: 'select', options: opts(SHIPMENT_STATUSES) },
      { key: 'arrivalMonth', label: 'Arrival month', type: 'select', options: opts(MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))) },
      { key: 'arrivalYear', label: 'Arrival year', type: 'select', options: opts(arrivalYears().map((y) => ({ value: String(y), label: String(y) }))) },
    ];
  }, [warehouses]);

  const runAction = async (fn) => {
    setActionError('');
    try {
      const updated = await fn();
      setSelected(updated);
      load();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <h1 className="page-title mb-4">Purchases</h1>
      <CountryDatalist countries={COUNTRIES} />

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <ExportButton
            title="Purchase Orders" columns={EXPORT_COLUMNS} scoped productFilter
            dateField="orderDate" dateLabel="Order date"
            nameFields={['orderNumber', 'supplierName', 'branchName']} nameLabel="Supplier or order number"
            initialFrom={from} initialTo={to} initialProduct={product}
            extraFilters={exportFilters} initialExtra={{ ...pf, status: statusFilter }}
            fetchRows={({ serverFrom, serverTo, scopeParams: sp, productId, extra }) => fetchAllPages(searchPurchaseOrders, {
              ...sp, productId, from: serverFrom, to: serverTo, search: search || undefined,
              ...purchaseFilterParams(extra), status: extra.status || undefined,
            })}
          />
          {hasPermission('PURCHASE_CREATE') && (
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
              + New Purchase Order
            </button>
          )}
        </div>

        <FilterBar
          from={from} to={to} dateLabel="Order date"
          onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
          active={filtersActive} onClear={clearFilters}
        >
          <FilterField label="Purchase type">
            <ElegantSelect value={pf.purchaseType} onChange={(v) => setFilter('purchaseType', v)} ariaLabel="Filter by purchase type" minWidth={140}>
              <option value="">All types</option>
              {PURCHASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </ElegantSelect>
          </FilterField>
          <FilterField label="Status">
            <ElegantSelect value={statusFilter} onChange={(v) => { setPage(0); setStatusFilter(v); }} ariaLabel="Filter by status" minWidth={170}>
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </ElegantSelect>
          </FilterField>
          <FilterField label="Order # or supplier">
            <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Search order # or supplier…" width="w-full sm:w-52" />
          </FilterField>
          <FilterField label="Product" className="min-w-[200px] max-w-xs flex-1">
            <ProductSelect key={productBoxKey} value={product} onChange={(p) => { setPage(0); setProduct(p); }} placeholder="All products — type to pick one…" />
          </FilterField>
          {pf.purchaseType !== 'LOCAL' && (
            <>
              <FilterField label="Origin country">
                <input className="input !py-1.5 text-sm" list="country-options" placeholder="Any" value={pf.originCountry} onChange={(e) => setFilter('originCountry', e.target.value)} />
              </FilterField>
              <FilterField label="Destination country">
                <input className="input !py-1.5 text-sm" list="country-options" placeholder="Any" value={pf.destinationCountry} onChange={(e) => setFilter('destinationCountry', e.target.value)} />
              </FilterField>
              <FilterField label="Current transit country">
                <input className="input !py-1.5 text-sm" list="country-options" placeholder="Any" value={pf.currentCountry} onChange={(e) => setFilter('currentCountry', e.target.value)} />
              </FilterField>
              <FilterField label="Destination warehouse">
                <ElegantSelect value={pf.warehouseId} onChange={(v) => setFilter('warehouseId', v)} ariaLabel="Filter by destination warehouse" minWidth={170}>
                  <option value="">All warehouses</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </ElegantSelect>
              </FilterField>
              <FilterField label="Shipment status">
                <ElegantSelect value={pf.shipmentStatus} onChange={(v) => setFilter('shipmentStatus', v)} ariaLabel="Filter by shipment status" minWidth={180}>
                  <option value="">Any shipment status</option>
                  {SHIPMENT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </ElegantSelect>
              </FilterField>
              <FilterField label="Arrival month">
                <ElegantSelect value={pf.arrivalMonth} onChange={(v) => setFilter('arrivalMonth', v)} ariaLabel="Filter by arrival month" minWidth={130}>
                  <option value="">Any month</option>
                  {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                </ElegantSelect>
              </FilterField>
              <FilterField label="Arrival year">
                <ElegantSelect value={pf.arrivalYear} onChange={(v) => setFilter('arrivalYear', v)} ariaLabel="Filter by arrival year" minWidth={110}>
                  <option value="">Any year</option>
                  {arrivalYears().map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </ElegantSelect>
              </FilterField>
            </>
          )}
        </FilterBar>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={columns} rows={data.content} onRowClick={(r) => { setSelected(r); setActionError(''); setCancelConfirmOpen(false); }} emptyMessage="No purchase orders yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected ? `PO ${selected.orderNumber}` : ''} onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Info label="Supplier" value={selected.supplierName} />
              <Info label="Branch" value={selected.branchName} />
              <Info label="Status" value={<Badge status={selected.status} />} />
              <Info label="Order Date" value={formatDate(selected.orderDate)} />
              <Info label="Created By" value={selected.createdByName} />
              <Info label="Approved By" value={selected.approvedByName || '—'} />
              <Info label="Type" value={<Badge status={selected.purchaseType} />} />
              <Info label="Payment" value={<Badge status={selected.paymentType || 'PAID'} />} />
              {selected.paymentType === 'PARTIAL' && <Info label="Paid at order time" value={formatMoney(selected.amountPaid)} />}
              {selected.purchaseType === 'GLOBAL' && <Info label="Purchase currency" value={selected.currency} />}
            </div>

            {selected.purchaseType === 'GLOBAL' && (
              <ShipmentPanel
                po={selected}
                canEdit={hasPermission('PURCHASE_CREATE') || hasPermission('PURCHASE_RECEIVE')}
                onUpdated={(updated) => { setSelected(updated); load(); }}
              />
            )}

            <div className="-mx-1 overflow-x-auto px-1"><table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase text-ink-400">
                  <th className="py-1.5 pr-3 font-medium">Product</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Ordered</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Received</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Unit Cost</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-3">{item.productName}</td>
                    <td className="py-1.5 pr-3 text-right">{item.quantity}</td>
                    <td className="py-1.5 pr-3 text-right">{item.receivedQuantity}</td>
                    <td className="py-1.5 pr-3 text-right">{formatMoney(item.unitCost)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            <div className="flex justify-end border-t border-cream-200 pt-3 text-sm font-semibold">
              Total: {formatMoney(selected.total)}{selected.purchaseType === 'GLOBAL' && selected.currency ? ` ${selected.currency}` : ''}
            </div>

            {(selected.receipts || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink-900">Deliveries received into stock</h3>
                {selected.receipts.map((d) => (
                  <div key={d.id} className="rounded-lg border border-cream-300 p-2.5 text-sm">
                    <p className="text-slate-800">
                      <span className="font-medium">{formatDate(d.receivedDate)}</span> · counted by {d.receivedByName}
                    </p>
                    <p className="text-ink-600">{d.lines.map((l) => `${l.productName} × ${l.quantity}`).join(', ')}</p>
                    {d.note && <p className="text-xs text-ink-400">{d.note}</p>}
                  </div>
                ))}
              </div>
            )}

            {actionError && <p className="alert alert-error">{actionError}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
              {selected.status === 'DRAFT' && hasPermission('PURCHASE_CREATE') && (
                <ActionButton onClick={() => runAction(() => submitPurchaseOrder(selected.id))}>Submit</ActionButton>
              )}
              {selected.status === 'PENDING' && hasPermission('PURCHASE_CREATE') && (
                <ActionButton onClick={() => runAction(() => approvePurchaseOrder(selected.id))}>Approve</ActionButton>
              )}
              {['APPROVED', 'PARTIALLY_RECEIVED'].includes(selected.status) && hasPermission('PURCHASE_RECEIVE') && (
                <ActionButton primary onClick={() => setReceiveOpen(true)}>Receive Stock</ActionButton>
              )}
              {!['RECEIVED', 'CANCELLED'].includes(selected.status) && hasPermission('PURCHASE_CREATE') && (
                <ActionButton danger onClick={() => setCancelConfirmOpen(true)}>Cancel Order</ActionButton>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel this purchase order?"
        description="This cannot be undone."
        confirmLabel="Cancel Order"
        danger
        busy={cancelling}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          setCancelling(true);
          await runAction(() => cancelPurchaseOrder(selected.id));
          setCancelling(false);
          setCancelConfirmOpen(false);
        }}
      />

      {receiveOpen && selected && (
        <ReceiveModal
          po={selected}
          onClose={() => setReceiveOpen(false)}
          onReceived={(updated) => { setReceiveOpen(false); setSelected(updated); load(); }}
        />
      )}

      <CreatePurchaseOrderModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function ActionButton({ children, onClick, primary, danger }) {
  const cls = primary ? 'btn-primary' : danger ? 'btn-danger' : 'btn-secondary';
  return (
    <button onClick={onClick} className={`btn btn-sm ${cls}`}>
      {children}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}

/** A fresh id for each receive dialog: the server refuses an id it has already booked, so a double click cannot add stock twice. */
function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

function ReceiveModal({ po, onClose, onReceived }) {
  const receivable = po.items.filter((i) => i.remainingToReceive > 0);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(receivable.map((i) => [i.id, i.remainingToReceive])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(newRequestId());
  const [receivedDate, setReceivedDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const isGlobal = po.purchaseType === 'GLOBAL';

  const submit = async () => {
    if (saving) return;                       // a second click while the first is still being sent does nothing
    setError('');
    const items = receivable
      .map((i) => ({ purchaseOrderItemId: i.id, quantityReceived: Number(quantities[i.id]) || 0 }))
      .filter((i) => i.quantityReceived > 0);
    if (items.length === 0) {
      setError('Enter a quantity to receive for at least one item.');
      return;
    }
    if (isGlobal && !confirmed) {
      setError('Tick the box to confirm these quantities were counted at the warehouse.');
      return;
    }
    setSaving(true);
    try {
      const updated = await receivePurchaseOrder(po.id, {
        items,
        requestId: requestId.current,
        ...(isGlobal ? { receivedDate: receivedDate || undefined, note: note.trim() || undefined } : {}),
      });
      onReceived(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Receive stock - ${po.orderNumber}`} onClose={onClose}>
      <div className="space-y-3">
        {isGlobal && (
          <p className="rounded-lg border border-cream-300 bg-cream-50 p-2.5 text-xs text-ink-600">
            Shipment: <b>{shipmentStatusLabel(po.shipmentStatus) || 'Not shipped'}</b>
            {po.currentLocation ? ` — ${po.currentLocation}` : ''}. The goods arriving in the country does not add stock.
            Stock is added only when you confirm what was actually counted at <b>{po.destinationWarehouse}</b>.
            Costs are converted to the local currency at 1 {po.currency} = {po.exchangeRate}.
          </p>
        )}
        {receivable.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-cream-300 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{item.productName}</p>
              <p className="text-xs text-ink-400">Remaining: {item.remainingToReceive} of {item.quantity}</p>
            </div>
            <input
              type="number" min="0" max={item.remainingToReceive}
              value={quantities[item.id]} disabled={saving}
              onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
              className="w-24 input"
            />
          </div>
        ))}
        {isGlobal && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Date received</span>
                <input type="date" className="input" value={receivedDate} max={todayIso()} disabled={saving} onChange={(e) => setReceivedDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Note (optional)</span>
                <input className="input" value={note} maxLength={300} disabled={saving} onChange={(e) => setNote(e.target.value)} placeholder="e.g. truck 1 of 2" />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" className="mt-0.5" checked={confirmed} disabled={saving} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>I counted these quantities at the warehouse and confirm they were received.</span>
            </label>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn btn-secondary btn-sm" disabled={saving}>Cancel</button>
          <button onClick={submit} disabled={saving || (isGlobal && !confirmed)} className="btn btn-primary btn-sm">
            {saving ? 'Receiving...' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const CURRENCY_SUGGESTIONS = ['USD', 'EUR', 'GBP', 'CNY', 'AED', 'INR', 'TRY', 'JPY', 'KES', 'SAR', 'ETB'];

function CreatePurchaseOrderModal({ open, onClose, onCreated }) {
  const { scopeParams, isAdministrator } = useBranchScope();
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ ...blank(), branchId: scopeParams.branchId || '' });
      setError('');
      listSuppliers().then(setSuppliers);
      // Only the Administrator chooses the receiving branch; everyone else buys for their own.
      if (isAdministrator) listBranches().then(setBranches).catch(() => setBranches([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isGlobal = form.purchaseType === 'GLOBAL';
  const orderTotal = form.items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
  const warehouses = branches.filter((b) => b.type === 'WAREHOUSE' || b.type === 'FACTORY');
  const warehouseName = (id) => branches.find((b) => b.id === id)?.name || '';

  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, { product: null, quantity: 1, unitCost: '' }] }));
  const removeLine = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateLine = (idx, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  // The first and last stop of the route are the origin and the destination: keep them in step with those boxes.
  const setOrigin = (v) => setForm((f) => ({ ...f, originCountry: v, stages: f.stages.map((st, i) => (i === 0 ? { ...st, country: v } : st)) }));
  const setDestination = (v) => setForm((f) => ({ ...f, destinationCountry: v, stages: f.stages.map((st, i, all) => (i === all.length - 1 ? { ...st, country: v } : st)) }));
  const setWarehouse = (id) => setForm((f) => {
    const previous = warehouseName(f.branchId);
    const name = warehouseName(id);
    const stages = f.stages.map((st, i, all) => (i === all.length - 1 && (!st.location || st.location === previous) ? { ...st, location: name } : st));
    return { ...f, branchId: id, stages };
  });
  const setType = (purchaseType) => setForm((f) => ({
    ...f, purchaseType,
    stages: purchaseType === 'GLOBAL' && f.stages.length < 2 ? defaultRoute(f.originCountry, f.destinationCountry, warehouseName(f.branchId)) : f.stages,
  }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.items.some((i) => !i.product)) {
      setError('Pick a product from the list on every line.');
      return;
    }
    const base = {
      supplierId: form.supplierId,
      branchId: form.branchId || scopeParams.branchId,
      orderDate: form.orderDate,
      items: form.items.map((i) => ({ productId: i.product.id, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
      purchaseType: form.purchaseType,
      paymentType: form.paymentType,
      creditDueDate: form.paymentType !== 'PAID' && form.creditDueDate ? form.creditDueDate : undefined,
      amountPaid: form.paymentType === 'PARTIAL' ? Number(form.amountPaid) : undefined,
    };
    if (isGlobal) {
      if (form.stages.length < 2) {
        setError('The route needs at least two stops: where the goods start and where they end up.');
        return;
      }
      Object.assign(base, {
        originCountry: form.originCountry.trim(),
        destinationCountry: form.destinationCountry.trim(),
        shippingMethod: form.shippingMethod,
        currency: form.currency.trim(),
        exchangeRate: Number(form.exchangeRate) || 1,
        shippingCost: Number(form.shippingCost) || 0,
        expectedArrivalDate: form.expectedArrivalDate,
        stages: form.stages.map(stageToRequest),
      });
    }
    setSaving(true);
    try {
      await createPurchaseOrder(base);
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1 block text-xs font-medium text-ink-500';

  return (
    <Modal open={open} title="New Purchase Order" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <span className={label}>Purchase type</span>
          <div className="inline-flex rounded-lg border border-cream-300 p-0.5" role="radiogroup" aria-label="Purchase type">
            {PURCHASE_TYPES.map((t) => (
              <button
                key={t.value} type="button" role="radio" aria-checked={form.purchaseType === t.value}
                onClick={() => setType(t.value)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${form.purchaseType === t.value ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {isGlobal && <p className="field-hint">Imported goods: you will also enter the shipping route. Stock is added only when the goods are counted at the warehouse.</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isAdministrator && (
            <label className="block sm:col-span-2"><span className={label}>{isGlobal ? 'Destination warehouse' : 'Receiving Branch'}</span>
              <select required className="input" value={form.branchId} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">{isGlobal ? 'Select warehouse...' : 'Select branch...'}</option>
                {(isGlobal ? warehouses : branches).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          {isGlobal && !isAdministrator && (
            <p className="field-hint sm:col-span-2">This order will be received into your own branch, which must be a warehouse.</p>
          )}
          <label className="block"><span className={label}>Supplier</span>
            <select required className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Select supplier...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Order Date</span>
            <input required type="date" className="input" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          </label>
        </div>

        <div className="space-y-2">
          <span className={label}>Payment</span>
          <div className="inline-flex rounded-lg border border-cream-300 p-0.5" role="radiogroup" aria-label="Payment">
            {[{ value: 'PAID', label: 'Fully paid' }, { value: 'PARTIAL', label: 'Partial' }, { value: 'CREDIT', label: 'Credit' }].map((o) => (
              <button
                key={o.value} type="button" role="radio" aria-checked={form.paymentType === o.value}
                onClick={() => setForm({ ...form, paymentType: o.value })}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${form.paymentType === o.value ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {form.paymentType !== 'PAID' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {form.paymentType === 'PARTIAL' && (
                <label className="block"><span className={label}>Amount paid now{isGlobal && form.currency ? ` (${form.currency.trim()})` : ''}</span>
                  <input required type="number" min="0.01" step="0.01" className="input" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} />
                </label>
              )}
              <label className="block"><span className={label}>Pay the rest by (optional)</span>
                <input type="date" className="input" min={form.orderDate} value={form.creditDueDate} onChange={(e) => setForm({ ...form, creditDueDate: e.target.value })} />
              </label>
              <p className="field-hint sm:col-span-2">
                {form.paymentType === 'PARTIAL' && orderTotal > 0 && Number(form.amountPaid) > 0
                  ? <>Order total {formatMoney(orderTotal)}, paid now {formatMoney(Number(form.amountPaid))}, balance owed <strong>{formatMoney(Math.max(orderTotal - Number(form.amountPaid), 0))}</strong>. </>
                  : null}
                {form.paymentType === 'PARTIAL' ? 'The balance' : 'What you owe this supplier'} is recorded on <strong>My Credits &amp; Loans</strong>, where you record each repayment.
              </p>
            </div>
          )}
        </div>

        {isGlobal && (
          <div className="space-y-3 rounded-xl border border-cream-300 p-3">
            <h3 className="text-sm font-semibold text-ink-900">Global purchase details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block"><span className={label}>Origin country</span>
                <input required className="input" list="country-options" value={form.originCountry} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. China" />
              </label>
              <label className="block"><span className={label}>Destination country</span>
                <input required className="input" list="country-options" value={form.destinationCountry} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Ethiopia" />
              </label>
              <label className="block"><span className={label}>Shipping method</span>
                <select required className="input" value={form.shippingMethod} onChange={(e) => setForm({ ...form, shippingMethod: e.target.value })}>
                  {SHIPPING_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="block"><span className={label}>Purchase currency</span>
                <input required className="input uppercase" list="currency-options" maxLength={10} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" />
                <datalist id="currency-options">{CURRENCY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label className="block"><span className={label}>Exchange rate (1 {form.currency || 'unit'} = ? local)</span>
                <input required type="number" min="0" step="0.000001" className="input" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
              </label>
              <label className="block"><span className={label}>Shipping cost ({form.currency || 'currency'})</span>
                <input type="number" min="0" step="0.01" className="input" value={form.shippingCost} onChange={(e) => setForm({ ...form, shippingCost: e.target.value })} placeholder="0.00" />
              </label>
              <label className="block"><span className={label}>Expected arrival date</span>
                <input required type="date" className="input" min={form.orderDate} value={form.expectedArrivalDate} onChange={(e) => setForm({ ...form, expectedArrivalDate: e.target.value })} />
              </label>
            </div>
            <div>
              <p className={label}>Shipping route</p>
              <RouteEditor stages={form.stages} onChange={(stages) => setForm({ ...form, stages })} lockEnds />
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500">Items</span>
            <button type="button" onClick={addLine} className="text-xs font-medium text-sage-600 hover:underline">+ Add line</button>
          </div>
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <div className="min-w-[180px] flex-1">
                  <ProductSelect
                    value={item.product}
                    onChange={(product) => updateLine(idx, { product })}
                    placeholder="Search product by name or SKU…"
                    requireAtBranches={form.branchId || scopeParams.branchId || undefined}
                  />
                </div>
                <input required type="number" min="1" placeholder="Qty" className="input w-20" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                <input required type="number" min="0" step="0.01" placeholder={isGlobal && form.currency ? `Cost (${form.currency.toUpperCase()})` : 'Cost'} className="input w-28" value={item.unitCost} onChange={(e) => updateLine(idx, { unitCost: e.target.value })} />
                <button type="button" onClick={() => removeLine(idx)} className="text-ink-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving || form.items.length === 0} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return {
    purchaseType: 'LOCAL', paymentType: 'PAID', creditDueDate: '', amountPaid: '', supplierId: '', branchId: '', orderDate: todayIso(),
    items: [{ product: null, quantity: 1, unitCost: '' }],
    originCountry: '', destinationCountry: '', shippingMethod: 'SEA', currency: 'USD', exchangeRate: '1',
    shippingCost: '', expectedArrivalDate: '', stages: defaultRoute(),
  };
}
