import React, { useEffect, useMemo, useState } from 'react';
import {
  getRawMaterials, planProduction, createRawMaterial, updateRawMaterial, adjustRawMaterial, transferRawMaterial,
  listRawMaterialMovements,
} from '../../api/manufacturing.js';
import { listBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Modal from '../../components/Modal.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StockStatusBadge from '../../components/StockStatusBadge.jsx';
import { formatMoney } from '../../utils/format.js';
import BatchesPanel, { ExpiryAlertBanner } from './BatchesPanel.jsx';

const fmt = (n) => Number(n).toLocaleString();

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}

/** The factories the user may work with (a factory user only gets their own). */
function useFactories() {
  const [factories, setFactories] = useState([]);
  useEffect(() => {
    listBranches('FACTORY').then((list) => {
      setFactories((Array.isArray(list) ? list : (list?.content ?? [])).filter((b) => b.type === 'FACTORY'));
    }).catch(() => {});
  }, []);
  return factories;
}

/**
 * Raw material management - part of Manufacturing, completely separate from the store / warehouse inventory.
 * Shows the stock of the factory (or factories) picked in the branch selector at the top.
 */
export default function RawMaterialsPage() {
  const { hasPermission, user } = useAuth();
  const { scopeParams, scope, specificBranchId, branches, isAdministrator } = useBranchScope();
  const canManage = hasPermission('BOM_MANAGE');
  const canStock = hasPermission('PRODUCTION_MANAGE');
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'form' | 'adjust' | 'transfer' | 'history', row? }
  const [batchKey, setBatchKey] = useState(0);

  const load = () => {
    setStatus('loading');
    getRawMaterials(scopeParams).then((d) => { setRows(d); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  };
  // reload whenever the branch selector at the top changes: this page shows the picked factory (or factories) only
  useEffect(load, [scopeParams.scope, scopeParams.branchId]);

  const viewing = !isAdministrator
    ? (user?.branchName ?? 'your factory')
    : scope === 'SPECIFIC'
    ? (branches.find((b) => b.id === specificBranchId)?.name ?? 'the selected factory')
    : scope === 'FACTORIES' || scope === 'ALL' ? 'all factories' : null;

  const done = (msg) => { setModal(null); setNotice(msg); load(); setBatchKey((k) => k + 1); };

  const columns = [
    { key: 'name', header: 'Raw material', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'sku', header: 'Code' },
    { key: 'onHand', header: 'On hand', render: (r) => `${fmt(r.onHand)} ${r.unit}`, className: 'text-right' },
    { key: 'reorderLevel', header: 'Reorder at', render: (r) => fmt(r.reorderLevel), className: 'text-right' },
    { key: 'averageCost', header: 'Avg cost', render: (r) => formatMoney(r.averageCost), className: 'text-right' },
    { key: 'stockValue', header: 'Stock value', render: (r) => formatMoney(r.stockValue), className: 'text-right' },
    { key: 'requiredForOpenOrders', header: 'Needed for open production', render: (r) => (r.requiredForOpenOrders > 0 ? `${fmt(r.requiredForOpenOrders)} ${r.unit}` : '—'), className: 'text-right' },
    { key: 'shortfall', header: 'Shortfall', render: (r) => (r.shortfall > 0 ? <span className="font-medium text-red-600">{fmt(r.shortfall)} {r.unit}</span> : '—'), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r) => <StockStatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', className: 'text-right whitespace-nowrap',
      render: (r) => (
        <span className="flex justify-end gap-2 text-xs font-medium text-sage-600">
          {canStock && <button type="button" className="hover:underline" onClick={() => setModal({ kind: 'adjust', row: r })}>Adjust</button>}
          {canStock && <button type="button" className="hover:underline" onClick={() => setModal({ kind: 'transfer', row: r })}>Transfer</button>}
          <button type="button" className="hover:underline" onClick={() => setModal({ kind: 'history', row: r })}>History</button>
          {canManage && <button type="button" className="hover:underline" onClick={() => setModal({ kind: 'form', row: r })}>Edit</button>}
        </span>
      ),
    },
  ];

  const shown = useMemo(() => (rows || []).filter((r) =>
    (!statusFilter || r.status === statusFilter || (statusFilter === 'SHORT' && r.shortfall > 0))
    && (!search || `${r.name} ${r.sku ?? ''}`.toLowerCase().includes(search.toLowerCase()))), [rows, search, statusFilter]);

  const low = (rows || []).filter((r) => r.status === 'LOW_STOCK').length;
  const out = (rows || []).filter((r) => r.status === 'OUT_OF_STOCK').length;
  const short = (rows || []).filter((r) => r.shortfall > 0).length;
  const value = (rows || []).reduce((s, r) => s + Number(r.stockValue), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Raw Material Management</h1>
        {canManage && <button onClick={() => setModal({ kind: 'form', row: null })} className="btn btn-primary btn-sm">+ Add Raw Material</button>}
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Raw materials belong to the factories and are managed only here in Manufacturing; they are not part of the store or warehouse inventory.
        Showing stock for <strong>{viewing ?? 'the selected branch'}</strong>. Buy materials on the Raw Material Purchases page; they are received into the factory you choose.
      </p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}
      <ExpiryAlertBanner key={batchKey} />

      {rows && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} label="Raw materials" value={String(rows.length)} />
          <KpiCard index={1} label="Low / out of stock" value={`${low} / ${out}`} warn={low + out > 0} />
          <KpiCard index={2} label="Short for production" value={String(short)} warn={short > 0} hint="needed but not in stock" />
          <KpiCard index={3} label="Stock value" value={formatMoney(value)} emphasize />
        </div>
      )}

      <div className="card card-pad mb-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="Search"><SearchInput value={search} onChange={setSearch} placeholder="Name or code…" width="w-full sm:w-64" /></Field>
          <Field label="Show">
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All raw materials</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="SHORT">Short for production</option>
              <option value="IN_STOCK">In stock</option>
            </select>
          </Field>
        </div>
        {status === 'loading' && !rows && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {rows && status !== 'error' && (
          <DataTable columns={columns} rows={shown} emptyMessage={scope === 'STORES' || scope === 'WAREHOUSES'
            ? 'Raw materials belong to factories. Pick a factory (or All Factories) in the branch selector at the top.'
            : 'No raw materials yet. Add the materials you use to make your products.'} />
        )}
      </div>

      <BatchesPanel refreshKey={batchKey} />

      <Planner />

      {modal?.kind === 'form' && <MaterialFormModal row={modal.row} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'adjust' && <AdjustModal row={modal.row} defaultBranchId={scope === 'SPECIFIC' ? specificBranchId : ''} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'transfer' && <TransferModal row={modal.row} defaultBranchId={scope === 'SPECIFIC' ? specificBranchId : ''} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'history' && <HistoryModal row={modal.row} scopeParams={scopeParams} onClose={() => setModal(null)} />}
    </div>
  );
}

