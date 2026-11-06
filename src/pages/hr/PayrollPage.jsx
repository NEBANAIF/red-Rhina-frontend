import React, { useEffect, useState } from 'react';
import {
  listPayrollRuns, getPayrollRun, createPayrollRun, recalculatePayrollRun, adjustPayrollLine, deletePayrollRun, approvePayrollRun,
  payPayrollRun, getPayrollSettings, savePayrollSettings, submitPayrollRun, rejectPayrollRun, listPayrollPayments, getPayslip,
  reversePayrollRun, listPayrollLiabilities, getPayrollLiabilitySummary, settlePayrollLiabilities,
} from '../../api/hr.js';
import { listTransferBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { useAppName } from '../../config/BrandContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import { exportExcel, exportPdf, safeFileName } from '../../utils/exporter.js';
import { formatMoney } from '../../utils/format.js';
import { Field, label, typeLabel, minutes } from './hrCommon.jsx';
import { PayslipModal } from './Payslip.jsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const period = (r) => `${MONTHS[r.month - 1]} ${r.year}`;

/**
 * Payroll per location and month. Pay = salary (prorated) − absence deductions + allowances + overtime + commission + adjustments, then
 * pension, income tax and recurring deductions come off. Workflow: draft > submitted > approved > paid; every paid run writes the payment history.
 */
export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canManage = hasPermission('PAYROLL_MANAGE');
  const canApprove = hasPermission('PAYROLL_APPROVE');
  const canPay = hasPermission('PAYROLL_PAY');
  const [tab, setTab] = useState('runs');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setState('loading');
    listPayrollRuns({ year: year || undefined, page, ...scopeParams }).then((d) => { setData(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [year, page, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { setPage(0); }, [year, scopeParams.scope, scopeParams.branchId]);

  const columns = [
    { key: 'period', header: 'Period', render: (r) => <span className="font-medium text-ink-900">{period(r)}</span> },
    { key: 'branchName', header: 'Location' },
    { key: 'employees', header: 'Employees', className: 'text-right' },
    { key: 'totalBase', header: 'Salaries', render: (r) => formatMoney(r.totalBase), className: 'text-right' },
    { key: 'totalAllowances', header: 'Allowances', render: (r) => formatMoney(r.totalAllowances), className: 'text-right' },
    { key: 'totalOvertime', header: 'Overtime', render: (r) => formatMoney(r.totalOvertime), className: 'text-right' },
    { key: 'totalTax', header: 'Tax', render: (r) => formatMoney(r.totalTax), className: 'text-right' },
    { key: 'totalPension', header: 'Pension', render: (r) => formatMoney(r.totalPension), className: 'text-right' },
    { key: 'totalNet', header: 'Net pay', render: (r) => <span className="font-semibold">{formatMoney(r.totalNet)}</span>, className: 'text-right' },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Payroll</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setSettingsOpen(true)}>Payroll settings</button>
          {canManage && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New Payroll</button>}
        </div>
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Gross pay = salary (prorated if someone joined or left in the month) − absence and unpaid-leave deductions + allowances + overtime pay from attendance
        + salesperson commission + manual adjustments. Net pay = gross − employee pension − income tax − recurring deductions. A draft can be checked and
        recalculated; submit it for approval, and once approved it is locked until it is paid.
      </p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      <div className="mb-3 flex gap-1 border-b border-cream-300 text-sm">
        {[['runs', 'Payroll runs'], ['history', 'Payment history'], ['liabilities', 'Payroll liabilities']].map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 font-medium ${tab === k ? 'border-sage-600 text-sage-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>{t}</button>
        ))}
      </div>
      {tab === 'history' && <PaymentHistory year={year} setYear={setYear} />}
      {tab === 'liabilities' && <Liabilities year={year} setYear={setYear} canPay={canPay} onNotice={setNotice} />}
      <div className={`card card-pad ${tab === 'runs' ? '' : 'hidden'}`}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field text="Year"><input type="number" min="2000" max="2100" className="input w-28" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        </div>
        {state === 'loading' && !data && <LoadingState />}
        {state === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && state !== 'error' && (
          <>
            <DataTable columns={columns} rows={data.content} onRowClick={(r) => setOpenId(r.id)} emptyMessage="No payroll yet for this year and location." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      {creating && <NewPayrollModal onClose={() => setCreating(false)} onCreated={(run) => { setCreating(false); setNotice(`Draft payroll for ${period(run)} created. Check it, then submit it for approval.`); setOpenId(run.id); load(); }} />}
      {settingsOpen && <SettingsModal canManage={canManage} onClose={() => setSettingsOpen(false)} />}
      {openId && <RunModal id={openId} canManage={canManage} canApprove={canApprove} canPay={canPay} onClose={() => setOpenId(null)} onChanged={(msg) => { if (msg) setNotice(msg); load(); }} />}
    </div>
  );
}

function NewPayrollModal({ onClose, onCreated }) {
  const { scope, specificBranchId } = useBranchScope();
  const [branches, setBranches] = useState([]);
  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  const [branchId, setBranchId] = useState('');
  const [month, setMonth] = useState(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listTransferBranches().then((l) => {
      const arr = Array.isArray(l) ? l : (l?.content ?? []);
      setBranches(arr);
      if (scope === 'SPECIFIC' && arr.some((b) => b.id === specificBranchId)) setBranchId(specificBranchId);
      else if (arr.length === 1) setBranchId(arr[0].id);
    }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const [y, m] = month.split('-').map(Number);
      onCreated(await createPayrollRun({ branchId, year: y, month: m, note: note.trim() || undefined }));
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title="New Payroll" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field text="Location">
          <select required className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({label(b.type)})</option>)}
          </select>
        </Field>
        <Field text="Month"><input required type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field text="Note (optional)"><input maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-xs text-ink-500">Everyone who works at the location in that month is included. Anyone already in another payroll for the month is left out, so nobody is paid twice.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Calculating...' : 'Calculate'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsModal({ canManage, onClose }) {
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    getPayrollSettings().then((d) => setF({ ...d, taxBrackets: d.taxBrackets.map((b) => ({ lowerBound: String(b.lowerBound), rate: String(b.rate) })) }))
      .catch((e) => setError(extractErrorMessage(e)));
  }, []);

  const setBracket = (i, patch) => setF({ ...f, taxBrackets: f.taxBrackets.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await savePayrollSettings({
        overtimeMultiplier: Number(f.overtimeMultiplier), workingDaysPerMonth: Number(f.workingDaysPerMonth), hoursPerDay: Number(f.hoursPerDay),
        employeePensionRate: Number(f.employeePensionRate) || 0, employerPensionRate: Number(f.employerPensionRate) || 0,
        taxBrackets: f.taxBrackets.map((b) => ({ lowerBound: Number(b.lowerBound) || 0, rate: Number(b.rate) || 0 })),
      });
      onClose();
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title="Payroll settings" onClose={onClose} wide>
      {!f && !error && <LoadingState />}
      {f && (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field text="Overtime pay multiplier"><input type="number" min="1" step="0.01" disabled={!canManage} className="input" value={f.overtimeMultiplier} onChange={(e) => setF({ ...f, overtimeMultiplier: e.target.value })} /></Field>
            <Field text="Working days / month"><input type="number" min="1" max="31" disabled={!canManage} className="input" value={f.workingDaysPerMonth} onChange={(e) => setF({ ...f, workingDaysPerMonth: e.target.value })} /></Field>
            <Field text="Hours / day"><input type="number" min="1" max="24" disabled={!canManage} className="input" value={f.hoursPerDay} onChange={(e) => setF({ ...f, hoursPerDay: e.target.value })} /></Field>
          </div>
          <p className="text-xs text-ink-500">Daily rate = salary ÷ working days; hourly rate = daily ÷ hours per day; overtime is paid at hourly × multiplier.</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field text="Employee pension (% of earned basic salary)"><input type="number" min="0" max="100" step="0.01" disabled={!canManage} className="input" value={f.employeePensionRate} onChange={(e) => setF({ ...f, employeePensionRate: e.target.value })} /></Field>
            <Field text="Employer pension (% of earned basic salary)"><input type="number" min="0" max="100" step="0.01" disabled={!canManage} className="input" value={f.employerPensionRate} onChange={(e) => setF({ ...f, employerPensionRate: e.target.value })} /></Field>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink-800">Income tax brackets</h3>
            <p className="mb-2 text-xs text-ink-500">
              Each bracket taxes the part of taxable income from its starting amount up to the next bracket's start. Taxable income = gross pay − allowances marked
              "not taxed" − employee pension. The first bracket must start at 0. One bracket at 0 % means no income tax — enter your country's brackets here.
            </p>
            {f.taxBrackets.map((b, i) => (
              <div key={i} className="mb-2 flex items-end gap-2">
                <Field text={i === 0 ? 'From amount' : 'From amount'}><input type="number" min="0" step="0.01" disabled={!canManage || i === 0} className="input w-36" value={b.lowerBound} onChange={(e) => setBracket(i, { lowerBound: e.target.value })} /></Field>
                <Field text="Rate %"><input type="number" min="0" max="100" step="0.01" disabled={!canManage} className="input w-28" value={b.rate} onChange={(e) => setBracket(i, { rate: e.target.value })} /></Field>
                {canManage && i > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setF({ ...f, taxBrackets: f.taxBrackets.filter((_, j) => j !== i) })}>Remove</button>}
              </div>
            ))}
            {canManage && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setF({ ...f, taxBrackets: [...f.taxBrackets, { lowerBound: '', rate: '' }] })}>+ Add bracket</button>}
          </div>
          <p className="text-xs text-ink-500">Each payroll keeps the settings it was calculated with, so changing them never alters an existing payroll.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
            {canManage && <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>}
          </div>
        </form>
      )}
      {!f && error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

/** Who was paid what, when and how (one row per employee payment), with each payslip one click away. */
function PaymentHistory({ year, setYear }) {
  const { scopeParams } = useBranchScope();
  const { appName } = useAppName();
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [slip, setSlip] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    setError('');
    listPayrollPayments({ year: year || undefined, page, ...scopeParams }).then(setData).catch((e) => setError(extractErrorMessage(e)));
  };
  useEffect(load, [year, page, scopeParams.scope, scopeParams.branchId]);

  const columns = [
    { key: 'paidOn', header: 'Paid on' },
    { key: 'employeeName', header: 'Employee', render: (r) => <span className="font-medium text-ink-900">{r.employeeName} <span className="text-xs text-ink-400">{r.employeeNumber}</span></span> },
    { key: 'branchName', header: 'Location' },
    { key: 'period', header: 'For', render: (r) => `${MONTHS[r.month - 1]} ${r.year}` },
    { key: 'amount', header: 'Amount', render: (r) => <span className="font-semibold">{formatMoney(r.amount)}</span>, className: 'text-right' },
    { key: 'method', header: 'Method', render: (r) => label(r.method) },
    { key: 'reference', header: 'Reference', render: (r) => r.reference ?? '—' },
    { key: 'paidByName', header: 'Paid by', render: (r) => r.paidByName ?? '—' },
  ];
  return (
    <div className="card card-pad">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field text="Year"><input type="number" min="2000" max="2100" className="input w-28" value={year} onChange={(e) => { setYear(e.target.value); setPage(0); }} /></Field>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <LoadingState />}
      {data && (
        <>
          <DataTable columns={columns} rows={data.content} emptyMessage="No payments yet for this year and location."
            onRowClick={(r) => { setOpen(true); setSlip(null); getPayslip(r.lineId).then(setSlip).catch((e) => setError(extractErrorMessage(e))); }} />
          <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
        </>
      )}
      {open && <PayslipModal payslip={slip} appName={appName} onClose={() => setOpen(false)} />}
    </div>
  );
}

const KIND_LABELS = { EMPLOYEE_PENSION: 'Employee pension', EMPLOYER_PENSION: 'Employer pension', INCOME_TAX: 'Income tax', OTHER_DEDUCTIONS: 'Other deductions' };

/** What the company withheld from pay (or owes as employer pension) and still has to hand over; paying it out is recorded in the books. */
function Liabilities({ year, setYear, canPay, onNotice }) {
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('OPEN');
  const [kind, setKind] = useState('');
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [settling, setSettling] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError('');
    listPayrollLiabilities({ status: status || undefined, kind: kind || undefined, year: year || undefined, page, ...scopeParams })
      .then((d) => { setData(d); setSelected([]); }).catch((e) => setError(extractErrorMessage(e)));
    getPayrollLiabilitySummary(scopeParams).then(setSummary).catch(() => {});
  };
  useEffect(load, [status, kind, year, page, scopeParams.scope, scopeParams.branchId]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectedTotal = (data?.content ?? []).filter((r) => selected.includes(r.id)).reduce((t, r) => t + Number(r.amount), 0);

  const settle = async () => {
    setBusy(true);
    setError('');
    try {
      await settlePayrollLiabilities({ ids: selected, paidOn: settling.paidOn || undefined, reference: settling.reference.trim() || undefined });
      setSettling(null);
      onNotice(`${selected.length} payroll liabilities marked as paid over.`);
      load();
    } catch (e) { setError(extractErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const columns = [
    { key: 'sel', header: '', render: (r) => (canPay && r.status === 'OPEN'
      ? <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /> : null) },
    { key: 'period', header: 'Payroll', render: (r) => `${MONTHS[r.periodMonth - 1] ?? r.periodMonth} ${r.periodYear}` },
    { key: 'kind', header: 'What', render: (r) => KIND_LABELS[r.kind] ?? r.kind },
    { key: 'employeeName', header: 'Employee', render: (r) => r.employeeName ?? '— (all staff)' },
    { key: 'branchName', header: 'Location' },
    { key: 'amount', header: 'Amount', render: (r) => <span className="font-semibold">{formatMoney(r.amount)}</span>, className: 'text-right' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'OPEN' ? 'warning' : r.status === 'SETTLED' ? 'success' : 'neutral'}>{label(r.status)}</Badge> },
    { key: 'settledOn', header: 'Paid over on', render: (r) => r.settledOn ?? '—' },
  ];

  return (
    <div className="card card-pad">
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(summary.openByKind ?? {}).map(([k, v]) => (
            <div key={k} className="rounded border border-cream-300 p-2"><div className="text-xs text-ink-500">{KIND_LABELS[k] ?? k}</div><div className="font-semibold">{formatMoney(v)}</div></div>
          ))}
          <div className="rounded border border-sage-600 p-2"><div className="text-xs text-ink-500">Still to hand over</div><div className="font-semibold">{formatMoney(summary.openTotal)}</div></div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field text="Year"><input type="number" min="2000" max="2100" className="input w-28" value={year} onChange={(e) => { setYear(e.target.value); setPage(0); }} /></Field>
        <Field text="Status">
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="OPEN">Still to pay over</option><option value="SETTLED">Paid over</option><option value="REVERSED">Reversed</option><option value="">All</option>
          </select>
        </Field>
        <Field text="What">
          <select className="input" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>
            <option value="">All</option>
            {Object.entries(KIND_LABELS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </Field>
        {canPay && selected.length > 0 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setSettling({ paidOn: new Date().toISOString().slice(0, 10), reference: '' })}>
            Mark {selected.length} as paid over ({formatMoney(selectedTotal)})…
          </button>
        )}
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <LoadingState />}
      {data && (
        <>
          <DataTable columns={columns} rows={data.content} emptyMessage="Nothing here. Liabilities appear when a payroll is paid." />
          <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
        </>
      )}
      {settling && (
        <Modal title="Pay over withheld amounts" onClose={() => setSettling(null)}>
          <p className="mb-3 text-sm text-ink-600">{selected.length} items, {formatMoney(selectedTotal)} in total. This records the cash going out of the company (pension fund, tax authority, etc.).</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field text="Paid on"><input type="date" className="input" value={settling.paidOn} onChange={(e) => setSettling({ ...settling, paidOn: e.target.value })} /></Field>
            <Field text="Reference (receipt / transfer no.)"><input className="input" value={settling.reference} onChange={(e) => setSettling({ ...settling, reference: e.target.value })} /></Field>
          </div>
          {error && <p className="alert alert-error mt-3">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setSettling(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={settle}>{busy ? 'Saving…' : 'Confirm'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const PAY_METHODS = [['CASH', 'Cash'], ['BANK_TRANSFER', 'Bank transfer'], ['MOBILE_MONEY', 'Mobile money'], ['CHEQUE', 'Cheque']];

function RunModal({ id, canManage, canApprove, canPay, onClose, onChanged }) {
  const { user } = useAuth();
  const { appName } = useAppName();
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [messages, setMessages] = useState([]);
  const [paying, setPaying] = useState(null);
  const [slip, setSlip] = useState(undefined);

  const load = () => getPayrollRun(id).then(setRun).catch((e) => setError(extractErrorMessage(e)));
  useEffect(() => { load(); }, [id]);

  const act = async (name, fn, doneMessage) => {
    setBusy(name);
    setError('');
    try {
      const result = await fn();
      if (result && result.id) { setRun(result); setMessages(result.messages ?? []); }
      onChanged(doneMessage);
      return true;
    } catch (e) { setError(extractErrorMessage(e)); return false; }
    finally { setBusy(''); }
  };

  const adjust = async (line) => {
    const value = window.prompt(`One-off adjustment for ${line.employeeName} (+ adds, − takes off; it is taxed like pay). Current: ${line.adjustment}`, String(line.adjustment));
    if (value === null) return;
    const note = window.prompt('Reason (e.g. bonus, correction):', line.adjustmentNote ?? '');
    if (note === null) return;
    await act('adjust', () => adjustPayrollLine(run.id, line.id, { adjustment: Number(value) || 0, adjustmentNote: note || undefined }), 'Adjustment saved.');
  };

  const reject = async () => {
    const note = window.prompt('Why is this payroll rejected? (the preparer will see it)');
    if (note === null) return;
    if (!note.trim()) { setError('Say why the payroll is rejected.'); return; }
    await act('reject', () => rejectPayrollRun(run.id, note.trim()), 'Payroll sent back to draft.');
  };

  const reverse = async () => {
    const reason = window.prompt('Why is this paid payroll being reversed? The salary expense and payment are taken out of the books and the payroll goes back to draft so it can be corrected.');
    if (reason === null) return;
    if (!reason.trim()) { setError('Say why the payroll is reversed.'); return; }
    await act('reverse', () => reversePayrollRun(run.id, { reason: reason.trim() }), 'Payroll reversed and returned to draft.');
  };

  const openSlip = (line) => { setSlip(null); getPayslip(line.id).then(setSlip).catch((e) => { setSlip(undefined); setError(extractErrorMessage(e)); }); };

  const columns = (run?.lines ?? []).length === 0 ? [] : [
    { header: 'Employee', value: (l) => `${l.employeeName} (${l.employeeNumber})`, type: 'text' },
    { header: 'Role', value: (l) => l.roleName ?? '', type: 'text' },
    { header: 'Salary', value: (l) => Number(l.proratedBase), type: 'money', total: true },
    { header: 'Absence deduction', value: (l) => Number(l.deduction), type: 'money', total: true },
    { header: 'Allowances', value: (l) => Number(l.allowances), type: 'money', total: true },
    { header: 'Overtime hours', value: (l) => Number((l.overtimeMinutes / 60).toFixed(2)), type: 'number' },
    { header: 'Overtime pay', value: (l) => Number(l.overtimePay), type: 'money', total: true },
    { header: 'Commission', value: (l) => Number(l.commission), type: 'money', total: true },
    { header: 'Adjustment', value: (l) => Number(l.adjustment), type: 'money', total: true },
    { header: 'Gross pay', value: (l) => Number(l.grossPay), type: 'money', total: true },
    { header: 'Pension', value: (l) => Number(l.employeePension), type: 'money', total: true },
    { header: 'Income tax', value: (l) => Number(l.incomeTax), type: 'money', total: true },
    { header: 'Other deductions', value: (l) => Number(l.otherDeductions), type: 'money', total: true },
    { header: 'Net pay', value: (l) => Number(l.netPay), type: 'money', total: true },
  ];
  const exportArgs = run && {
    title: `Payroll ${period(run)} - ${run.branchName}`, appName, columns, rows: run.lines, generatedBy: user?.name,
    infoLines: [`Location: ${run.branchName}`, `Status: ${label(run.status)}`, `Overtime x${Number(run.overtimeMultiplier)}, ${run.workingDays} working days, ${run.hoursPerDay} h/day`,
      `Employer pension (company cost): ${formatMoney(run.totalEmployerPension)}`],
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (await act('pay', () => payPayrollRun(run.id, { paidOn: paying.paidOn || undefined, method: paying.method, reference: paying.reference.trim() || undefined }), 'Payroll marked as paid.')) setPaying(null);
  };

  return (
    <Modal open title={run ? `Payroll ${period(run)} – ${run.branchName}` : 'Payroll'} onClose={onClose} size="xl">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {!run && !error && <LoadingState />}
      {run && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={run.status} />
            <span className="text-xs text-ink-500">
              prepared by {run.createdByName}
              {run.submittedByName ? ` · submitted by ${run.submittedByName}` : ''}
              {run.approvedByName ? ` · approved by ${run.approvedByName}` : ''}
              {run.paidOn ? ` · paid ${run.paidOn}${run.paidByName ? ` by ${run.paidByName}` : ''} (${label(run.paymentMethod)}${run.paymentReference ? `, ${run.paymentReference}` : ''})` : ''}
            </span>
          </div>
          {run.status === 'DRAFT' && run.rejectionNote && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Rejected by {run.rejectedByName}: {run.rejectionNote}</p>
          )}
          {messages.map((m) => <p key={m} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{m}</p>)}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left uppercase tracking-wide text-ink-400">
                  <th className="py-1 pr-2">Employee</th><th className="py-1 pr-2 text-right">Salary</th><th className="py-1 pr-2 text-right">Absence</th>
                  <th className="py-1 pr-2 text-right">Allowances</th><th className="py-1 pr-2 text-right">Overtime</th><th className="py-1 pr-2 text-right">Commission</th>
                  <th className="py-1 pr-2 text-right">Adjust.</th><th className="py-1 pr-2 text-right">Gross</th><th className="py-1 pr-2 text-right">Pension</th>
                  <th className="py-1 pr-2 text-right">Tax</th><th className="py-1 pr-2 text-right">Deductions</th><th className="py-1 pr-2 text-right">Net pay</th><th />
                </tr>
              </thead>
              <tbody>
                {run.lines.map((l) => (
                  <tr key={l.id} className="border-t border-cream-200 align-top">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-ink-900">{l.employeeName}</span>
                      {l.warning && <span className="block text-[11px] text-amber-700">⚠ {l.warning}</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.proratedBase)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.deduction)}<span className="block text-[11px] text-ink-400">{Number(l.absentDays) + l.unpaidLeaveDays} day(s)</span></td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.allowances)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.overtimePay)}<span className="block text-[11px] text-ink-400">{minutes(l.overtimeMinutes)}</span></td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.commission)}{Number(l.salesAmount) > 0 && <span className="block text-[11px] text-ink-400">{Number(l.commissionRate)}% of {formatMoney(l.salesAmount)}</span>}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {run.status === 'DRAFT' && canManage
                        ? <button type="button" className="font-medium text-sage-600 hover:underline" onClick={() => adjust(l)}>{Number(l.adjustment) === 0 ? 'Add' : formatMoney(l.adjustment)}</button>
                        : (Number(l.adjustment) === 0 ? '—' : formatMoney(l.adjustment))}
                      {l.adjustmentNote && <span className="block text-[11px] text-ink-400">{l.adjustmentNote}</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium">{formatMoney(l.grossPay)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.employeePension)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.incomeTax)}<span className="block text-[11px] text-ink-400">on {formatMoney(l.taxableIncome)}</span></td>
                    <td className="py-1.5 pr-2 text-right">{formatMoney(l.otherDeductions)}</td>
                    <td className="py-1.5 pr-2 text-right font-semibold">{formatMoney(l.netPay)}</td>
                    <td className="py-1.5 text-right"><button type="button" className="font-medium text-sage-600 hover:underline" onClick={() => openSlip(l)}>Payslip</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-cream-300 font-semibold">
                  <td className="py-1.5 pr-2">Total ({run.employees})</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalBase)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalDeductions)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalAllowances)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalOvertime)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalCommission)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalAdjustments)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalGross)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalPension)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalTax)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalOtherDeductions)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(run.totalNet)}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-ink-500">Employer pension (a company cost, not taken from pay): {formatMoney(run.totalEmployerPension)}</p>

          {paying && (
            <form onSubmit={submitPay} className="grid grid-cols-1 gap-3 rounded-lg border border-cream-300 bg-cream-50 p-3 sm:grid-cols-3">
              <Field text="Payment method">
                <select className="input" value={paying.method} onChange={(e) => setPaying({ ...paying, method: e.target.value })}>
                  {PAY_METHODS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </Field>
              <Field text="Paid on"><input type="date" className="input" max={new Date().toISOString().slice(0, 10)} value={paying.paidOn} onChange={(e) => setPaying({ ...paying, paidOn: e.target.value })} /></Field>
              <Field text="Reference (transfer / cheque no.)"><input maxLength={120} className="input" value={paying.reference} onChange={(e) => setPaying({ ...paying, reference: e.target.value })} /></Field>
              <div className="flex justify-end gap-2 sm:col-span-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaying(null)}>Cancel</button>
                <button type="submit" disabled={!!busy} className="btn btn-primary btn-sm">Confirm payment of {formatMoney(run.totalNet)}</button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportExcel({ ...exportArgs, filename: safeFileName(exportArgs.title) })}>Export Excel</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportPdf(exportArgs)}>Export PDF</button>
            {canManage && run.status === 'DRAFT' && (
              <>
                <button type="button" disabled={!!busy} className="btn btn-secondary btn-sm"
                  onClick={async () => { if (window.confirm('Delete this draft payroll?')) { if (await act('delete', () => deletePayrollRun(run.id), 'Draft payroll deleted.')) onClose(); } }}>Delete draft</button>
                <button type="button" disabled={!!busy} className="btn btn-secondary btn-sm" onClick={() => act('recalc', () => recalculatePayrollRun(run.id), 'Payroll recalculated.')}>Recalculate</button>
                <button type="button" disabled={!!busy} className="btn btn-primary btn-sm"
                  onClick={() => window.confirm('Submit this payroll for approval? It cannot be edited while it waits.') && act('submit', () => submitPayrollRun(run.id), 'Payroll submitted for approval.')}>Submit for approval</button>
              </>
            )}
            {canApprove && run.status === 'SUBMITTED' && (
              <>
                <button type="button" disabled={!!busy} className="btn btn-secondary btn-sm" onClick={reject}>Reject</button>
                <button type="button" disabled={!!busy} className="btn btn-primary btn-sm"
                  onClick={() => window.confirm('Approve this payroll? It can no longer be changed afterwards.') && act('approve', () => approvePayrollRun(run.id), 'Payroll approved.')}>Approve</button>
              </>
            )}
            {run.status === 'SUBMITTED' && !canApprove && <span className="self-center text-xs text-ink-500">Waiting for someone with the approval permission.</span>}
            {canPay && run.status === 'PAID' && (
              <button type="button" disabled={!!busy} className="btn btn-danger btn-sm" onClick={reverse}>Reverse payroll…</button>
            )}
            {canPay && run.status === 'APPROVED' && !paying && (
              <button type="button" disabled={!!busy} className="btn btn-primary btn-sm"
                onClick={() => setPaying({ method: 'BANK_TRANSFER', paidOn: new Date().toISOString().slice(0, 10), reference: '' })}>Mark as paid…</button>
            )}
          </div>
        </div>
      )}
      {slip !== undefined && <PayslipModal payslip={slip} appName={appName} onClose={() => setSlip(undefined)} />}
    </Modal>
  );
}
