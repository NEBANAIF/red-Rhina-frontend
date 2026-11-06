import React, { useEffect, useState } from 'react';
import { listInspections, getQualitySummary, recordInspection, searchProductionOrders } from '../../api/manufacturing.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import { formatDate } from '../../utils/format.js';
import CertificatesSection from './CertificatesSection.jsx';

const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS = [
  { key: 'inspectionDate', header: 'Date', render: (r) => formatDate(r.inspectionDate) },
  { key: 'orderNumber', header: 'Production order', render: (r) => <span className="font-medium text-ink-900">{r.orderNumber}</span> },
  { key: 'productName', header: 'Product' },
  { key: 'sampleSize', header: 'Sample', className: 'text-right' },
  { key: 'defectsFound', header: 'Defects', className: 'text-right' },
  { key: 'defectRate', header: 'Defect rate', render: (r) => `${r.defectRate}%`, className: 'text-right' },
  { key: 'result', header: 'Result', render: (r) => <Badge status={r.result} /> },
  { key: 'inspectorName', header: 'Inspector' },
];

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}

/** Quality control: inspections of production orders (sample, defects, pass/fail) and the overall pass rate. */
export default function QualityPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canManage = hasPermission('QUALITY_MANAGE');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    setStatus('loading');
    Promise.all([listInspections({ page, ...scopeParams }), getQualitySummary(scopeParams)])
      .then(([list, sum]) => { setData(list); setSummary(sum); setStatus('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setStatus('error'); });
  };
  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Quality Control</h1>
        {canManage && <button onClick={() => setNewOpen(true)} className="btn btn-primary btn-sm">+ Record Inspection</button>}
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">Check a sample from a production run, count the defects and record whether the batch passed.</p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} label="Inspections" value={String(summary.inspections)} />
          <KpiCard index={1} label="Pass rate" value={`${summary.passRate}%`} emphasize />
          <KpiCard index={2} label="Failed" value={String(summary.failed)} warn={summary.failed > 0} />
          <KpiCard index={3} label="Average defect rate" value={`${summary.averageDefectRate}%`} />
        </div>
      )}
      <div className="card card-pad">
        {status === 'loading' && !data && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && status !== 'error' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No inspections recorded yet." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>
      <CertificatesSection canManage={canManage} onNotice={setNotice} />
      {newOpen && <InspectionModal onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); setNotice('Inspection recorded.'); load(); }} />}
    </div>
  );
}

function InspectionModal({ onClose, onSaved }) {
  const { scopeParams } = useBranchScope();
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ productionOrderId: '', inspectionDate: today(), sampleSize: '', defectsFound: '', result: 'PASS', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    Promise.all([searchProductionOrders({ status: 'IN_PROGRESS', size: 50, ...scopeParams }), searchProductionOrders({ status: 'COMPLETED', size: 50, ...scopeParams })])
      .then(([a, b]) => setOrders([...a.content, ...b.content])).catch(() => {});
  }, []);

  const rate = Number(form.sampleSize) > 0 ? ((Number(form.defectsFound || 0) * 100) / Number(form.sampleSize)).toFixed(2) : null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await recordInspection({
        productionOrderId: form.productionOrderId, inspectionDate: form.inspectionDate, sampleSize: Number(form.sampleSize),
        defectsFound: Number(form.defectsFound || 0), result: form.result, notes: form.notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Record Inspection" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Production order (in progress or completed)">
          <select required className="input" value={form.productionOrderId} onChange={(e) => set({ productionOrderId: e.target.value })}>
            <option value="">Select…</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} · {o.productName}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Date"><input required type="date" max={today()} className="input" value={form.inspectionDate} onChange={(e) => set({ inspectionDate: e.target.value })} /></Field>
          <Field label="Sample size"><input required type="number" min="1" className="input" value={form.sampleSize} onChange={(e) => set({ sampleSize: e.target.value })} /></Field>
          <Field label="Defects found"><input type="number" min="0" className="input" value={form.defectsFound} onChange={(e) => set({ defectsFound: e.target.value })} /></Field>
        </div>
        {rate !== null && <p className="text-sm text-ink-500">Defect rate: <strong>{rate}%</strong></p>}
        <Field label="Result">
          <div className="inline-flex rounded-lg border border-cream-300 p-0.5" role="radiogroup" aria-label="Result">
            {['PASS', 'FAIL'].map((r) => (
              <button key={r} type="button" role="radio" aria-checked={form.result === r} onClick={() => set({ result: r })}
                className={`rounded-md px-5 py-1.5 text-sm font-medium transition ${form.result === r ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-cream-100'}`}>
                {r === 'PASS' ? 'Pass' : 'Fail'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notes (optional)"><textarea rows={2} maxLength={1000} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Record'}</button>
        </div>
      </form>
    </Modal>
  );
}
