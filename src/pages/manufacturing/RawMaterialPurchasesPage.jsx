import React, { useEffect, useState } from 'react';
import {
  listRawMaterialPurchases, createRawMaterialPurchase, getRawMaterials, receiveRawMaterialDelivery,
  updateRawMaterialShipment, cancelRawMaterialPurchase,
} from '../../api/manufacturing.js';
import { listSuppliers, createSupplier } from '../../api/suppliers.js';
import { listBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Icon from '../../components/Icon.jsx';
import { formatMoney } from '../../utils/format.js';
import { COUNTRIES, SHIPPING_METHODS, optionLabel, defaultRoute, stageToRequest, stageFromResponse } from '../purchases/shipment.js';
import RouteEditor, { CountryDatalist } from '../purchases/RouteEditor.jsx';

const fmt = (n) => Number(n ?? 0).toLocaleString();
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'AED', 'INR', 'TRY', 'JPY'];
const SHIPMENT_STATUSES = ['ORDERED', 'SHIPPED', 'IN_TRANSIT', 'ARRIVED_AT_PORT', 'CUSTOMS_CLEARANCE', 'DELIVERED'];
const label = (v) => (v ? v.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : '—');
const newKey = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function Field({ label: text, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{text}</span>{children}</label>;
}

const COLUMNS = [
  { key: 'purchaseNumber', header: 'Purchase #', render: (r) => <span className="font-medium text-ink-900">{r.purchaseNumber}</span> },
  { key: 'purchaseType', header: 'Type', render: (r) => <Badge status={r.purchaseType} tone={r.purchaseType === 'INTERNATIONAL' ? 'info' : 'neutral'} /> },
  { key: 'purchaseDate', header: 'Date' },
  { key: 'supplierName', header: 'Supplier', render: (r) => (r.supplierName ?? '—') + (r.supplierCountry ? ` (${r.supplierCountry})` : '') },
  { key: 'branchName', header: 'Factory' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'paymentType', header: 'Payment', render: (r) => <Badge status={r.paymentType || 'PAID'} /> },
  {
    key: 'shipment', header: 'Shipment / arrival',
    render: (r) => {
      if (r.purchaseType !== 'INTERNATIONAL') return '—';
      return (
        <span className="flex flex-col text-xs">
          <span>{label(r.shipmentStatus)}</span>
          {r.delayed
            ? <span className="font-medium text-red-600">Delayed {fmt(r.delayDays)} day{r.delayDays === 1 ? '' : 's'}</span>
            : <span className="text-ink-400">{r.expectedArrival ? `Expected ${r.expectedArrival}` : ''}</span>}
        </span>
      );
    },
  },
  { key: 'received', header: 'Received', render: (r) => `${fmt(r.receivedQuantity)} / ${fmt(r.orderedQuantity)}`, className: 'text-right' },
  { key: 'landedTotal', header: 'Landed total', render: (r) => formatMoney(r.landedTotal), className: 'text-right' },
];

/**
 * Raw material purchases, local and international. Goods go into the factory's raw material stock only when they are
 * RECEIVED - and only for the quantities that actually arrived (partial deliveries), at their landed cost.
 */
export default function RawMaterialPurchasesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canBuy = hasPermission('PRODUCTION_MANAGE');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sub, setSub] = useState(null); // 'receive' | 'shipment'

  const load = () => {
    setStatus('loading');
    listRawMaterialPurchases({ page, ...scopeParams }).then((d) => { setData(d); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  };
  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { setPage(0); }, [scopeParams.scope, scopeParams.branchId]);

  // the open purchase is always read from the freshly loaded list, so it updates after every action
  const selected = data?.content.find((p) => p.id === selectedId) ?? null;
  const open = selected && (selected.status === 'ORDERED' || selected.status === 'PARTIALLY_RECEIVED');

  const afterAction = (msg) => { setSub(null); setNotice(msg); load(); };
  const cancel = async () => {
    try { await cancelRawMaterialPurchase(selected.id); afterAction(`${selected.purchaseNumber} cancelled.`); }
    catch (e) { setNotice(''); setError(extractErrorMessage(e)); setStatus('error'); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Raw Material Purchases</h1>
        {canBuy && <button onClick={() => setNewOpen(true)} className="btn btn-primary btn-sm">+ New Purchase</button>}
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Local and international purchases for a factory. Stock only changes for goods that are actually received, so a shipment that arrives in
        parts is received in parts. International purchases carry the supplier&apos;s currency and exchange rate, plus customs, freight and other costs
        that are added to the goods to give the landed cost the stock is valued at.
      </p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      <div className="card card-pad">
        {status === 'loading' && !data && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && status !== 'error' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={(r) => setSelectedId(r.id)} emptyMessage="No raw material purchases yet." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected ? selected.purchaseNumber : ''} onClose={() => { setSelectedId(null); setSub(null); }}>
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={selected.purchaseType} tone={selected.purchaseType === 'INTERNATIONAL' ? 'info' : 'neutral'} />
              <Badge status={selected.status} />
              {selected.delayed && <Badge status="DELAYED">Delayed {fmt(selected.delayDays)} day(s)</Badge>}
            </div>
            <p className="text-ink-500">
              {selected.purchaseDate} · {selected.supplierName ?? 'No supplier'}{selected.supplierCountry ? ` (${selected.supplierCountry})` : ''} · received at {selected.branchName} · by {selected.createdByName}
            </p>
            <p className="text-xs text-ink-500">
              Payment: <Badge status={selected.paymentType || 'PAID'} />
              {selected.paymentType === 'PARTIAL' && ` · paid now ${selected.amountPaid}${selected.currency ? ` ${selected.currency}` : ''}`}
              {selected.paymentType && selected.paymentType !== 'PAID' && ` · owed ${formatMoney(selected.amountOwed)} (see My Credits & Loans)`}
              {selected.originCountry && ` · ${selected.originCountry} → ${selected.destinationCountry ?? '—'}`}
              {selected.shippingMethod && ` · ${optionLabel(SHIPPING_METHODS, selected.shippingMethod)}`}
            </p>

            {selected.stages?.length > 0 && (
              <div className="rounded-lg border border-cream-200 p-3 text-xs">
                <p className="mb-1 font-semibold uppercase tracking-wide text-ink-400">Route</p>
                <ol className="space-y-1">
                  {selected.stages.map((st) => (
                    <li key={st.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ink-800">{st.stageOrder}. {st.location ? `${st.location}, ` : ''}{st.country}</span>
                      <span className="text-ink-500">
                        {label(st.status)}{st.arrivalDate ? ` · arrived ${st.arrivalDate}` : ''}{st.departureDate ? ` · left ${st.departureDate}` : ''}
                        {st.daysAtStage != null ? ` · ${st.daysAtStage} day${st.daysAtStage === 1 ? '' : 's'}${st.ongoing ? ' so far' : ''}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {selected.purchaseType === 'INTERNATIONAL' && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-cream-200 bg-cream-50 p-3 text-xs">
                <div><dt className="text-ink-400">Shipment</dt><dd className="font-medium">{label(selected.shipmentStatus)}</dd></div>
                <div><dt className="text-ink-400">Now</dt><dd className="font-medium">{selected.currentLocation ?? '—'}</dd></div>
                <div className="col-span-2"><dt className="text-ink-400">Route</dt><dd className="font-medium">{selected.shippingRoute ?? '—'}</dd></div>
                <div><dt className="text-ink-400">Expected arrival</dt><dd className="font-medium">{selected.expectedArrival ?? '—'}</dd></div>
                <div><dt className="text-ink-400">Arrived</dt><dd className="font-medium">{selected.actualArrival ?? '—'}</dd></div>
                <div><dt className="text-ink-400">Currency / rate</dt><dd className="font-medium">{selected.currency} @ {Number(selected.exchangeRate)}</dd></div>
                <div><dt className="text-ink-400">Customs · Freight · Other</dt><dd className="font-medium">{formatMoney(selected.customsCost)} · {formatMoney(selected.freightCost)} · {formatMoney(selected.otherCost)}</dd></div>
              </dl>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-1 pr-3">Material</th>
                    <th className="py-1 pr-3">Batch</th>
                    <th className="py-1 pr-3">Expires</th>
                    <th className="py-1 pr-3 text-right">Ordered</th>
                    <th className="py-1 pr-3 text-right">Received</th>
                    <th className="py-1 pr-3 text-right">Outstanding</th>
                    {selected.purchaseType === 'INTERNATIONAL' && <th className="py-1 pr-3 text-right">Price ({selected.currency})</th>}
                    <th className="py-1 pr-3 text-right">Unit cost</th>
                    <th className="py-1 text-right">Landed / unit</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((i) => (
                    <tr key={i.itemId} className="border-t border-cream-200">
                      <td className="py-1.5 pr-3">{i.materialName}</td>
                      <td className="py-1.5 pr-3">{i.batchNumber ?? '—'}</td>
                      <td className="py-1.5 pr-3">{i.expiryDate ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right">{fmt(i.quantity)} {i.unit}</td>
                      <td className="py-1.5 pr-3 text-right">{fmt(i.receivedQuantity)}</td>
                      <td className={`py-1.5 pr-3 text-right ${i.outstanding > 0 ? 'font-medium text-amber-700' : ''}`}>{fmt(i.outstanding)}</td>
                      {selected.purchaseType === 'INTERNATIONAL' && <td className="py-1.5 pr-3 text-right">{Number(i.unitPriceForeign)}</td>}
                      <td className="py-1.5 pr-3 text-right">{formatMoney(i.unitCost)}</td>
                      <td className="py-1.5 text-right">{formatMoney(i.landedUnitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-right text-xs text-ink-500">Goods {formatMoney(selected.totalCost)}</p>
            <p className="text-right font-semibold">Landed total {formatMoney(selected.landedTotal)}</p>
            {selected.notes && <p className="text-ink-500">{selected.notes}</p>}

            {selected.deliveries.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Deliveries received</p>
                <ul className="space-y-1 text-xs text-ink-600">
                  {selected.deliveries.map((d) => (
                    <li key={d.id}>{d.deliveryDate} – {d.items.map((x) => `${fmt(x.quantity)} ${x.unit} ${x.materialName}`).join(', ')} (by {d.receivedByName}){d.notes ? ` – ${d.notes}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

            {canBuy && open && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                {selected.status === 'ORDERED' && <button type="button" className="btn btn-secondary btn-sm" onClick={cancel}>Cancel purchase</button>}
                {selected.purchaseType === 'INTERNATIONAL' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSub('shipment')}>Update shipment</button>}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setSub('receive')}>Receive delivery</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {selected && sub === 'receive' && <ReceiveModal purchase={selected} onClose={() => setSub(null)} onDone={afterAction} />}
      {selected && sub === 'shipment' && <ShipmentModal purchase={selected} onClose={() => setSub(null)} onDone={afterAction} />}

      {newOpen && (
        <NewPurchaseModal
          onClose={() => setNewOpen(false)}
          onSaved={(p) => {
            setNewOpen(false);
            setNotice(p.status === 'ORDERED'
              ? `${p.purchaseNumber} ordered – stock will increase when the goods are received.`
              : `${p.purchaseNumber} saved – the materials are now in ${p.branchName}'s raw material stock.`);
            setPage(0);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Record what actually arrived: type the quantity received for each line (0 / empty = not arrived yet). */
function ReceiveModal({ purchase, onClose, onDone }) {
  const [qty, setQty] = useState(() => Object.fromEntries(purchase.items.map((i) => [i.itemId, ''])));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [key] = useState(newKey); // one key per dialog: a double click can never receive the goods twice
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const lines = purchase.items.filter((i) => Number(qty[i.itemId]) > 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (lines.length === 0) { setError('Enter the quantity received for at least one line.'); return; }
    const bad = lines.find((i) => Number(qty[i.itemId]) > Number(i.outstanding));
    if (bad) { setError(`${bad.materialName}: enter a quantity up to ${fmt(bad.outstanding)}.`); return; }
    setSaving(true);
    try {
      const updated = await receiveRawMaterialDelivery(purchase.id, {
        requestKey: key, deliveryDate: date || undefined, notes: notes.trim() || undefined,
        items: lines.map((i) => ({ itemId: i.itemId, quantity: Number(qty[i.itemId]) })),
      });
      onDone(updated.status === 'RECEIVED'
        ? `${purchase.purchaseNumber} received in full.`
        : `Delivery recorded – ${fmt(updated.receivedQuantity)} of ${fmt(updated.orderedQuantity)} received so far.`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Receive delivery – ${purchase.purchaseNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-ink-500">Only the quantities you enter go into {purchase.branchName}&apos;s raw material stock, valued at each line&apos;s landed cost.</p>
        <div className="space-y-2">
          {purchase.items.filter((i) => i.outstanding > 0).map((i) => (
            <div key={i.itemId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{i.materialName} <span className="text-xs text-ink-400">({fmt(i.outstanding)} {i.unit} outstanding)</span></span>
              <input type="number" min="0" max={i.outstanding} step="any" className="input w-28" placeholder="Received"
                value={qty[i.itemId]} onChange={(e) => setQty((q) => ({ ...q, [i.itemId]: e.target.value }))} />
              <button type="button" className="text-xs font-medium text-sage-600 hover:underline" onClick={() => setQty((q) => ({ ...q, [i.itemId]: String(i.outstanding) }))}>All</button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date received"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note (optional)"><input maxLength={1000} className="input" placeholder="e.g. first truck, container 2" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Receive into stock'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Move an international shipment along; costs can still be corrected until the first delivery is received. */
function ShipmentModal({ purchase, onClose, onDone }) {
  const anyReceived = purchase.receivedQuantity > 0;
  const [form, setForm] = useState({
    shipmentStatus: purchase.shipmentStatus === 'DELIVERED' ? 'CUSTOMS_CLEARANCE' : (purchase.shipmentStatus ?? 'ORDERED'),
    expectedArrival: purchase.expectedArrival ?? '',
    customsCost: purchase.customsCost, freightCost: purchase.freightCost, otherCost: purchase.otherCost,
  });
  const [stages, setStages] = useState(() => (purchase.stages?.length >= 2
    ? purchase.stages.map(stageFromResponse)
    : defaultRoute(purchase.originCountry || purchase.supplierCountry || '', purchase.destinationCountry || 'Ethiopia', purchase.branchName)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateRawMaterialShipment(purchase.id, {
        shipmentStatus: form.shipmentStatus, expectedArrival: form.expectedArrival || undefined, stages: stages.map(stageToRequest),
        customsCost: Number(form.customsCost || 0), freightCost: Number(form.freightCost || 0), otherCost: Number(form.otherCost || 0),
      });
      onDone('Shipment updated.');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Update shipment – ${purchase.purchaseNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Shipment status">
            <select className="input" value={form.shipmentStatus} onChange={(e) => set({ shipmentStatus: e.target.value })}>
              {SHIPMENT_STATUSES.filter((s) => s !== 'DELIVERED').map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </Field>
          <Field label="Expected arrival"><input type="date" className="input" value={form.expectedArrival} onChange={(e) => set({ expectedArrival: e.target.value })} /></Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-ink-500">Shipping route - update each stop as the goods move (status and dates)</span>
          <RouteEditor stages={stages} onChange={setStages} lockEnds={!!purchase.originCountry} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Customs"><input type="number" min="0" step="0.01" disabled={anyReceived} className="input" value={form.customsCost} onChange={(e) => set({ customsCost: e.target.value })} /></Field>
          <Field label="Freight"><input type="number" min="0" step="0.01" disabled={anyReceived} className="input" value={form.freightCost} onChange={(e) => set({ freightCost: e.target.value })} /></Field>
          <Field label="Other costs"><input type="number" min="0" step="0.01" disabled={anyReceived} className="input" value={form.otherCost} onChange={(e) => set({ otherCost: e.target.value })} /></Field>
        </div>
        {anyReceived && <p className="text-xs text-ink-500">Costs are locked: goods were already received at the landed cost.</p>}
        <p className="text-xs text-ink-500">Customs, freight and other costs are in the local currency. Mark the shipment delivered by receiving the goods.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function NewPurchaseModal({ onClose, onSaved }) {
  const { scope, specificBranchId } = useBranchScope();
  const [factories, setFactories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const { hasPermission: can } = useAuth();
  const canAddSupplier = can('SUPPLIER_MANAGE');
  const [materials, setMaterials] = useState([]);
  const [type, setType] = useState('LOCAL');
  const [branchId, setBranchId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [intl, setIntl] = useState({
    originCountry: '', destinationCountry: 'Ethiopia', shippingMethod: 'SEA', shippingRoute: '', currency: 'USD', exchangeRate: '', customsCost: '', freightCost: '', otherCost: '',
    shipmentStatus: 'ORDERED', expectedArrival: '',
  });
  const [receiveNow, setReceiveNow] = useState(true);
  const [stages, setStages] = useState(() => defaultRoute('', 'Ethiopia', ''));   // the route: first stop = origin, last = destination
  const [pay, setPay] = useState({ paymentType: 'PAID', amountPaid: '', creditDueDate: '' });
  const [lines, setLines] = useState([{ key: 0, materialId: '', quantity: '', unitCost: '', batchNumber: '', expiryDate: '' }]);
  const [nextKey, setNextKey] = useState(1);
  const [requestKey] = useState(newKey); // one key per dialog: sending twice can never create two purchases
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const international = type === 'INTERNATIONAL';
  const setI = (p) => setIntl((v) => ({ ...v, ...p }));

  useEffect(() => {
    listBranches('FACTORY').then((list) => {
      const arr = (Array.isArray(list) ? list : (list?.content ?? [])).filter((b) => b.type === 'FACTORY');
      setFactories(arr);
      if (arr.length === 1) setBranchId(arr[0].id);
      else if (scope === 'SPECIFIC' && arr.some((b) => b.id === specificBranchId)) setBranchId(specificBranchId);
    }).catch(() => {});
    listSuppliers().then((s) => setSuppliers(Array.isArray(s) ? s : (s?.content ?? []))).catch(() => {});
    getRawMaterials({ scope: 'ALL' }).then(setMaterials).catch(() => {});
  }, []);

  // local purchases are normally received at once; international ones when the goods arrive
  useEffect(() => { setReceiveNow(!international); }, [international]);

  const patch = (key, p) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const rate = international ? Number(intl.exchangeRate) || 0 : 1;
  const goodsForeign = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  const goodsLocal = goodsForeign * rate;
  const extras = international ? (Number(intl.customsCost) || 0) + (Number(intl.freightCost) || 0) + (Number(intl.otherCost) || 0) : 0;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!branchId) { setError('Choose the factory that receives the materials.'); return; }
    if (lines.some((l) => !l.materialId || !(Number(l.quantity) > 0) || l.unitCost === '' || Number(l.unitCost) < 0)) {
      setError('Every line needs a raw material, a whole quantity of at least 1 and a price per unit.');
      return;
    }
    if (lines.some((l) => !l.batchNumber.trim() || !l.expiryDate)) {
      setError('Every line needs its batch number and expiry date.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (lines.some((l) => l.expiryDate < today)) {
      setError('A batch that has already expired cannot be bought into stock.');
      return;
    }
    if (pay.paymentType !== 'PAID' && !supplierId) { setError('Choose the supplier - a purchase that is not fully paid is owed to somebody.'); return; }
    if (pay.paymentType === 'PARTIAL' && !(Number(pay.amountPaid) > 0)) { setError('Enter how much you paid now.'); return; }
    if (international && (!intl.originCountry.trim() || !(Number(intl.exchangeRate) > 0) || intl.currency.trim().length !== 3)) {
      setError('An international purchase needs the origin country, a 3-letter currency and the exchange rate to the local currency.');
      return;
    }
    if (international && stages.length < 2) { setError('The route needs at least two stops: where the goods start and where they end up.'); return; }
    setSaving(true);
    try {
      const created = await createRawMaterialPurchase({
        requestKey, purchaseType: type, supplierId: supplierId || undefined, branchId, purchaseDate: date || undefined,
        notes: notes.trim() || undefined, receiveNow,
        paymentType: pay.paymentType,
        amountPaid: pay.paymentType === 'PARTIAL' ? Number(pay.amountPaid) : undefined,
        creditDueDate: pay.paymentType !== 'PAID' && pay.creditDueDate ? pay.creditDueDate : undefined,
        items: lines.map((l) => ({ materialId: l.materialId, quantity: Number(l.quantity), unitCost: Number(l.unitCost), batchNumber: l.batchNumber.trim(), expiryDate: l.expiryDate })),
        ...(international ? {
          supplierCountry: intl.originCountry.trim(), originCountry: intl.originCountry.trim(),
          destinationCountry: intl.destinationCountry.trim() || undefined, shippingMethod: intl.shippingMethod, stages: stages.map(stageToRequest),
          currency: intl.currency.trim().toUpperCase(), exchangeRate: Number(intl.exchangeRate),
          customsCost: Number(intl.customsCost || 0), freightCost: Number(intl.freightCost || 0), otherCost: Number(intl.otherCost || 0),
          shipmentStatus: intl.shipmentStatus, expectedArrival: intl.expectedArrival || undefined,
        } : {}),
      });
      onSaved(created);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="New Raw Material Purchase" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="inline-flex rounded-lg border border-cream-300 p-0.5 text-sm" role="group" aria-label="Purchase type">
          {['LOCAL', 'INTERNATIONAL'].map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`rounded-md px-3 py-1 font-medium transition ${type === t ? 'bg-sage-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}>
              {t === 'LOCAL' ? 'Local' : 'International'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Receive into factory">
            <select required className="input" value={branchId} onChange={(e) => {
              const prev = factories.find((b) => b.id === branchId)?.name;
              const next = factories.find((b) => b.id === e.target.value)?.name || '';
              setBranchId(e.target.value);
              setStages((st) => st.map((x, i, all) => (i === all.length - 1 && (!x.location || x.location === prev) ? { ...x, location: next } : x)));
            }}>
              <option value="">Select…</option>
              {factories.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Supplier (optional)">
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers.filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {canAddSupplier && (
              <button type="button" className="mt-1 text-xs font-medium text-sage-600 hover:underline" onClick={async () => {
                const name = window.prompt('New supplier name');
                if (!name || !name.trim()) return;
                try {
                  const created = await createSupplier({ name: name.trim() });
                  setSuppliers((list) => [...list, created]); setSupplierId(created.id);
                } catch (err) { setError(extractErrorMessage(err)); }
              }}>+ New supplier</button>
            )}
          </Field>
        </div>
        <Field label="Purchase date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-ink-500">Payment</span>
          <div className="inline-flex rounded-lg border border-cream-300 p-0.5" role="radiogroup" aria-label="Payment">
            {[{ value: 'PAID', label: 'Fully paid' }, { value: 'PARTIAL', label: 'Partial' }, { value: 'CREDIT', label: 'Credit' }].map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={pay.paymentType === o.value}
                onClick={() => setPay({ ...pay, paymentType: o.value })}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${pay.paymentType === o.value ? 'bg-sage-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {pay.paymentType !== 'PAID' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pay.paymentType === 'PARTIAL' && (
                <Field label={`Amount paid now${international && intl.currency ? ` (${intl.currency.trim()})` : ''}`}>
                  <input required type="number" min="0.01" step="0.01" className="input" value={pay.amountPaid} onChange={(e) => setPay({ ...pay, amountPaid: e.target.value })} />
                </Field>
              )}
              <Field label="Pay the rest by (optional)">
                <input type="date" className="input" min={date} value={pay.creditDueDate} onChange={(e) => setPay({ ...pay, creditDueDate: e.target.value })} />
              </Field>
              <p className="text-xs text-ink-500 sm:col-span-2">
                {pay.paymentType === 'PARTIAL' && goodsForeign > 0 && Number(pay.amountPaid) > 0
                  ? <>Goods total {fmt(goodsForeign)}, paid now {fmt(Number(pay.amountPaid))}, balance owed <strong>{fmt(Math.max(goodsForeign - Number(pay.amountPaid), 0))}</strong>. </>
                  : null}
                {pay.paymentType === 'PARTIAL' ? 'The balance' : 'What you owe this supplier'} is recorded on <strong>My Credits &amp; Loans</strong>, where you record each repayment.
              </p>
            </div>
          )}
        </div>

        <CountryDatalist countries={COUNTRIES} />
        {international && (
          <div className="space-y-3 rounded-lg border border-cream-200 bg-cream-50 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Origin country"><input required maxLength={100} list="country-options" placeholder="e.g. China" className="input" value={intl.originCountry} onChange={(e) => { setI({ originCountry: e.target.value }); setStages((st) => st.map((x, i) => (i === 0 ? { ...x, country: e.target.value } : x))); }} /></Field>
              <Field label="Destination country"><input required maxLength={100} list="country-options" placeholder="e.g. Ethiopia" className="input" value={intl.destinationCountry} onChange={(e) => { setI({ destinationCountry: e.target.value }); setStages((st) => st.map((x, i, all) => (i === all.length - 1 ? { ...x, country: e.target.value } : x))); }} /></Field>
              <Field label="Shipping method">
                <select className="input" value={intl.shippingMethod} onChange={(e) => setI({ shippingMethod: e.target.value })}>
                  {SHIPPING_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Expected arrival"><input type="date" className="input" value={intl.expectedArrival} onChange={(e) => setI({ expectedArrival: e.target.value })} /></Field>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-500">Shipping route (every stop from the supplier to the factory)</span>
              <RouteEditor stages={stages} onChange={setStages} lockEnds />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Currency">
                <input required list="rm-currencies" maxLength={3} className="input uppercase" value={intl.currency} onChange={(e) => setI({ currency: e.target.value })} />
                <datalist id="rm-currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label={`Exchange rate (1 ${intl.currency || '…'} = ? local)`}><input required type="number" min="0.000001" step="any" className="input" value={intl.exchangeRate} onChange={(e) => setI({ exchangeRate: e.target.value })} /></Field>
              <Field label="Shipment status">
                <select className="input" value={intl.shipmentStatus} onChange={(e) => setI({ shipmentStatus: e.target.value })}>
                  {SHIPMENT_STATUSES.filter((x) => x !== 'DELIVERED').map((x) => <option key={x} value={x}>{label(x)}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Customs (local)"><input type="number" min="0" step="0.01" className="input" value={intl.customsCost} onChange={(e) => setI({ customsCost: e.target.value })} /></Field>
              <Field label="Freight (local)"><input type="number" min="0" step="0.01" className="input" value={intl.freightCost} onChange={(e) => setI({ freightCost: e.target.value })} /></Field>
              <Field label="Other costs (local)"><input type="number" min="0" step="0.01" className="input" value={intl.otherCost} onChange={(e) => setI({ otherCost: e.target.value })} /></Field>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500">Raw materials</span>
            <button type="button" className="text-xs font-medium text-sage-600 hover:underline"
              onClick={() => { setLines((ls) => [...ls, { key: nextKey, materialId: '', quantity: '', unitCost: '', batchNumber: '', expiryDate: '' }]); setNextKey((k) => k + 1); }}>+ Add line</button>
          </div>
          <div className="space-y-2">
            {lines.map((l) => {
              const m = materials.find((x) => x.id === l.materialId);
              return (
                <div key={l.key} className="flex flex-wrap items-start gap-2">
                  <select required className="input flex-1" value={l.materialId} onChange={(e) => patch(l.key, { materialId: e.target.value })}>
                    <option value="">Select raw material…</option>
                    {materials.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                  </select>
                  <input required type="number" min="0.001" step="any" className="input w-28" placeholder={m ? `Qty (${m.unit})` : 'Qty'} value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value })} />
                  <input required type="number" min="0" step="any" className="input w-32" placeholder={international ? `Price (${intl.currency || '…'})` : 'Cost / unit'} value={l.unitCost} onChange={(e) => patch(l.key, { unitCost: e.target.value })} />
                  <input required maxLength={80} className="input w-32" placeholder="Batch no." value={l.batchNumber} onChange={(e) => patch(l.key, { batchNumber: e.target.value })} />
                  <input required type="date" min={new Date().toISOString().slice(0, 10)} className="input w-40" title="Expiry date" value={l.expiryDate} onChange={(e) => patch(l.key, { expiryDate: e.target.value })} />
                  {lines.length > 1 && (
                    <button type="button" className="btn-icon mt-1" title="Remove" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {materials.length === 0 && <p className="mt-1 text-xs text-ink-400">No raw materials yet - add them on the Raw Material Management page first.</p>}
        </div>

        <Field label="Notes (optional)"><textarea rows={2} maxLength={1000} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={receiveNow} onChange={(e) => setReceiveNow(e.target.checked)} />
          Received in full now (put into stock immediately)
        </label>
        {!receiveNow && <p className="-mt-2 text-xs text-ink-500">Nothing goes into stock yet. Record each delivery on the purchase when the goods arrive.</p>}

        <div className="space-y-0.5 text-right text-sm">
          {international && <p className="text-ink-500">Goods {Number(goodsForeign.toFixed(2)).toLocaleString()} {intl.currency} = {formatMoney(goodsLocal)}</p>}
          {international && <p className="text-ink-500">Customs + freight + other {formatMoney(extras)}</p>}
          <p className="font-semibold">{international ? 'Landed total' : 'Total'} {formatMoney(goodsLocal + extras)}</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : receiveNow ? 'Receive into stock' : 'Save purchase'}</button>
        </div>
      </form>
    </Modal>
  );
}
