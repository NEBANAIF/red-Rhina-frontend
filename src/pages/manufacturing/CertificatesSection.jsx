import React, { useEffect, useState } from 'react';
import { listCertificates, issueCertificate, searchProductionOrders } from '../../api/manufacturing.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { extractErrorMessage } from '../../api/client.js';
import DataTable from '../../components/DataTable.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import { formatDate } from '../../utils/format.js';

const today = () => new Date().toISOString().slice(0, 10);

/** The usual routine tests of an electric cable; the person edits the requirement and measured values (or adds / removes tests). */
const DEFAULT_TESTS = [
  { parameter: 'Conductor resistance at 20 °C', unit: 'Ω/km', requirement: '', measured: '', result: 'PASS' },
  { parameter: 'Insulation thickness (average)', unit: 'mm', requirement: '', measured: '', result: 'PASS' },
  { parameter: 'Sheath thickness (average)', unit: 'mm', requirement: '', measured: '', result: 'PASS' },
  { parameter: 'Overall diameter', unit: 'mm', requirement: '', measured: '', result: 'PASS' },
  { parameter: 'Voltage test', unit: 'kV / 5 min', requirement: 'No breakdown', measured: '', result: 'PASS' },
  { parameter: 'Insulation resistance at 70 °C', unit: 'MΩ·km', requirement: '', measured: '', result: 'PASS' },
  { parameter: 'Tensile strength / elongation of insulation', unit: 'N/mm² / %', requirement: '', measured: '', result: 'PASS' },
];

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Opens a clean A4 page with the certificate and the print dialog (the person can also "Save as PDF"). */
function printCertificate(c) {
  const spec = [c.conductorMaterial, c.cores ? `${c.cores} core` : null, c.crossSectionMm2 ? `${c.crossSectionMm2} mm²` : null, c.voltageRating].filter(Boolean).join(' · ');
  const rows = c.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.parameter)}</td><td>${esc(l.unit)}</td><td>${esc(l.requirement)}</td><td>${esc(l.measured)}</td><td class="${l.result === 'PASS' ? 'ok' : 'bad'}">${l.result === 'PASS' ? 'Pass' : 'Fail'}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.certificateNumber)}</title><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#222;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 6px}
    .head{display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:8px;margin-bottom:12px}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:5px 7px;text-align:left}th{background:#eee}
    .meta td{border:none;padding:2px 8px 2px 0}.ok{color:#116b2e;font-weight:bold}.bad{color:#b00020;font-weight:bold}
    .verdict{margin-top:14px;font-size:16px;font-weight:bold}.sign{display:flex;justify-content:space-between;margin-top:48px}
    .sign div{border-top:1px solid #222;width:40%;padding-top:4px;text-align:center}
  </style></head><body>
    <div class="head"><div><h1>Rhino Cables Manufacturing PLC</h1><div>Test certificate</div></div><div style="text-align:right"><b>${esc(c.certificateNumber)}</b><br/>Date: ${esc(c.issueDate)}</div></div>
    <table class="meta">
      <tr><td><b>Product</b></td><td>${esc(c.productName)} (${esc(c.productSku)})</td><td><b>Production order</b></td><td>${esc(c.orderNumber)}</td></tr>
      <tr><td><b>Specification</b></td><td>${esc(spec) || '-'}</td><td><b>Standard</b></td><td>${esc(c.standardRef) || '-'}</td></tr>
      <tr><td><b>Quantity</b></td><td>${esc(c.quantity)}</td><td><b>Drum / lot numbers</b></td><td>${esc(c.batchReference) || '-'}</td></tr>
      <tr><td><b>Factory</b></td><td>${esc(c.branchName)}</td><td><b>Customer</b></td><td>${esc(c.customerName) || '-'}</td></tr>
    </table>
    <h2>Test results</h2>
    <table><thead><tr><th>#</th><th>Test</th><th>Unit</th><th>Requirement</th><th>Measured</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="verdict">Overall result: <span class="${c.overallResult === 'PASS' ? 'ok' : 'bad'}">${c.overallResult === 'PASS' ? 'PASSED' : 'FAILED'}</span></div>
    ${c.remarks ? `<p><b>Remarks:</b> ${esc(c.remarks)}</p>` : ''}
    <div class="sign"><div>Tested by: ${esc(c.issuedBy)}</div><div>Quality manager</div></div>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

/** Test certificates of production batches: list, issue (with a routine cable test list) and print. */
export default function CertificatesSection({ canManage, onNotice }) {
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = () => {
    listCertificates({ page, ...scopeParams }).then((d) => { setData(d); setError(''); }).catch((e) => setError(extractErrorMessage(e)));
  };
  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);

  const columns = [
    { key: 'certificateNumber', header: 'Certificate', render: (r) => <span className="font-medium text-ink-900">{r.certificateNumber}</span> },
    { key: 'issueDate', header: 'Date', render: (r) => formatDate(r.issueDate) },
    { key: 'productName', header: 'Product' },
    { key: 'batchReference', header: 'Drum / lot', render: (r) => r.batchReference || '-' },
    { key: 'overallResult', header: 'Result', render: (r) => <Badge status={r.overallResult} /> },
    { key: 'view', header: '', render: (r) => <button onClick={() => setViewing(r)} className="text-sm font-medium text-sage-600 hover:underline">View / print</button> },
  ];

  return (
    <div className="card card-pad mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">Test certificates</h2>
        {canManage && <button onClick={() => setNewOpen(true)} className="btn btn-primary btn-sm">+ Issue certificate</button>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <>
          <DataTable columns={columns} rows={data.content} emptyMessage="No test certificates issued yet." />
          <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
        </>
      )}
      {newOpen && <IssueModal onClose={() => setNewOpen(false)} onSaved={(c) => { setNewOpen(false); onNotice?.(`Certificate ${c.certificateNumber} issued.`); load(); setViewing(c); }} />}
      {viewing && (
        <Modal open title={viewing.certificateNumber} onClose={() => setViewing(null)}>
          <div className="space-y-2 text-sm">
            <p><b>{viewing.productName}</b> · order {viewing.orderNumber} · {formatDate(viewing.issueDate)} · <Badge status={viewing.overallResult} /></p>
            <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200">
              {viewing.lines.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                  <span>{l.parameter}{l.unit ? ` (${l.unit})` : ''}</span>
                  <span className="shrink-0 text-ink-600">{l.requirement ? `${l.requirement} → ` : ''}{l.measured || '-'} · <b className={l.result === 'PASS' ? 'text-emerald-700' : 'text-red-600'}>{l.result === 'PASS' ? 'Pass' : 'Fail'}</b></span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setViewing(null)} className="btn btn-secondary btn-sm">Close</button>
              <button onClick={() => printCertificate(viewing)} className="btn btn-primary btn-sm">Print / save as PDF</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IssueModal({ onClose, onSaved }) {
  const { scopeParams } = useBranchScope();
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ productionOrderId: '', issueDate: today(), batchReference: '', customerName: '', standardRef: '', remarks: '' });
  const [lines, setLines] = useState(DEFAULT_TESTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const setLine = (i, p) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));

  useEffect(() => {
    Promise.all([searchProductionOrders({ status: 'IN_PROGRESS', size: 50, ...scopeParams }), searchProductionOrders({ status: 'COMPLETED', size: 50, ...scopeParams })])
      .then(([a, b]) => setOrders([...a.content, ...b.content])).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const clean = lines.filter((l) => l.parameter.trim());
      if (clean.length === 0) throw new Error('Add at least one test');
      const c = await issueCertificate({
        productionOrderId: form.productionOrderId, issueDate: form.issueDate,
        batchReference: form.batchReference.trim() || undefined, customerName: form.customerName.trim() || undefined,
        standardRef: form.standardRef.trim() || undefined, remarks: form.remarks.trim() || undefined,
        lines: clean.map((l) => ({ parameter: l.parameter.trim(), unit: l.unit.trim() || undefined, requirement: l.requirement.trim() || undefined, measured: l.measured.trim() || undefined, result: l.result })),
      });
      onSaved(c);
    } catch (err) {
      setError(err.response ? extractErrorMessage(err) : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Issue test certificate" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Production order (in progress or completed)">
          <select required className="input" value={form.productionOrderId} onChange={(e) => set({ productionOrderId: e.target.value })}>
            <option value="">Select…</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} · {o.productName}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date"><input required type="date" max={today()} className="input" value={form.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></Field>
          <Field label="Drum / reel / lot numbers"><input maxLength={120} className="input" value={form.batchReference} onChange={(e) => set({ batchReference: e.target.value })} /></Field>
          <Field label="Customer (optional)"><input maxLength={160} className="input" value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
          <Field label="Standard (default: the product's)"><input maxLength={60} className="input" placeholder="e.g. IEC 60502-1" value={form.standardRef} onChange={(e) => set({ standardRef: e.target.value })} /></Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-ink-500">Tests (edit, add or remove)</span>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-1.5">
                <input className="input col-span-12 sm:col-span-4" placeholder="Test" value={l.parameter} onChange={(e) => setLine(i, { parameter: e.target.value })} />
                <input className="input col-span-3 sm:col-span-2" placeholder="Unit" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                <input className="input col-span-3 sm:col-span-2" placeholder="Requirement" value={l.requirement} onChange={(e) => setLine(i, { requirement: e.target.value })} />
                <input className="input col-span-3 sm:col-span-2" placeholder="Measured" value={l.measured} onChange={(e) => setLine(i, { measured: e.target.value })} />
                <select className="input col-span-2 sm:col-span-1" value={l.result} onChange={(e) => setLine(i, { result: e.target.value })}>
                  <option value="PASS">Pass</option><option value="FAIL">Fail</option>
                </select>
                <button type="button" className="col-span-1 text-ink-400 hover:text-red-600" aria-label="Remove test" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-sm font-medium text-sage-600 hover:underline" onClick={() => setLines((ls) => [...ls, { parameter: '', unit: '', requirement: '', measured: '', result: 'PASS' }])}>+ Add test</button>
        </div>
        <Field label="Remarks (optional)"><textarea rows={2} maxLength={1000} className="input" value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
        <p className="text-xs text-ink-500">The overall result is Pass only when every test passed.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Issue certificate'}</button>
        </div>
      </form>
    </Modal>
  );
}
