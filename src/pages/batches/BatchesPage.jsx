import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { searchBatches } from '../../api/batches.js';
import { listBranches } from '../../api/branches.js';
import {
  submitStockChange, listStockChanges, approveStockChange, rejectStockChange,
} from '../../api/stockChanges.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useNotificationCounts } from '../../notifications/NotificationCountsContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import { formatMoney, formatDate, formatDateTime, toLocalIsoDate } from '../../utils/format.js';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import { dayStartIso, dayEndIso } from '../../utils/dateRange.js';

const COLUMNS = [
  { key: 'batchNumber', header: 'Batch #', render: (r) => <span className="font-medium text-ink-900">{r.batchNumber}</span> },
  { key: 'productName', header: 'Product' },
  { key: 'branchName', header: 'Branch' },
  { key: 'quantity', header: 'Received', className: 'text-right' },
  {
    key: 'remainingQuantity', header: 'Remaining', className: 'text-right',
    render: (r) => <span className={r.remainingQuantity === 0 ? 'text-ink-400' : 'font-medium text-emerald-700'}>{r.remainingQuantity}</span>,
  },
  { key: 'costPrice', header: 'Cost Price', render: (r) => formatMoney(r.costPrice), className: 'text-right' },
  { key: 'receivedDate', header: 'Received', render: (r) => formatDate(r.receivedDate) },
  { key: 'expiryDate', header: 'Expiry', render: (r) => <ExpiryCell date={r.expiryDate} /> },
];

/**
 * Optional, so most rows show a dash. When set, flags it red once it has
 * actually expired and amber inside a 30-day warning window, so cosmetics
 * (and other perishable/medical stock) close to expiry stand out.
 */
