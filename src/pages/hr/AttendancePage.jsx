import React, { useEffect, useState } from 'react';
import { getAttendanceSheet, recordAttendance, listShifts } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { Field, typeLabel, label, minutes, time } from './hrCommon.jsx';

const STATUSES = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'];
const today = () => new Date().toISOString().slice(0, 10);

/** The daily attendance sheet: everyone who should be working that day at the picked locations, and what was recorded for them. */
export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canRecord = hasPermission('ATTENDANCE_MANAGE');
  const [date, setDate] = useState(today());
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setState('loading');
    getAttendanceSheet({ date, search: search || undefined, ...scopeParams })
      .then((d) => { setRows(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [date, search, scopeParams.scope, scopeParams.branchId]);

  const mark = async (row, status) => {
    setBusy(true);
    try { await recordAttendance({ employeeId: row.employeeId, workDate: date, status }); setNotice(''); load(); }
    catch (e) { setNotice(extractErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const markAllPresent = async () => {
    const open = (rows || []).filter((r) => !r.attendance);
    if (open.length === 0) return;
    if (!window.confirm(`Mark ${open.length} employee(s) with nothing recorded as present for ${date}?`)) return;
    setBusy(true);
    let done = 0;
    try {
      for (const r of open) { await recordAttendance({ employeeId: r.employeeId, workDate: date, status: 'PRESENT' }); done++; }
      setNotice(`${done} employee(s) marked present.`);
    } catch (e) {
      setNotice(`${done} marked, then stopped: ${extractErrorMessage(e)}`);
    } finally { setBusy(false); load(); }
  };

  const count = (...s) => (rows || []).filter((r) => r.attendance && s.includes(r.attendance.status)).length;
  const columns = [
    { key: 'employeeName', header: 'Employee', render: (r) => <span><span className="font-medium text-ink-900">{r.employeeName}</span> <span className="text-xs text-ink-400">{r.employeeNumber}</span></span> },
    { key: 'roleName', header: 'Role', render: (r) => r.roleName ?? '—' },
    { key: 'branchName', header: 'Location' },
    { key: 'shift', header: 'Shift', render: (r) => r.attendance?.shiftName ?? r.defaultShiftName ?? '—' },
    { key: 'status', header: 'Status', render: (r) => (r.attendance ? <Badge status={r.attendance.status} /> : <span className="text-ink-400">Not recorded</span>) },
    { key: 'times', header: 'In – Out', render: (r) => (r.attendance ? `${time(r.attendance.checkIn)} – ${time(r.attendance.checkOut)}` : '—') },
    { key: 'worked', header: 'Worked', render: (r) => (r.attendance ? minutes(r.attendance.workedMinutes) : '—'), className: 'text-right' },
    { key: 'overtime', header: 'Overtime', render: (r) => (r.attendance?.overtimeMinutes > 0 ? <span className="font-medium text-amber-700">{minutes(r.attendance.overtimeMinutes)}</span> : '—'), className: 'text-right' },
    ...(canRecord ? [{
      key: 'actions', header: '', className: 'text-right whitespace-nowrap',
      render: (r) => (
        <span className="flex justify-end gap-2 text-xs font-medium text-sage-600">
          {!r.attendance && <button type="button" disabled={busy} className="hover:underline" onClick={() => mark(r, 'PRESENT')}>Present</button>}
          {!r.attendance && <button type="button" disabled={busy} className="hover:underline" onClick={() => mark(r, 'ABSENT')}>Absent</button>}
          <button type="button" disabled={busy} className="hover:underline" onClick={() => setEditing(r)}>{r.attendance ? 'Edit' : 'Times…'}</button>
        </span>
      ),
    }] : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Attendance</h1>
        {canRecord && <button type="button" disabled={busy || !rows?.some((r) => !r.attendance)} onClick={markAllPresent} className="btn btn-secondary btn-sm">Mark all unrecorded as present</button>}
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Worked time and overtime come from the check-in / check-out times and the employee&apos;s shift. A PRESENT day without times counts the shift&apos;s normal hours.
      </p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      {rows && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} label="Expected" value={String(rows.length)} />
          <KpiCard index={1} label="Present (incl. late)" value={String(count('PRESENT', 'LATE', 'HALF_DAY'))} hint={`${count('LATE')} late`} />
          <KpiCard index={2} label="Absent / on leave" value={`${count('ABSENT')} / ${count('ON_LEAVE')}`} warn={count('ABSENT') > 0} />
          <KpiCard index={3} label="Not recorded" value={String(rows.filter((r) => !r.attendance).length)} warn={rows.some((r) => !r.attendance)} />
        </div>
      )}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field text="Day"><input type="date" className="input" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <Field text="Search"><SearchInput value={search} onChange={setSearch} placeholder="Name or number…" width="w-full sm:w-64" /></Field>
        </div>
        {state === 'loading' && !rows && <LoadingState />}
        {state === 'error' && <ErrorState message={error} onRetry={load} />}
        {rows && state !== 'error' && <DataTable columns={columns} rows={rows} keyField="employeeId" emptyMessage="Nobody is expected at the selected location on this day." />}
      </div>

      {editing && <AttendanceModal row={editing} date={date} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Attendance saved.'); load(); }} />}
    </div>
  );
}

function AttendanceModal({ row, date, onClose, onSaved }) {
  const a = row.attendance;
  const [shifts, setShifts] = useState([]);
  const [f, setF] = useState({
    status: a?.status ?? '', shiftId: a?.shiftId ?? row.defaultShiftId ?? '', checkIn: a?.checkIn ? time(a.checkIn) : '',
    checkOut: a?.checkOut ? time(a.checkOut) : '', note: a?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const off = f.status === 'ABSENT' || f.status === 'ON_LEAVE';
  useEffect(() => { listShifts().then((s) => setShifts(s.filter((x) => x.active))).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await recordAttendance({
        employeeId: row.employeeId, workDate: date, status: f.status || undefined, shiftId: f.shiftId || undefined,
        checkIn: !off && f.checkIn ? f.checkIn : undefined, checkOut: !off && f.checkOut ? f.checkOut : undefined, note: f.note.trim() || undefined,
      });
      onSaved();
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={`${row.employeeName} – ${date}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Status (automatic when left empty)">
            <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">Automatic (from check-in)</option>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </Field>
          <Field text="Shift">
            <select className="input" value={f.shiftId} onChange={(e) => set({ shiftId: e.target.value })}>
              <option value="">None (8 hours)</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({time(s.startTime)}–{time(s.endTime)})</option>)}
            </select>
          </Field>
        </div>
        {!off && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field text="Check-in"><input type="time" className="input" value={f.checkIn} onChange={(e) => set({ checkIn: e.target.value })} /></Field>
            <Field text="Check-out"><input type="time" className="input" value={f.checkOut} onChange={(e) => set({ checkOut: e.target.value })} /></Field>
          </div>
        )}
        <Field text="Note (optional)"><input maxLength={500} className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
