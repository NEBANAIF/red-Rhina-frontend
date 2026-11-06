import React, { useEffect, useState } from 'react';
import { listBoms, createBom, updateBom, getRawMaterials } from '../../api/manufacturing.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import Icon from '../../components/Icon.jsx';
import { formatMoney } from '../../utils/format.js';

const COLUMNS = [
  { key: 'productName', header: 'Finished product', render: (r) => <span className="font-medium text-ink-900">{r.productName}</span> },
  { key: 'productSku', header: 'SKU' },
  { key: 'batchSize', header: 'One batch makes', render: (r) => `${r.batchSize.toLocaleString()} units`, className: 'text-right' },
  { key: 'lines', header: 'Raw materials', render: (r) => `${r.lines.length} item${r.lines.length === 1 ? '' : 's'}` },
  { key: 'estimatedMaterialCostPerBatch', header: 'Materials / batch', render: (r) => formatMoney(r.estimatedMaterialCostPerBatch), className: 'text-right' },
  { key: 'laborCostPerBatch', header: 'Labour / batch', render: (r) => formatMoney(r.laborCostPerBatch), className: 'text-right' },
  { key: 'overheadCostPerBatch', header: 'Overhead / batch', render: (r) => formatMoney(r.overheadCostPerBatch), className: 'text-right' },
  { key: 'estimatedBatchCost', header: 'Batch cost', render: (r) => <span className="font-semibold">{formatMoney(r.estimatedBatchCost)}</span>, className: 'text-right' },
  { key: 'estimatedCostPerUnit', header: 'Cost / unit', render: (r) => <span className="font-semibold">{formatMoney(r.estimatedCostPerUnit)}</span>, className: 'text-right' },
];

