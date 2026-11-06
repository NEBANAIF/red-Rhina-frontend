import React, { useEffect, useState } from 'react';
import {
  searchProductionOrders, getProductionOrder, createProductionOrder, startProductionOrder,
  cancelProductionOrder, completeProductionOrder, planProduction, listAssignableWorkers, getOrderWorkers, setOrderWorkers,
} from '../../api/manufacturing.js';
import { listBranches, listTransferBranches } from '../../api/branches.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { searchCustomers } from '../../api/customers.js';
import { formatMoney, formatDate } from '../../utils/format.js';

const fmtNum = (n) => Number(n ?? 0).toLocaleString();

const STATUSES = ['', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const TYPES = ['', 'MAKE_TO_STOCK', 'MAKE_TO_ORDER'];
const typeLabel = (t) => (t === 'MAKE_TO_STOCK' ? 'Make to stock' : t === 'MAKE_TO_ORDER' ? 'Make to order' : 'All types');
const statusLabel = (s) => (s === '' ? 'All statuses' : s.replace(/_/g, ' '));
const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS = [
  { key: 'orderNumber', header: 'Order #', render: (r) => <span className="font-medium text-ink-900">{r.orderNumber}</span> },
  { key: 'productName', header: 'Product' },
  { key: 'orderType', header: 'Type', render: (r) => typeLabel(r.orderType) },
  { key: 'plannedQuantity', header: 'Qty', render: (r) => (r.status === 'COMPLETED' ? `${r.producedQuantity - r.rejectedQuantity} / ${r.plannedQuantity}` : r.plannedQuantity), className: 'text-right' },
  { key: 'branchName', header: 'Factory' },
  { key: 'plannedDate', header: 'Planned', render: (r) => formatDate(r.plannedDate) },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
];

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}
function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-400">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{value}</span>
    </div>
  );
}

