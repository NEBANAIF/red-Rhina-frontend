import React, { useEffect, useState } from 'react';
import { listLeave, createLeave, approveLeave, rejectLeave, cancelLeave, listEmployees } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import { Field, LEAVE_TYPES, label } from './hrCommon.jsx';

/** Leave requests: filed for an employee, approved or rejected once; approved days show as "on leave" in attendance. */
export default function LeavePage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canFile = hasPermission('HR_MANAGE') || hasPermission('LEAVE_MANAGE');
  const canDecide = hasPermission('LEAVE_MANAGE');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = () => {
    setState('loading');
    listLeave({ status: status || undefined, page, ...scopeParams }).then((d) => { setData(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [status, page, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { setPage(0); }, [status, scopeParams.scope, scopeParams.branchId]);

  const act = async (id, fn, message) => {
    setBusyId(id);
    try { await fn(); setNotice(message); load(); }
    catch (e) { setNotice(''); window.alert(extractErrorMessage(e)); }
    finally { setBusyId(''); }
  };
  const reject = (l) => {
    const note = window.prompt('Reason for rejecting (optional):', '');
    if (note === null) return;
    act(l.id, () => rejectLeave(l.id, note || undefined), 'Leave rejected.');
  };

  const columns = [
    { key: 'employeeName', header: 'Employee', render: (r) => <span><span className="font-medium text-ink-900">{r.employeeName}</span> <span className="text-xs text-ink-400">{r.employeeNumber}</span></span> },
    { key: 'branchName', header: 'Location' },
    { key: 'leaveType', header: 'Type', render: (r) => label(r.leaveType) },
    { key: 'dates', header: 'Dates', render: (r) => `${r.startDate} → ${r.endDate}` },
    { key: 'days', header: 'Days', className: 'text-right' },
    { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <span><Badge status={r.status} />{r.decidedByName ? <span className="ml-1 text-xs text-ink-400">by {r.decidedByName}</span> : null}</span> },
    ...(canFile ? [{
      key: 'actions', header: '', className: 'text-right whitespace-nowrap',
      render: (r) => (
        <span className="flex justify-end gap-2 text-xs font-medium text-sage-600">
          {canDecide && r.status === 'PENDING' && <button type="button" disabled={busyId === r.id} className="hover:underline" onClick={() => act(r.id, () => approveLeave(r.id), 'Leave approved – the days now show as on leave.')}>Approve</button>}
          {canDecide && r.status === 'PENDING' && <button type="button" disabled={busyId === r.id} className="hover:underline" onClick={() => reject(r)}>Reject</button>}
          {(r.status === 'PENDING' || r.status === 'APPROVED') && <button type="button" disabled={busyId === r.id} className="hover:underline" onClick={() => act(r.id, () => cancelLeave(r.id), 'Leave cancelled.')}>Cancel</button>}
        </span>
      ),
    }] : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Leave</h1>
        {canFile && <button onClick={() => setCreating(true)} className="btn btn-primary btn-sm">+ New Leave Request</button>}
      </div>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field text="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </Field>
        </div>
        {state === 'loading' && !data && <LoadingState />}
        {state === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && state !== 'error' && (
          <>
            <DataTable columns={columns} rows={data.content} emptyMessage="No leave requests." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>
      {creating && <NewLeaveModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setNotice('Leave request filed.'); load(); }} />}
    </div>
  );
}

function NewLeaveModal({ onClose, onSaved }) {
  const { scopeParams } = useBranchScope();
  const [employees, setEmployees] = useState([]);
  const [f, setF] = useState({ employeeId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setF((v) => ({ ...v, ...p }));
  useEffect(() => { listEmployees({ status: 'ACTIVE', size: 200, ...scopeParams }).then((d) => setEmployees(d.content)).catch(() => {}); }, []);

  const days = f.startDate && f.endDate ? Math.round((new Date(f.endDate) - new Date(f.startDate)) / 86400000) + 1 : 0;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try { await createLeave({ ...f, reason: f.reason.trim() || undefined }); onSaved(); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title="New Leave Request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field text="Employee">
          <select required className="input" value={f.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
            <option value="">Select…</option>
            {employees.map((x) => <option key={x.id} value={x.id}>{x.fullName} ({x.employeeNumber}) – {x.branchName}</option>)}
          </select>
        </Field>
        <Field text="Type">
          <select className="input" value={f.leaveType} onChange={(e) => set({ leaveType: e.target.value })}>
            {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="First day"><input required type="date" className="input" value={f.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: f.endDate || e.target.value })} /></Field>
          <Field text="Last day"><input required type="date" className="input" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        </div>
        {days > 0 && <p className="text-xs text-ink-500">{days} calendar day(s).</p>}
        <Field text="Reason (optional)"><input maxLength={500} className="input" value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'File request'}</button>
        </div>
      </form>
    </Modal>
  );
}