/** Bills of materials: the recipe (raw materials + standard labour and overhead) for ONE unit of each finished product. */
export default function BomsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('BOM_MANAGE');
  const [boms, setBoms] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [formFor, setFormFor] = useState(undefined); // undefined = closed, null = new, object = edit
  const [notice, setNotice] = useState('');

  const load = () => {
    setStatus('loading');
    listBoms().then((d) => { setBoms(d); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  };
  useEffect(load, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Bills of Materials</h1>
        {canManage && <button onClick={() => setFormFor(null)} className="btn btn-primary btn-sm">+ New Bill of Materials</button>}
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        The recipe for ONE production batch of a finished product: how many units the batch makes, the raw materials it uses and its standard labour and overhead cost.
        Raw materials are managed on the Raw Materials page of Manufacturing (they are not inventory products).
      </p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      <div className="card card-pad">
        {status === 'loading' && !boms && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {boms && status !== 'error' && (
          <DataTable columns={COLUMNS} rows={boms} onRowClick={canManage ? (r) => setFormFor(r) : undefined}
            emptyMessage="No bills of materials yet. Add one for each product you make." />
        )}
      </div>

      {formFor !== undefined && (
        <BomFormModal
          bom={formFor}
          onClose={() => setFormFor(undefined)}
          onSaved={(wasNew) => { setFormFor(undefined); setNotice(wasNew ? 'Bill of materials added.' : 'Changes saved.'); load(); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}

function BomFormModal({ bom, onClose, onSaved }) {
  const editing = !!bom;
  const [product, setProduct] = useState(bom ? { id: bom.productId, name: bom.productName, sku: bom.productSku } : null);
  const [single, setSingle] = useState(!bom || bom.batchSize === 1);   // simple: the recipe and cost of ONE unit
  const [batchSize, setBatchSize] = useState(bom?.batchSize ?? 1);
  const [labor, setLabor] = useState(bom?.laborCostPerBatch ?? '');
  const [overhead, setOverhead] = useState(bom?.overheadCostPerBatch ?? '');
  const [notes, setNotes] = useState(bom?.notes ?? '');
  const [lines, setLines] = useState(
    bom ? bom.lines.map((l, i) => ({ key: i, material: { id: l.materialId, name: l.materialName, sku: l.materialSku, unit: l.unit }, qty: l.quantity, mode: l.calcMode || 'PER_BATCH', avg: l.averageUnitCost })) : [],
  );
  const [nextKey, setNextKey] = useState(bom ? bom.lines.length : 0);
  const [materials, setMaterials] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // the manufacturing raw material catalogue (separate from the inventory products)
  useEffect(() => { getRawMaterials({ scope: 'ALL' }).then(setMaterials).catch(() => setMaterials([])); }, []);

  const addLine = () => { setLines((l) => [...l, { key: nextKey, material: null, qty: '', mode: 'PER_BATCH' }]); setNextKey((k) => k + 1); };
  const patchLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  // live preview: quantities both ways and cost, from the average stock cost of each material
  const batchN = single ? 1 : (Number(batchSize) > 0 ? Number(batchSize) : 0);
  const avgOf = (l) => Number(materials.find((m) => m.id === l.material?.id)?.averageCost ?? l.avg ?? 0);
  const perBatch = (l) => (l.mode === 'PER_UNIT' ? Number(l.qty || 0) * batchN : Number(l.qty || 0));
  const perUnit = (l) => (l.mode === 'PER_UNIT' ? Number(l.qty || 0) : (batchN ? Number(l.qty || 0) / batchN : 0));
  const materialCost = lines.reduce((sum, l) => sum + perBatch(l) * avgOf(l), 0);
  const batchCost = materialCost + Number(labor || 0) + Number(overhead || 0);
  const unitCost = batchN ? batchCost / batchN : 0;
  const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!product) { setError('Choose the finished product.'); return; }
    if (!single && !(Number(batchSize) >= 1)) { setError('Enter how many units one batch makes.'); return; }
    if (lines.length === 0 || lines.some((l) => !l.material || !(Number(l.qty) > 0))) {
      setError('Add at least one raw material, each with a quantity above 0.');
      return;
    }
    setSaving(true);
    const payload = {
      productId: product.id,
      batchSize: single ? 1 : Number(batchSize),
      laborCostPerBatch: labor === '' ? 0 : Number(labor),
      overheadCostPerBatch: overhead === '' ? 0 : Number(overhead),
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({ materialId: l.material.id, quantity: Number(l.qty), calcMode: single ? 'PER_UNIT' : l.mode })),
    };
    try {
      if (editing) await updateBom(bom.id, payload); else await createBom(payload);
      onSaved(!editing);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? `Bill of Materials – ${bom.productName}` : 'New Bill of Materials'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Finished product">
          {editing ? (
            <p className="input bg-cream-100">{bom.productName} <span className="text-ink-400">({bom.productSku})</span></p>
          ) : (
            <ProductSelect value={product} onChange={setProduct} productType="FINISHED_GOOD" placeholder="Search finished product…" />
          )}
        </Field>

        <div className="inline-flex rounded-lg border border-cream-300 p-0.5 text-sm" role="group" aria-label="How is it made">
          {[{ v: true, t: 'One unit (simple)' }, { v: false, t: 'In batches' }].map((o) => (
            <button key={String(o.v)} type="button" onClick={() => { setSingle(o.v); if (o.v) setBatchSize(1); else if (Number(batchSize) < 2) setBatchSize(''); }}
              className={`rounded-md px-3 py-1 font-medium transition ${single === o.v ? 'bg-sage-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}>{o.t}</button>
          ))}
        </div>
        {single ? (
          <p className="text-xs text-ink-500">Enter what it takes to make ONE unit of this product: the raw materials for one unit, plus the labour and overhead cost of one unit.</p>
        ) : (
          <Field label="One production batch makes (units)">
            <input required type="number" min="2" step="1" className="input" placeholder="e.g. 10000" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
          </Field>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500">{single ? 'Raw materials for ONE unit' : 'Raw materials (quantity, and whether it is per unit or per batch)'}</span>
            <button type="button" onClick={addLine} className="text-xs font-medium text-sage-600 hover:underline">+ Add material</button>
          </div>
          {lines.length === 0 && <p className="text-xs text-ink-400">No materials yet.</p>}
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="flex items-start gap-2">
                <div className="flex-1">
                  <select required className="input" value={l.material?.id ?? ''}
                    onChange={(e) => patchLine(l.key, { material: materials.find((m) => m.id === e.target.value) ?? null })}>
                    <option value="">Select raw material…</option>
                    {l.material && !materials.some((m) => m.id === l.material.id) && (
                      <option value={l.material.id}>{l.material.name} ({l.material.unit})</option>
                    )}
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                  </select>
                </div>
                <input type="number" min="0.001" step="0.001" placeholder={l.material ? `Qty (${l.material.unit})` : 'Qty'} className="input w-28"
                  value={l.qty} onChange={(e) => patchLine(l.key, { qty: e.target.value })} />
                {!single && <select className="input w-32" value={l.mode} onChange={(e) => patchLine(l.key, { mode: e.target.value })} title="How this quantity is counted">
                  <option value="PER_UNIT">per unit</option>
                  <option value="PER_BATCH">per batch</option>
                </select>}
                <button type="button" onClick={() => removeLine(l.key)} className="btn-icon mt-1" title="Remove" aria-label="Remove material">
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {lines.some((l) => l.material && Number(l.qty) > 0) && batchN > 0 && !single && (
          <div className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs text-ink-700">
            <div className="mb-1 font-medium text-ink-500">Calculated quantities (one batch = {batchN.toLocaleString()} units)</div>
            {lines.filter((l) => l.material && Number(l.qty) > 0).map((l) => (
              <div key={l.key} className="flex flex-wrap justify-between gap-x-3">
                <span>{l.material.name}</span>
                <span>{fmt(perBatch(l))} {l.material.unit} / batch · {fmt(perUnit(l))} {l.material.unit} / unit{avgOf(l) > 0 ? ` · ${formatMoney(perBatch(l) * avgOf(l))}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={single ? 'Labour cost for 1 unit' : 'Labour cost per batch'}><input type="number" min="0" step="0.01" className="input" value={labor} onChange={(e) => setLabor(e.target.value)} /></Field>
          <Field label={single ? 'Overhead cost for 1 unit' : 'Overhead cost per batch'}><input type="number" min="0" step="0.01" className="input" value={overhead} onChange={(e) => setOverhead(e.target.value)} /></Field>
        </div>
        {batchN > 0 && !single && (
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-sage-50 px-3 py-2 text-center text-xs text-ink-700">
            <div><div className="text-ink-500">Materials / batch</div><div className="font-semibold">{formatMoney(materialCost)}</div></div>
            <div><div className="text-ink-500">Total batch cost</div><div className="font-semibold">{formatMoney(batchCost)}</div></div>
            <div><div className="text-ink-500">Cost per unit</div><div className="font-semibold">{formatMoney(unitCost)}</div></div>
          </div>
        )}
        {single && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-sage-50 px-3 py-2 text-center text-xs text-ink-700">
            <div><div className="text-ink-500">Raw materials (1 unit)</div><div className="font-semibold">{formatMoney(materialCost)}</div></div>
            <div><div className="text-ink-500">Total cost of 1 unit</div><div className="font-semibold">{formatMoney(unitCost)}</div></div>
          </div>
        )}
        <Field label="Notes (optional)"><textarea rows={2} maxLength={1000} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Each material is counted its own way. "per unit": the quantity is used by every finished unit (0.5 kg x 25,000 units = 12,500 kg).
          "per batch": the quantity is used by one whole batch and scaled to the order (500 kg per batch of 10,000 units, 25,000 units needs 1,250 kg).
          Costs use each material's average stock cost; labour and overhead are standard costs per batch, and the real totals can be entered when production is completed.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : editing ? 'Save changes' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}