/** Production orders: make a quantity of a finished product from its bill of materials, then see what it cost. */
export default function ProductionOrdersPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canManage = hasPermission('PRODUCTION_MANAGE');
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    setStatus('loading');
    searchProductionOrders({ status: statusFilter || undefined, type: typeFilter || undefined, search: search || undefined, page, ...scopeParams })
      .then((d) => { setData(d); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  };
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, typeFilter, search, scopeParams.scope, scopeParams.branchId]);

  // changing the branch selector starts again from the first page
  useEffect(() => { setPage(0); }, [scopeParams.scope, scopeParams.branchId]);

  const open = (row) => getProductionOrder(row.id).then(setSelected).catch((e) => setError(extractErrorMessage(e)));

  const act = async (fn, message) => {
    setBusy(true);
    setNotice('');
    try {
      const updated = await fn(selected.id);
      setSelected(updated);
      setNotice(message);
      load();
    } catch (e) {
      setNotice('');
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const filtersActive = statusFilter || typeFilter || search;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Production Orders</h1>
        {canManage && <button onClick={() => setNewOpen(true)} className="btn btn-primary btn-sm">+ New Production Order</button>}
      </div>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}
      {error && status !== 'error' && <p className="alert alert-error mb-3">{error}</p>}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="Search">
            <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Order #, product or customer…" width="w-full sm:w-64" />
          </Field>
          <Field label="Status">
            <ElegantSelect value={statusFilter} onChange={(v) => { setPage(0); setStatusFilter(v); }} ariaLabel="Filter by status" minWidth={150}>
              {STATUSES.map((s) => <option key={s || 'all'} value={s}>{statusLabel(s)}</option>)}
            </ElegantSelect>
          </Field>
          <Field label="Type">
            <ElegantSelect value={typeFilter} onChange={(v) => { setPage(0); setTypeFilter(v); }} ariaLabel="Filter by type" minWidth={150}>
              {TYPES.map((t) => <option key={t || 'all'} value={t}>{typeLabel(t)}</option>)}
            </ElegantSelect>
          </Field>
          {filtersActive && <button onClick={() => { setPage(0); setStatusFilter(''); setTypeFilter(''); setSearch(''); }} className="btn btn-secondary btn-sm">Clear filters</button>}
        </div>

        {status === 'loading' && !data && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && status !== 'error' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={(r) => { setError(''); open(r); }} emptyMessage="No production orders found." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected ? selected.orderNumber : ''} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4 text-sm">
            <Row label="Product" value={`${selected.productName} (${selected.productSku})`} />
            <Row label="Type" value={typeLabel(selected.orderType)} />
            {(selected.customerName || selected.customerReference) && (
              <Row label="For" value={[selected.customerName, selected.customerReference].filter(Boolean).join(' · ')} />
            )}
            <Row label="Factory (materials used here)" value={selected.branchName} />
            {selected.outputBranchName && <Row label="Finished goods stored in" value={selected.outputBranchName} />}
            {selected.destinationType === 'CUSTOMER' && <Row label="Finished goods" value="Sold directly to a customer (not in any inventory)" />}
            <Row label="Planned" value={`${selected.plannedQuantity} on ${formatDate(selected.plannedDate)}`} />
            <Row label="Status" value={<Badge status={selected.status} />} />
            {selected.notes && <Row label="Notes" value={selected.notes} />}

            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                {selected.status === 'COMPLETED' ? 'Materials used' : 'Materials needed'}
              </p>
              {selected.materials.length === 0 ? <p className="text-ink-400">None.</p> : (
                <div className="space-y-1.5">
                  {selected.materials.map((m) => {
                    const short = m.inStock != null && m.inStock < m.quantity;
                    return (
                      <div key={m.materialId} className="flex items-center justify-between gap-3">
                        <span className="text-ink-700">{m.materialName}</span>
                        <span className={short ? 'font-medium text-red-600' : 'text-ink-500'}>
                          {m.quantity} {m.unit}
                          {m.inStock != null && ` · ${m.inStock} in stock${short ? ' – not enough' : ''}`}
                          {m.cost != null && ` · ${formatMoney(m.cost)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(selected.status === 'PLANNED' || selected.status === 'IN_PROGRESS') && <EstimatedCost order={selected} />}
            <WorkersSection order={selected} canManage={canManage} />

            {selected.status === 'COMPLETED' && (
              <div className="space-y-1.5 border-t border-cream-200 pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Result and cost</p>
                <Row label="Produced" value={selected.producedQuantity} />
                <Row label="Rejected (quality)" value={selected.rejectedQuantity} />
                <Row label="Into stock" value={selected.producedQuantity - selected.rejectedQuantity} />
                <Row label="Materials" value={formatMoney(selected.materialCost)} />
                <Row label="Labour" value={formatMoney(selected.laborCost)} />
                <Row label="Overhead" value={formatMoney(selected.overheadCost)} />
                <Row label="Total cost" value={formatMoney(selected.totalCost)} strong />
                <Row label="Cost per unit" value={formatMoney(selected.unitCost)} strong />
                {selected.outputBranchName && <Row label={`Stored in ${(selected.destinationType || 'warehouse').toLowerCase().replace('branch', 'branch (store)')}`} value={selected.outputBranchName} />}
                {selected.directSale && (
                  <>
                    <Row label="Customer" value={selected.directSale.customerName} />
                    <Row label="Selling price" value={`${fmtNum(selected.directSale.quantity)} × ${formatMoney(selected.directSale.unitPrice)} = ${formatMoney(selected.directSale.totalAmount)}`} />
                    <Row label="Production cost" value={formatMoney(selected.directSale.costAmount)} />
                    <Row label="Profit" value={`${formatMoney(selected.directSale.profit)} (${selected.directSale.marginPercent}%)`} />
                    <Row label="Payment" value={`${selected.directSale.paymentStatus.toLowerCase()} – paid ${formatMoney(selected.directSale.amountPaid)}, balance ${formatMoney(selected.directSale.balance)}`} />
                    <Row label="Delivery" value={`${selected.directSale.deliveryStatus.toLowerCase()}${selected.directSale.deliveryAddress ? ` – ${selected.directSale.deliveryAddress}` : ''}`} />
                  </>
                )}
                {selected.outputBatchNumber && <Row label="Stock batch" value={selected.outputBatchNumber} />}
              </div>
            )}

            {canManage && (selected.status === 'PLANNED' || selected.status === 'IN_PROGRESS') && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                <button disabled={busy} onClick={() => act(cancelProductionOrder, 'Production order cancelled.')} className="btn btn-secondary btn-sm">Cancel order</button>
                {selected.status === 'PLANNED' && (
                  <button disabled={busy} onClick={() => act(startProductionOrder, 'Production started.')} className="btn btn-secondary btn-sm">Start production</button>
                )}
                <button disabled={busy} onClick={() => setCompleteOpen(true)} className="btn btn-primary btn-sm">Complete production</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {newOpen && (
        <NewOrderModal
          onClose={() => setNewOpen(false)}
          onCreated={() => { setNewOpen(false); setNotice('Production order created.'); load(); }}
        />
      )}
      {completeOpen && selected && (
        <CompleteModal
          order={selected}
          onClose={() => setCompleteOpen(false)}
          onDone={(updated) => { setCompleteOpen(false); setSelected(updated); setNotice(updated.destinationType === 'CUSTOMER' ? `Production completed – sold directly to ${updated.directSale?.customerName ?? 'the customer'}. Track payment and delivery on the Direct Sales page.` : `Production completed – raw materials used at the factory, finished goods stored in ${updated.outputBranchName || 'the destination'}.`); load(); }}
        />
      )}
    </div>
  );
}

/** Estimated cost of a planned / running order: materials (average stock cost), labour and overhead - total and per unit. */
function EstimatedCost({ order }) {
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    let live = true;
    setPlan(null);
    planProduction({ productId: order.productId, quantity: order.plannedQuantity, branchId: order.branchId })
      .then((p) => { if (live) setPlan(p); }).catch(() => {});
    return () => { live = false; };
  }, [order.id]);
  if (!plan || plan.estimatedTotalCost == null) return null;
  return (
    <div className="space-y-1.5 border-t border-cream-200 pt-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Estimated cost ({plan.batchesNeeded} batch{plan.batchesNeeded === 1 ? '' : 'es'} of {plan.batchSize.toLocaleString()})</p>
      <Row label="Raw materials" value={formatMoney(plan.estimatedMaterialCost)} />
      <Row label="Labour" value={formatMoney(plan.estimatedLaborCost)} />
      <Row label="Overhead" value={formatMoney(plan.estimatedOverheadCost)} />
      <Row label="Total cost of this order" value={formatMoney(plan.estimatedTotalCost)} strong />
      <Row label="Cost per finished unit" value={formatMoney(plan.estimatedUnitCost)} strong />
    </div>
  );
}

/** The employees working on the order - people without a login can be assigned too. */
function WorkersSection({ order, canManage }) {
  const [workers, setWorkers] = useState([]);
  const [options, setOptions] = useState(null);
  const [picked, setPicked] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const open = order.status === 'PLANNED' || order.status === 'IN_PROGRESS';
  useEffect(() => { setEditing(false); getOrderWorkers(order.id).then(setWorkers).catch(() => setWorkers([])); }, [order.id]);
  const startEdit = () => {
    setPicked(workers.map((w) => w.employeeId)); setError(''); setEditing(true);
    listAssignableWorkers(order.branchId).then(setOptions).catch((e) => setError(extractErrorMessage(e)));
  };
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const save = async () => {
    setSaving(true); setError('');
    try { setWorkers(await setOrderWorkers(order.id, picked)); setEditing(false); }
    catch (e) { setError(extractErrorMessage(e)); } finally { setSaving(false); }
  };
  if (!open && workers.length === 0) return null;
  return (
    <div className="border-t border-cream-200 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Workers</p>
        {canManage && open && !editing && <button type="button" onClick={startEdit} className="text-xs font-medium text-sage-600 hover:underline">{workers.length ? 'Change' : '+ Assign workers'}</button>}
      </div>
      {!editing && (workers.length === 0 ? <p className="text-ink-400">No workers assigned.</p> : (
        <div className="space-y-1">
          {workers.map((w) => (
            <div key={w.employeeId} className="flex items-center justify-between gap-3">
              <span className="text-ink-700">{w.fullName}</span>
              <span className="text-xs text-ink-500">{[w.positionTitle, w.departmentName].filter(Boolean).join(' · ')}{!w.hasLogin && ' · no login'}</span>
            </div>
          ))}
        </div>
      ))}
      {editing && (
        <div>
          {!options ? <LoadingState /> : options.length === 0 ? <p className="text-ink-400">No active employees are registered at this factory.</p> : (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-cream-300 p-2">
              {options.map((w) => (
                <label key={w.employeeId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.includes(w.employeeId)} onChange={() => toggle(w.employeeId)} />
                  <span className="text-ink-800">{w.fullName}</span>
                  <span className="text-xs text-ink-500">{[w.positionTitle, w.departmentName].filter(Boolean).join(' · ')}{!w.hasLogin && ' · no login'}</span>
                </label>
              ))}
            </div>
          )}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" disabled={saving} className="btn btn-primary btn-sm" onClick={save}>{saving ? 'Saving...' : 'Save workers'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewOrderModal({ onClose, onCreated }) {
  const { scope, specificBranchId } = useBranchScope();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ orderType: 'MAKE_TO_STOCK', branchId: '', plannedQuantity: '', plannedDate: today(), customerReference: '', notes: '' });
  const [product, setProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    listBranches('FACTORY').then((list) => {
      const arr = Array.isArray(list) ? list : (list?.content ?? []);
      setBranches(arr);
      if (arr.length === 1) setForm((f) => ({ ...f, branchId: arr[0].id }));
      else if (scope === 'SPECIFIC' && arr.some((b) => b.id === specificBranchId)) setForm((f) => ({ ...f, branchId: specificBranchId }));
    }).catch(() => {});
  }, [scope, specificBranchId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!product) { setError('Choose the product to make.'); return; }
    setSaving(true);
    try {
      await createProductionOrder({
        orderType: form.orderType,
        productId: product.id,
        branchId: form.branchId,
        plannedQuantity: Number(form.plannedQuantity),
        plannedDate: form.plannedDate || undefined,
        customerReference: form.orderType === 'MAKE_TO_ORDER' ? form.customerReference.trim() || undefined : undefined,
        notes: form.notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="New Production Order" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="inline-flex rounded-lg border border-cream-300 p-0.5" role="radiogroup" aria-label="Type">
          {['MAKE_TO_STOCK', 'MAKE_TO_ORDER'].map((t) => (
            <button key={t} type="button" role="radio" aria-checked={form.orderType === t} onClick={() => set({ orderType: t })}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${form.orderType === t ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}>
              {typeLabel(t)}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          {form.orderType === 'MAKE_TO_STOCK' ? 'Made into stock to be sold later.' : 'Made for a specific customer order. The finished goods still go into stock; sell them from the POS.'}
        </p>

        <Field label="Product to make (needs a bill of materials)">
          <ProductSelect value={product} onChange={setProduct} productType="FINISHED_GOOD" placeholder="Search finished product…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Factory (raw materials are taken from here)">
            <select required className="input" value={form.branchId} onChange={(e) => set({ branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Quantity to make">
            <input required type="number" min="1" step="1" className="input" value={form.plannedQuantity} onChange={(e) => set({ plannedQuantity: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Planned date"><input type="date" className="input" value={form.plannedDate} onChange={(e) => set({ plannedDate: e.target.value })} /></Field>
          {form.orderType === 'MAKE_TO_ORDER' && (
            <Field label="Customer / order reference">
              <input required maxLength={200} className="input" placeholder="e.g. Abebe Trading – PO 114" value={form.customerReference} onChange={(e) => set({ customerReference: e.target.value })} />
            </Field>
          )}
        </div>
        <Field label="Notes (optional)"><textarea rows={2} maxLength={1000} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

const DESTINATIONS = [
  { value: 'WAREHOUSE', label: 'A warehouse', branchType: 'WAREHOUSE' },
  { value: 'SHOWROOM', label: 'A showroom', branchType: 'SHOWROOM' },
  { value: 'BRANCH', label: 'A branch (store)', branchType: 'STORE' },
  { value: 'CUSTOMER', label: 'Directly to a customer', branchType: null },
];
const newKey = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Complete a production order. Raw materials are used up at the factory. The accepted units go to a warehouse, a showroom or a branch
 * (as stock, at their production cost) - or straight to a customer, in which case they never enter any inventory: the sale
 * (actual selling price, payment, delivery) is recorded once and its profit is selling price minus production cost.
 */
function CompleteModal({ order, onClose, onDone }) {
  const [form, setForm] = useState({
    produced: order.plannedQuantity, rejected: '', labor: '', overhead: '', destinationType: 'WAREHOUSE', branchId: '',
    customerId: '', customerName: '', unitPrice: '', amountPaid: '', deliveryAddress: '', deliveryContact: '', deliveryDate: '', notes: '',
  });
  const [branches, setBranches] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const destination = DESTINATIONS.find((d) => d.value === form.destinationType);
  const direct = form.destinationType === 'CUSTOMER';
  const accepted = Math.max(0, (Number(form.produced) || 0) - (Number(form.rejected) || 0));
  const saleTotal = accepted * (Number(form.unitPrice) || 0);

  // a factory user may not "see" other branches, hence transfer-targets
  useEffect(() => {
    listTransferBranches().then((list) => setBranches(Array.isArray(list) ? list : (list?.content ?? []))).catch(() => setBranches([]));
    searchCustomers('').then((c) => setCustomers(Array.isArray(c) ? c : (c?.content ?? []))).catch(() => {});
  }, []);

  const options = (branches || []).filter((b) => b.type === destination?.branchType);
  useEffect(() => {
    if (direct) return;
    if (options.length === 1) setForm((f) => ({ ...f, branchId: options[0].id }));
    else setForm((f) => (options.some((o) => o.id === f.branchId) ? f : { ...f, branchId: '' }));
  }, [form.destinationType, branches]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!direct && !form.branchId) { setError(`Choose the ${destination.label.replace('A ', '')} that receives the finished goods.`); return; }
    if (direct && !form.customerId && !form.customerName.trim()) { setError('Choose the customer or type the customer name.'); return; }
    if (direct && form.unitPrice === '') { setError('Enter the actual selling price per unit.'); return; }
    setSaving(true);
    try {
      const updated = await completeProductionOrder(order.id, {
        destinationType: form.destinationType,
        destinationBranchId: direct ? undefined : form.branchId,
        producedQuantity: Number(form.produced),
        rejectedQuantity: form.rejected === '' ? 0 : Number(form.rejected),
        laborCost: form.labor === '' ? undefined : Number(form.labor),
        overheadCost: form.overhead === '' ? undefined : Number(form.overhead),
        directSale: direct ? {
          customerId: form.customerId || undefined, customerName: form.customerId ? undefined : form.customerName.trim(),
          unitPrice: Number(form.unitPrice), amountPaid: form.amountPaid === '' ? 0 : Number(form.amountPaid),
          deliveryAddress: form.deliveryAddress.trim() || undefined, deliveryContact: form.deliveryContact.trim() || undefined,
          deliveryDate: form.deliveryDate || undefined, notes: form.notes.trim() || undefined,
        } : undefined,
      });
      onDone(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Complete ${order.orderNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-500">{order.productName} · planned {order.plannedQuantity} · raw materials used at {order.branchName}</p>
        <Field label="Where do the finished goods go?">
          <select className="input" value={form.destinationType} onChange={(e) => set({ destinationType: e.target.value })}>
            {DESTINATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        {!direct && (
          <>
            <Field label={destination.label.replace('A ', 'Receiving ')}>
              <select required className="input" value={form.branchId} onChange={(e) => set({ branchId: e.target.value })} disabled={branches === null}>
                <option value="">{branches === null ? 'Loading…' : `Select…`}</option>
                {options.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            {branches && options.length === 0 && (
              <p className="text-xs text-red-600">There is no {destination.label.replace('A ', '')} yet. an Administrator must create one (Branches) first.</p>
            )}
          </>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Units produced"><input required type="number" min="1" className="input" value={form.produced} onChange={(e) => set({ produced: e.target.value })} /></Field>
          <Field label="Rejected (failed quality)"><input type="number" min="0" className="input" value={form.rejected} onChange={(e) => set({ rejected: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Actual labour cost (optional)"><input type="number" min="0" step="0.01" className="input" value={form.labor} onChange={(e) => set({ labor: e.target.value })} /></Field>
          <Field label="Actual overhead cost (optional)"><input type="number" min="0" step="0.01" className="input" value={form.overhead} onChange={(e) => set({ overhead: e.target.value })} /></Field>
        </div>

        {direct && (
          <div className="space-y-3 rounded-lg border border-cream-200 bg-cream-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Direct sale to the customer</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Customer">
                <select className="input" value={form.customerId} onChange={(e) => set({ customerId: e.target.value })}>
                  <option value="">Other / not registered…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {!form.customerId && (
                <Field label="Customer name"><input maxLength={255} className="input" value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Actual selling price per unit"><input required type="number" min="0" step="0.01" className="input" value={form.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} /></Field>
              <Field label="Paid now (optional)"><input type="number" min="0" step="0.01" className="input" value={form.amountPaid} onChange={(e) => set({ amountPaid: e.target.value })} /></Field>
            </div>
            <p className="text-xs text-ink-500">
              {fmtNum(accepted)} accepted unit(s) × {form.unitPrice || 0} = <strong>{formatMoney(saleTotal)}</strong>. Payment status: {Number(form.amountPaid) >= saleTotal && saleTotal > 0 ? 'paid' : Number(form.amountPaid) > 0 ? 'partly paid' : 'unpaid'}.
              Profit is worked out when the order is completed (selling price minus the real production cost).
            </p>
            <Field label="Delivery address"><input maxLength={500} className="input" value={form.deliveryAddress} onChange={(e) => set({ deliveryAddress: e.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Delivery contact / phone"><input maxLength={200} className="input" value={form.deliveryContact} onChange={(e) => set({ deliveryContact: e.target.value })} /></Field>
              <Field label="Delivery date"><input type="date" className="input" value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} /></Field>
            </div>
          </div>
        )}

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Completing uses up the raw materials of {order.branchName} (at the factory&apos;s average cost).{' '}
          {direct
            ? 'The goods go straight to the customer: nothing is added to any inventory, so they can never be counted or sold a second time.'
            : 'The accepted units are stored at the chosen place as a new batch at their production cost.'}{' '}
          Labour and overhead left empty use the bill of materials&apos; standard cost × units produced. Rejected units are not stocked; their cost is spread over the good ones. This cannot be undone.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Working...' : 'Complete production'}</button>
        </div>
      </form>
    </Modal>
  );
}