function ExpiryCell({ date }) {
  if (!date) return <span className="text-slate-300">—</span>;
  const days = Math.ceil((new Date(date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
  const cls = days < 0 ? 'text-red-600 font-medium' : days <= 30 ? 'text-amber-700 font-medium' : 'text-ink-600';
  const note = days < 0 ? ' (expired)' : days <= 30 ? ` (${days}d left)` : '';
  return <span className={cls}>{formatDate(date)}{note}</span>;
}

const EXPORT_COLUMNS = (withCost) => [
  { header: 'Batch #', value: (r) => r.batchNumber },
  { header: 'Product', value: (r) => r.productName },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Received qty', value: (r) => r.quantity, type: 'number', total: true },
  { header: 'Remaining qty', value: (r) => r.remainingQuantity, type: 'number', total: true },
  ...(withCost ? [{ header: 'Cost price', value: (r) => r.costPrice, type: 'money' }] : []),
  { header: 'Received date', value: (r) => r.receivedDate, type: 'date' },
  { header: 'Expiry date', value: (r) => r.expiryDate, type: 'date' },
];

const REMOVAL_REASONS = [
  { value: 'ADJUSTMENT', label: 'Correction (entered wrongly)' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'LOST', label: 'Lost' },
];

/**
 * The source of truth for stock and cost (spec section 8) - never
 * Product.stock. remainingQuantity is what every FIFO consumption
 * (sales, transfers, supplier returns) actually decrements; quantity is
 * fixed at receipt and never changes, so the gap between the two IS the
 * batch's full consumption history without needing to read Stock History.
 *
 * Adding a batch or removing stock BY HAND is held: what was typed is shown under "Waiting for
 * approval" and the stock does not move until someone with "Approve stock changes" approves it.
 */
export default function BatchesPage() {
  const { scopeParams } = useBranchScope();
  const { hasPermission } = useAuth();
  // The cost of each batch is only shown to roles with the cost-price switch on.
  const canEdit = hasPermission('BATCH_CREATE') || hasPermission('STOCK_ADJUST');
  const [editing, setEditing] = useState(null); // the batch row being edited, or null
  const baseColumns = hasPermission('VIEW_COSTS') ? COLUMNS : COLUMNS.filter((c) => c.key !== 'costPrice');
  const columns = canEdit
    ? [...baseColumns, {
      key: 'actions', header: '', className: 'text-right',
      render: (r) => (
        <button onClick={() => setEditing(r)} className="btn-icon" title="Edit batch" aria-label="Edit batch">
          <Icon name="edit" size={15} />
        </button>
      ),
    }]
    : baseColumns;
  const [filterProduct, setFilterProduct] = useState(null);
  const productId = filterProduct ? filterProduct.id : '';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [productBoxKey, setProductBoxKey] = useState(0);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'ADD_BATCH' | 'REMOVE_STOCK' | null
  const [notice, setNotice] = useState('');
  const [pendingKey, setPendingKey] = useState(0); // bump to reload the waiting-for-approval list
  const canAdd = hasPermission('BATCH_CREATE');
  const canRemove = hasPermission('STOCK_ADJUST');

  const load = () => {
    setStatus('loading');
    searchBatches({ ...scopeParams, productId: productId || undefined, from: from || undefined, to: to || undefined, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(from || to || filterProduct);
  const clearFilters = () => { setProductBoxKey((k) => k + 1); setPage(0); setFrom(''); setTo(''); setFilterProduct(null); };

  useEffect(() => { if (!rangeInvalid) load(); }, [scopeParams.scope, scopeParams.branchId, productId, from, to, page]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Batches</h1>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <ExportButton
            title="Batches" columns={EXPORT_COLUMNS(hasPermission('VIEW_COSTS'))} scoped productFilter
            dateField="receivedDate" dateLabel="Received date"
            nameFields={['batchNumber', 'productName', 'branchName']} nameLabel="Product or batch #"
            initialFrom={from} initialTo={to} initialProduct={filterProduct}
            fetchRows={({ serverFrom, serverTo, scopeParams: sp, productId: pid }) => fetchAllPages(searchBatches, { ...sp, productId: pid, from: serverFrom, to: serverTo })}
          />
          {canAdd && (
            <button onClick={() => setModal('ADD_BATCH')} className="btn btn-primary btn-sm">+ Add Batch</button>
          )}
          {canRemove && (
            <button onClick={() => setModal('REMOVE_STOCK')} className="btn btn-secondary btn-sm">− Remove Stock</button>
          )}
        </div>
      </div>

      <FilterBar
        from={from} to={to} dateLabel="Received date"
        onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
        active={filtersActive} onClear={clearFilters}
      >
        <FilterField label="Product" className="min-w-[200px] max-w-xs flex-1">
          <ProductSelect key={productBoxKey} value={filterProduct} onChange={(p) => { setPage(0); setFilterProduct(p); }} placeholder="All products — type to pick one…" />
        </FilterField>
      </FilterBar>

      {notice && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}

      <PendingStockChanges reloadKey={pendingKey} onApplied={() => { load(); }} />

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={columns} rows={data.content} emptyMessage="No batches yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <EditBatchModal
        batch={editing}
        canEditCost={hasPermission('VIEW_COSTS')}
        onClose={() => setEditing(null)}
        onSubmitted={() => {
          setNotice('Batch edit entered and waiting for approval — the batch will change once it is approved.');
          setEditing(null);
          setPendingKey((k) => k + 1);
        }}
      />

      <StockChangeModal
        open={modal !== null}
        mode={modal ?? 'ADD_BATCH'}
        onClose={() => setModal(null)}
        onSubmitted={() => {
          setNotice(modal === 'ADD_BATCH'
            ? 'Batch entered and waiting for approval — the stock will go up once it is approved.'
            : 'Stock removal entered and waiting for approval — the stock will go down once it is approved.');
          setModal(null);
          setPendingKey((k) => k + 1);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ waiting for approval */

function PendingStockChanges({ reloadKey, onApplied }) {
  const { hasPermission } = useAuth();
  const { refresh: refreshCounts } = useNotificationCounts();
  const canApprove = hasPermission('STOCK_APPROVE');
  const canSee = canApprove || hasPermission('BATCH_CREATE') || hasPermission('STOCK_ADJUST');
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!canSee) return Promise.resolve();
    return listStockChanges({ status: 'PENDING' })
      .then((res) => setItems(res.content))
      .catch(() => setItems([]));
  }, [canSee]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const run = async (item, action) => {
    setBusyId(item.id);
    setError('');
    try {
      await action();
      await load();
      refreshCounts();
      onApplied();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!canSee || items.length === 0) return null;

  return (
    <section className="card card-pad mb-4 border-l-4 border-l-amber-400">
      <h2 className="text-sm font-semibold text-ink-900">Waiting for approval ({items.length})</h2>
      <p className="mb-3 mt-0.5 text-sm text-ink-500">
        The stock has <strong>not</strong> changed yet. Check what was entered
        {canApprove ? ', then approve it — or reject it and enter it again if something is wrong.' : '. Someone who can approve stock changes will check it.'}
      </p>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-cream-200">
        {items.map((c) => {
          const adding = c.changeType === 'ADD_BATCH';
          if (c.changeType === 'EDIT_BATCH') {
            return (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-ink-900">
                    <span className="text-sky-700">Edit</span> batch {c.batchNumber}
                    {' '}· {c.productName}
                    <span className="font-normal text-ink-400"> · {c.branchName}</span>
                  </p>
                  <p className="text-ink-600">
                    {c.newBatchNumber && c.newBatchNumber !== c.batchNumber ? <>new number {c.newBatchNumber} · </> : null}
                    {c.costPrice != null && <>cost {formatMoney(c.costPrice)} each · </>}
                    {c.expiryDate ? <>expiry {formatDate(c.expiryDate)}</> : <>no expiry date</>}
                  </p>
                  <p className="text-xs text-ink-400">Entered by {c.requestedByName} · {formatDateTime(c.requestedAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {canApprove && (
                    <button disabled={busyId === c.id} onClick={() => run(c, () => approveStockChange(c.id))} className="btn btn-primary btn-sm">
                      Approve
                    </button>
                  )}
                  {(canApprove || c.mine) && (
                    <button disabled={busyId === c.id} onClick={() => run(c, () => rejectStockChange(c.id))} className="btn btn-secondary btn-sm">
                      {canApprove ? 'Reject' : 'Discard'}
                    </button>
                  )}
                </div>
              </li>
            );
          }
          return (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink-900">
                  <span className={adding ? 'text-emerald-700' : 'text-red-600'}>
                    {adding ? '+' : '−'}{c.quantity}{c.unit ? ` ${c.unit}` : ''}
                  </span>
                  {' '}{c.productName}
                  <span className="font-normal text-ink-400"> · {c.branchName}</span>
                </p>
                <p className="text-ink-600">
                  {adding ? 'Add batch' : `Remove stock (${REMOVAL_REASONS.find((r) => r.value === c.movementType)?.label ?? 'correction'})`}
                  {adding && c.costPrice != null && <> · cost {formatMoney(c.costPrice)} each</>}
                  {c.batchNumber && <> · from batch {c.batchNumber}</>}
                  {c.note && <> — {c.note}</>}
                </p>
                <p className="text-xs text-ink-400">Entered by {c.requestedByName} · {formatDateTime(c.requestedAt)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canApprove && (
                  <button disabled={busyId === c.id} onClick={() => run(c, () => approveStockChange(c.id))} className="btn btn-primary btn-sm">
                    Approve
                  </button>
                )}
                {(canApprove || c.mine) && (
                  <button disabled={busyId === c.id} onClick={() => run(c, () => rejectStockChange(c.id))} className="btn btn-secondary btn-sm">
                    {canApprove ? 'Reject' : 'Discard'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------ enter a change */

/**
 * "Add Batch" (stock in, with a cost) and "Remove Stock" (correction / damaged / lost) share this
 * form. Submitting does NOT move stock - it creates a held change that must be approved. Only the
 * Administrator picks the branch; everyone else enters changes for their own.
 */
function StockChangeModal({ open, mode, onClose, onSubmitted }) {
  const adding = mode === 'ADD_BATCH';
  const { user } = useAuth();
  const { isAdministrator, scopeParams } = useBranchScope();
  const [branches, setBranches] = useState([]);
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const branchId = isAdministrator ? form.branchId : (user?.branchId ?? scopeParams.branchId ?? '');

  useEffect(() => {
    if (!open) return;
    setForm({ ...blank(), branchId: scopeParams.branchId || user?.branchId || '' });
    setError('');
    if (isAdministrator) listBranches().then(setBranches).catch(() => setBranches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Removing: offer the batches that still have stock, so a specific wrong batch can be corrected.
  useEffect(() => {
    if (!open || adding || !form.product || !branchId) {
      setBatches([]);
      return;
    }
    searchBatches({ scope: 'SPECIFIC', branchId, productId: form.product.id, size: 100 })
      .then((res) => setBatches(res.content.filter((b) => b.remainingQuantity > 0)))
      .catch(() => setBatches([]));
  }, [open, adding, form.product, branchId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.product) {
      setError('Pick a product from the list.');
      return;
    }
    setSaving(true);
    try {
      await submitStockChange(adding
        ? {
          changeType: 'ADD_BATCH',
          productId: form.product.id,
          branchId,
          quantity: Number(form.quantity),
          costPrice: Number(form.costPrice),
          receivedDate: form.receivedDate || undefined,
          expiryDate: form.expiryDate || undefined,
          note: form.note.trim() || undefined,
        }
        : {
          changeType: 'REMOVE_STOCK',
          productId: form.product.id,
          branchId,
          quantity: Number(form.quantity),
          movementType: form.reason,
          batchId: form.batchId || undefined,
          note: form.note.trim(),
        });
      onSubmitted();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={adding ? 'Add Batch' : 'Remove Stock'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {isAdministrator && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Branch</span>
            <select required className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, batchId: '' })}>
              <option value="">Select branch...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Product</span>
          <ProductSelect autoFocus value={form.product} onChange={(product) => setForm({ ...form, product, batchId: '' })} placeholder="Search product by name or SKU…" requireAtBranches={branchId || undefined} />
        </label>

        {!adding && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Take it from</span>
            <select className="input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} disabled={!form.product}>
              <option value="">Oldest stock first (automatic)</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.batchNumber} — {b.remainingQuantity} left · received {formatDate(b.receivedDate)}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">
            Quantity{form.product?.unit ? ` (${form.product.unit})` : ''}
          </span>
            <input required type="number" min="1" step="1" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </label>
          {adding ? (
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Cost price (per unit)</span>
              <input required type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </label>
          ) : (
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Why is it leaving?</span>
              <select className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REMOVAL_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
          )}
        </div>

        {adding && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Received date</span>
              <input type="date" max={toLocalIsoDate(new Date())} className="input" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
            </label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Expiry date (optional)</span>
              <input type="date" min={toLocalIsoDate(new Date())} className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </label>
          </div>
        )}

        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">
          {adding ? 'Note (optional)' : 'Reason (required)'}
        </span>
          <input
            required={!adding}
            maxLength={400}
            placeholder={adding ? 'e.g. imported directly, initial stock' : 'e.g. initial stock was entered as 500, should be 455'}
            className="input"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This is held for approval. The stock does <strong>not</strong> change until it is approved — you can check what you
          typed under “Waiting for approval”, and reject it if something is wrong.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Sending...' : 'Send for approval'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Edit a batch's number, cost price and expiry date. Like Add Batch, this does NOT change the
 * batch - it creates a held change that someone with "Approve stock changes" must approve.
 * Quantities are not editable here (use Add Batch / Remove Stock, which keep Stock History right).
 */
function EditBatchModal({ batch, canEditCost, onClose, onSubmitted }) {
  const [form, setForm] = useState({ batchNumber: '', costPrice: '', expiryDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!batch) return;
    setForm({
      batchNumber: batch.batchNumber ?? '',
      costPrice: batch.costPrice ?? '',
      expiryDate: batch.expiryDate ?? '',
    });
    setError('');
  }, [batch]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.batchNumber.trim()) {
      setError('The batch number cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await submitStockChange({
        changeType: 'EDIT_BATCH',
        batchId: batch.id,
        productId: batch.productId,
        branchId: batch.branchId,
        quantity: batch.quantity,
        batchNumber: form.batchNumber.trim(),
        costPrice: canEditCost && form.costPrice !== '' ? Number(form.costPrice) : undefined,
        expiryDate: form.expiryDate || undefined,
      });
      onSubmitted();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={batch !== null} title="Edit Batch" onClose={onClose}>
      {batch && (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-ink-600">
            <span className="font-medium text-ink-900">{batch.productName}</span>
            <span className="text-ink-400"> · {batch.branchName} · {batch.quantity} received, {batch.remainingQuantity} left</span>
          </p>

          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Batch number</span>
            <input required maxLength={100} className="input" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {canEditCost && (
              <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Cost price (per unit)</span>
                <input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </label>
            )}
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Expiry date (optional)</span>
              <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </label>
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This is held for approval. The batch does <strong>not</strong> change until it is approved. The cost is changed on
            the batch itself, so it also applies to the stock still left in it.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Sending...' : 'Send for approval'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function blank() {
  return {
    branchId: '', product: null, quantity: '', costPrice: '', receivedDate: toLocalIsoDate(new Date()),
    expiryDate: '', reason: 'ADJUSTMENT', batchId: '', note: '',
  };
}