/** Pick a product, a quantity and a factory: what the recipe needs, what is in stock, and how many units you could make now. */
function Planner() {
  const { scope, specificBranchId } = useBranchScope();
  const [branches, setBranches] = useState([]);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [branchId, setBranchId] = useState('');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listBranches('FACTORY').then((list) => {
      const arr = Array.isArray(list) ? list : (list?.content ?? []);
      setBranches(arr);
      if (arr.length === 1) setBranchId(arr[0].id);
      else if (scope === 'SPECIFIC' && arr.some((b) => b.id === specificBranchId)) setBranchId(specificBranchId);
    }).catch(() => {});
  }, [scope, specificBranchId]);

  const check = async (e) => {
    e.preventDefault();
    setError('');
    setPlan(null);
    if (!product) { setError('Choose the product to make.'); return; }
    setBusy(true);
    try {
      setPlan(await planProduction({ productId: product.id, quantity: Number(quantity), branchId }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <h2 className="mb-1 text-base font-semibold text-ink-900">Production planner</h2>
      <p className="mb-3 text-sm text-ink-500">Can we make it? Enter the quantity you want to produce and see the raw materials it needs against your stock.</p>
      <form onSubmit={check} className="mb-3 grid grid-cols-1 items-end gap-3 md:grid-cols-4">
        <Field label="Product">
          <ProductSelect value={product} onChange={setProduct} productType="FINISHED_GOOD" placeholder="Search finished product…" />
        </Field>
        <Field label="Quantity to produce">
          <input required type="number" min="1" step="1" className="input" placeholder="e.g. 25000" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Factory">
          <select required className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Checking...' : 'Check materials'}</button>
      </form>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {plan && (
        <div className="space-y-3">
          <p className={`rounded-lg px-3 py-2 text-sm font-medium ${plan.canProduce ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {plan.canProduce
              ? `You have enough materials to make ${fmt(plan.quantity)} ${plan.productName}.`
              : `Not enough materials for ${fmt(plan.quantity)} ${plan.productName}. With current stock you can make up to ${fmt(plan.maxProducible)}.`}
          </p>
          <p className="text-sm text-ink-500">
            {fmt(plan.quantity)} units = {fmt(plan.batchesNeeded)} batch{plan.batchesNeeded === 1 ? '' : 'es'} of {fmt(plan.batchSize)}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-1 pr-3">Material</th><th className="py-1 pr-3 text-right">Required</th>
                  <th className="py-1 pr-3 text-right">In stock</th><th className="py-1 pr-3 text-right">Short</th><th className="py-1 text-right">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {plan.lines.map((l) => (
                  <tr key={l.materialId} className="border-t border-cream-200">
                    <td className="py-1.5 pr-3 text-ink-800">{l.materialName}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(l.required)} {l.unit}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(l.inStock)} {l.unit}</td>
                    <td className={`py-1.5 pr-3 text-right ${l.shortfall > 0 ? 'font-medium text-red-600' : 'text-ink-400'}`}>{l.shortfall > 0 ? `${fmt(l.shortfall)} ${l.unit}` : '—'}</td>
                    <td className="py-1.5 text-right">{formatMoney(l.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-ink-400">Materials</p><p className="font-medium">{formatMoney(plan.estimatedMaterialCost)}</p></div>
            <div><p className="text-xs text-ink-400">Labour + overhead</p><p className="font-medium">{formatMoney(Number(plan.estimatedLaborCost) + Number(plan.estimatedOverheadCost))}</p></div>
            <div><p className="text-xs text-ink-400">Estimated total</p><p className="font-medium">{formatMoney(plan.estimatedTotalCost)}</p></div>
            <div><p className="text-xs text-ink-400">Cost per unit</p><p className="font-semibold">{formatMoney(plan.estimatedUnitCost)}</p></div>
          </div>
          <p className="text-xs text-ink-400">Estimate only: materials are valued at their average cost in stock; the real cost is set when production is completed.</p>
        </div>
      )}
    </div>
  );
}

function MaterialFormModal({ row, onClose, onSaved }) {
  const editing = !!row;
  const [form, setForm] = useState({
    name: row?.name ?? '', sku: row?.sku ?? '', unit: row?.unit ?? '', reorderLevel: row?.reorderLevel ?? '', active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: form.name.trim(), sku: form.sku.trim() || undefined, unit: form.unit.trim(),
      reorderLevel: form.reorderLevel === '' ? 0 : Number(form.reorderLevel), active: form.active,
    };
    try {
      if (editing) await updateRawMaterial(row.id, payload); else await createRawMaterial(payload);
      onSaved(editing ? 'Raw material saved.' : `"${payload.name}" was added. Buy it on the Raw Material Purchases page to put it in stock.`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? 'Edit Raw Material' : 'Add Raw Material'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name"><input required autoFocus maxLength={200} className="input" placeholder="e.g. Wheat flour" value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Code (optional)"><input maxLength={60} className="input" value={form.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Unit of measure"><input required maxLength={30} className="input" placeholder="kg, litre, piece…" value={form.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
          <Field label="Reorder level"><input type="number" min="0" step="any" className="input" value={form.reorderLevel} onChange={(e) => set({ reorderLevel: e.target.value })} /></Field>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> Active (can be bought and used in recipes)
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : editing ? 'Save changes' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Correct a factory's stock of one raw material (count difference, spoilage...). + adds, - removes. */
function AdjustModal({ row, defaultBranchId, onClose, onSaved }) {
  const factories = useFactories();
  const [branchId, setBranchId] = useState(defaultBranchId || '');
  const [change, setChange] = useState('');
  const [cost, setCost] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!branchId && factories.length === 1) setBranchId(factories[0].id); }, [factories]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const q = Number(change);
    if (!Number.isInteger(q) || q === 0) { setError('Enter a whole quantity other than 0 (use a minus sign to remove).'); return; }
    if (q > 0 && (!batchNumber.trim() || !expiryDate)) { setError('Stock that is added needs its batch number and expiry date.'); return; }
    setSaving(true);
    try {
      await adjustRawMaterial({
        materialId: row.id, branchId, quantityChange: q, reason: reason.trim(),
        unitCost: q > 0 && cost !== '' ? Number(cost) : undefined,
        batchNumber: q > 0 ? batchNumber.trim() : undefined, expiryDate: q > 0 ? expiryDate : undefined, receivedDate: q > 0 && receivedDate ? receivedDate : undefined,
      });
      onSaved(`Stock of ${row.name} adjusted.`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Adjust stock – ${row.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Factory">
          <select required className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select…</option>
            {factories.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={`Change (${row.unit}) – e.g. 50 or -10`}><input required type="number" step="any" className="input" value={change} onChange={(e) => setChange(e.target.value)} /></Field>
          <Field label="Cost per unit (only when adding)"><input type="number" min="0" step="0.01" className="input" placeholder="average cost if empty" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </div>
        {Number(change) > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Batch number *"><input required maxLength={80} className="input" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} /></Field>
            <Field label="Expiry date *"><input required type="date" min={new Date().toISOString().slice(0, 10)} className="input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
            <Field label="Received date"><input type="date" max={new Date().toISOString().slice(0, 10)} className="input" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} /></Field>
          </div>
        )}
        {Number(change) < 0 && <p className="text-xs text-ink-500">Removing takes from the batch that expires first. This is also how expired stock is written off.</p>}
        <Field label="Reason"><input required maxLength={500} className="input" placeholder="e.g. stock count, spoilage, opening stock" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Move raw material from one factory to another factory. */
function TransferModal({ row, defaultBranchId, onClose, onSaved }) {
  const factories = useFactories();
  const [from, setFrom] = useState(defaultBranchId || '');
  const [to, setTo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await transferRawMaterial({ materialId: row.id, fromBranchId: from, toBranchId: to, quantity: Number(quantity), reason: reason.trim() || undefined });
      onSaved(`${fmt(quantity)} ${row.unit} of ${row.name} transferred.`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Transfer – ${row.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-ink-500">Raw materials can only move between factories.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="From factory">
            <select required className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Select…</option>
              {factories.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="To factory">
            <select required className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Select…</option>
              {factories.filter((b) => b.id !== from).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label={`Quantity (${row.unit})`}><input required type="number" min="0.001" step="any" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Note (optional)"><input maxLength={500} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Transfer'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Stock history of one raw material at the factories picked in the branch selector. */
function HistoryModal({ row, scopeParams, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    listRawMaterialMovements({ materialId: row.id, size: 30, ...scopeParams }).then(setData).catch((e) => setError(extractErrorMessage(e)));
  }, [row.id]);

  return (
    <Modal open title={`Stock history – ${row.name}`} onClose={onClose}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <LoadingState />}
      {data && data.content.length === 0 && <p className="text-sm text-ink-500">No movements yet.</p>}
      {data && data.content.length > 0 && (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-1 pr-3">When</th><th className="py-1 pr-3">Factory</th><th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3 text-right">Change</th><th className="py-1 pr-3 text-right">Balance</th><th className="py-1">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((m) => (
                <tr key={m.id} className="border-t border-cream-200 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">{m.branchName}</td>
                  <td className="py-1.5 pr-3">{m.type.replace('_', ' ').toLowerCase()}</td>
                  <td className={`py-1.5 pr-3 text-right ${m.quantityChange < 0 ? 'text-red-600' : 'text-green-700'}`}>{m.quantityChange > 0 ? '+' : ''}{fmt(m.quantityChange)}</td>
                  <td className="py-1.5 pr-3 text-right">{fmt(m.balanceAfter)}</td>
                  <td className="py-1.5 text-ink-500">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
