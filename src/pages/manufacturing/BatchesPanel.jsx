import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRawMaterialBatches, getRawMaterialBatchAlerts, listRawMaterialBatchConsumptions } from '../../api/manufacturing.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import { formatMoney } from '../../utils/format.js';

const fmt = (n) => Number(n ?? 0).toLocaleString();
const TONE = { ACTIVE: 'success', EXPIRING: 'warning', EXPIRED: 'danger', DEPLETED: 'muted' };

/** Expired / soon-to-expire batches that still hold stock. Shows nothing when everything is fine. */
export function ExpiryAlertBanner({ days = 30, linkToMaterials = false }) {
  const { scopeParams } = useBranchScope();
  const [a, setA] = useState(null);
  useEffect(() => {
    getRawMaterialBatchAlerts({ days, ...scopeParams }).then(setA).catch(() => setA(null));
  }, [days, scopeParams.scope, scopeParams.branchId]);
  if (!a || (a.expiredBatches === 0 && a.expiringBatches === 0)) return null;
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${a.expiredBatches > 0 ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {a.expiredBatches > 0 && (
        <p><strong>{a.expiredBatches} expired batch{a.expiredBatches > 1 ? 'es' : ''}</strong> still in stock ({fmt(a.expiredQuantity)} units, worth {formatMoney(a.expiredValue)}).
          They cannot be used in production - write them off with a negative stock adjustment.</p>
      )}
      {a.expiringBatches > 0 && (
        <p><strong>{a.expiringBatches} batch{a.expiringBatches > 1 ? 'es' : ''}</strong> expire within {a.days} days ({fmt(a.expiringQuantity)} units, {formatMoney(a.expiringValue)}). They are used first.</p>
      )}
      <ul className="mt-1 list-disc pl-5 text-xs">
        {a.batches.slice(0, 5).map((b) => (
          <li key={b.id}>{b.materialName} – batch {b.batchNumber} at {b.branchName}: {fmt(b.remainingQuantity)} {b.unit}, {b.status === 'EXPIRED' ? `expired ${b.expiryDate}` : `expires ${b.expiryDate} (${b.daysToExpiry} day${b.daysToExpiry === 1 ? '' : 's'})`}</li>
        ))}
      </ul>
      {linkToMaterials && <Link to="/manufacturing/materials" className="mt-1 inline-block text-xs font-medium underline">Open raw material batches</Link>}
    </div>
  );
}

/** Raw material stock lot by lot: batch number, quantity, unit and total cost, received / expiry dates, consumed and remaining. */
export default function BatchesPanel({ refreshKey = 0 }) {
  const { scopeParams } = useBranchScope();
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = () => {
    setError('');
    listRawMaterialBatches({ status, page, ...scopeParams }).then(setData).catch((e) => setError(extractErrorMessage(e)));
  };
  useEffect(load, [status, page, refreshKey, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { setPage(0); }, [status, scopeParams.scope, scopeParams.branchId]);

  const columns = [
    { key: 'batchNumber', header: 'Batch', render: (r) => <span className="font-medium text-ink-900">{r.batchNumber}</span> },
    { key: 'materialName', header: 'Raw material' },
    { key: 'branchName', header: 'Factory' },
    { key: 'receivedDate', header: 'Received' },
    { key: 'expiryDate', header: 'Expires', render: (r) => (r.expiryDate ? `${r.expiryDate}${r.status === 'EXPIRING' ? ` (${r.daysToExpiry}d)` : ''}` : 'no expiry') },
    { key: 'receivedQuantity', header: 'Received qty', render: (r) => `${fmt(r.receivedQuantity)} ${r.unit}`, className: 'text-right' },
    { key: 'consumedQuantity', header: 'Used', render: (r) => fmt(r.consumedQuantity), className: 'text-right' },
    { key: 'remainingQuantity', header: 'Remaining', render: (r) => <span className="font-semibold">{fmt(r.remainingQuantity)}</span>, className: 'text-right' },
    { key: 'unitCost', header: 'Unit cost', render: (r) => formatMoney(r.unitCost), className: 'text-right' },
    { key: 'totalCost', header: 'Total cost', render: (r) => formatMoney(r.totalCost), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{r.status === 'ACTIVE' ? 'Usable' : r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge> },
  ];

  return (
    <div className="card card-pad mb-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Batches</h2>
          <p className="text-xs text-ink-500">Production uses the batch that expires first and never an expired one. Click a batch to see what consumed it.</p>
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Batch status">
          <option value="ACTIVE">Usable (with stock)</option>
          <option value="EXPIRING">Expiring in 30 days</option>
          <option value="EXPIRED">Expired (with stock)</option>
          <option value="DEPLETED">Used up</option>
          <option value="ALL">All batches</option>
        </select>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <LoadingState />}
      {data && (
        <>
          <DataTable columns={columns} rows={data.content} onRowClick={(r) => setOpen(r)} emptyMessage="No batches in this view." />
          <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
        </>
      )}
      {open && <ConsumptionModal batch={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ConsumptionModal({ batch, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { listRawMaterialBatchConsumptions(batch.id).then(setRows).catch((e) => setError(extractErrorMessage(e))); }, [batch.id]);
  return (
    <Modal open title={`Batch ${batch.batchNumber} – ${batch.materialName}`} onClose={onClose} wide>
      <p className="mb-2 text-xs text-ink-500">
        Received {batch.receivedDate} · {fmt(batch.receivedQuantity)} {batch.unit} at {formatMoney(batch.unitCost)} = {formatMoney(batch.totalCost)} ·
        {' '}{batch.expiryDate ? `expires ${batch.expiryDate}` : 'no expiry date'} · {fmt(batch.remainingQuantity)} left
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows && !error && <LoadingState />}
      {rows && (rows.length === 0 ? <p className="text-sm text-ink-500">Nothing has been taken from this batch yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-400"><th className="py-1">When</th><th>Used by</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th>Note</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-cream-200">
                <td className="py-1.5">{new Date(c.at).toLocaleString()}</td>
                <td>{c.movementType === 'CONSUMED' ? 'Production' : c.movementType.replace('_', ' ').toLowerCase()}{c.byName ? ` · ${c.byName}` : ''}</td>
                <td className="text-right">{fmt(c.quantity)}</td><td className="text-right">{formatMoney(c.cost)}</td><td className="text-xs text-ink-500">{c.reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </Modal>
  );
}
