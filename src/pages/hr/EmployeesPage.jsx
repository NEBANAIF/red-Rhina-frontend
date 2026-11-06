import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, assignEmployee, listDepartments, listShifts, getAttendanceHistory,
  listLinkableUsers, listPositions, listEligibleManagers } from '../../api/hr.js';
import { listTransferBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { formatMoney } from '../../utils/format.js';
import { Field, label, minutes, time } from './hrCommon.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';

/** Employees: factory workers, salespeople, warehouse and showroom staff, with their location history and leave balance. */
export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { scopeParams } = useBranchScope();
  const canManage = hasPermission('HR_MANAGE');
  const canSalary = hasPermission('HR_SALARY_VIEW');
  const [filters, setFilters] = useState({ search: '', type: '', status: 'ACTIVE', departmentId: '' });
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);       // { employee? } -> create / edit dialog
  const [detailId, setDetailId] = useState(null);
  const set = (p) => { setFilters((f) => ({ ...f, ...p })); setPage(0); };

  const [prereq, setPrereq] = useState({ departments: true, branches: true });   // the order is department > branch > employee > user
  useEffect(() => {
    listDepartments().then((d) => { setDepartments(d); setPrereq((p) => ({ ...p, departments: (d ?? []).some((x) => x.active !== false) })); }).catch(() => {});
    listTransferBranches().then((l) => { const arr = Array.isArray(l) ? l : (l?.content ?? []); setPrereq((p) => ({ ...p, branches: arr.length > 0 })); }).catch(() => {});
  }, []);
  const missingFirst = !prereq.departments ? 'a department (HR > Setup)' : !prereq.branches ? 'a branch (Branches)' : '';

  const load = () => {
    setState('loading');
    listEmployees({
      search: filters.search || undefined, type: filters.type || undefined, status: filters.status || undefined,
      departmentId: filters.departmentId || undefined, page, ...scopeParams,
    }).then((d) => { setData(d); setState('ready'); }).catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [filters, page, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { setPage(0); }, [scopeParams.scope, scopeParams.branchId]);

  const columns = [
    { key: 'employeeNumber', header: 'No.' },
    { key: 'fullName', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.fullName}</span> },
    { key: 'roleName', header: 'Role', render: (r) => r.roleName ?? '—' },
    { key: 'jobTitle', header: 'Position', render: (r) => r.positionTitle ?? r.jobTitle ?? '—' },
    { key: 'managerName', header: 'Reports to', render: (r) => r.managerName ?? '—' },
    { key: 'branchName', header: 'Location', render: (r) => <span>{r.branchName} <span className="text-xs text-ink-400">({label(r.branchType)})</span></span> },
    { key: 'departmentName', header: 'Department', render: (r) => r.departmentName ?? '—' },
    ...(canSalary ? [{ key: 'monthlySalary', header: 'Salary', render: (r) => formatMoney(r.monthlySalary), className: 'text-right' }] : []),
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Employees</h1>
        {canManage && <button onClick={() => setForm({})} disabled={!!missingFirst} title={missingFirst ? `Create ${missingFirst} first` : undefined} className="btn btn-primary btn-sm">+ Add Employee</button>}
      </div>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}
      {canManage && missingFirst && (
        <p className="alert alert-warning mb-3 text-sm">
          Every employee needs a <b>department</b> and a <b>branch</b> (they are separate), and a login needs an employee. Create {missingFirst} first, then you can add employees.
        </p>
      )}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field text="Search"><SearchInput value={filters.search} onChange={(v) => set({ search: v })} placeholder="Name, number or phone…" width="w-full sm:w-64" /></Field>
          <Field text="Department">
            <select required className="input" value={filters.departmentId} onChange={(e) => set({ departmentId: e.target.value })}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field text="Status">
            <select className="input" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        </div>
        {state === 'loading' && !data && <LoadingState />}
        {state === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && state !== 'error' && (
          <>
            <DataTable columns={columns} rows={data.content} onRowClick={(r) => setDetailId(r.id)} emptyMessage="No employees match. Pick another location in the selector at the top, or add an employee." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      {detailId && (
        <EmployeeDetail
          id={detailId} canManage={canManage}
          onClose={() => setDetailId(null)}
          onEdit={(emp) => { setDetailId(null); setForm({ employee: emp }); }}
          onChanged={(msg) => { setNotice(msg); load(); }}
        />
      )}
      {form && (
        <EmployeeForm
          employee={form.employee} canSalary={canSalary}
          onClose={() => setForm(null)}
          onSaved={(saved, created) => {
            setForm(null);
            // a login is optional: workers can be registered, assigned to departments and production orders without one
            if (created && !saved.userId && hasPermission('USER_MANAGE')
                && window.confirm(`${saved.fullName} was added as ${saved.employeeNumber}.\n\nCreate a login for them now?\n\nOK = create login now\nCancel = no login (they stay a normal employee and can still be assigned to departments and production orders)`)) {
              navigate(`/users?employeeId=${saved.id}`); return;
            }
            setNotice((created ? `${saved.fullName} added as ${saved.employeeNumber}.` : 'Employee saved.')
              + (created && !saved.userId ? ' No login yet - one can be created later on the Users page (optional).' : ''));
            load();
          }}
        />
      )}
    </div>
  );
}

function EmployeeDetail({ id, canManage, onClose, onEdit, onChanged }) {
  const [emp, setEmp] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState(false);

  const load = () => {
    getEmployee(id).then(setEmp).catch((e) => setError(extractErrorMessage(e)));
    getAttendanceHistory(id).then(setAttendance).catch(() => {});
  };
  useEffect(load, [id]);

  return (
    <Modal open title={emp ? `${emp.fullName} · ${emp.employeeNumber}` : 'Employee'} onClose={onClose}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!emp && !error && <LoadingState />}
      {emp && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><Badge status={emp.status} /><span className="text-ink-500">{emp.roleName ?? 'No login'}{(emp.positionTitle ?? emp.jobTitle) ? ` · ${emp.positionTitle ?? emp.jobTitle}` : ''}</span></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><dt className="text-ink-400">Location</dt><dd className="font-medium">{emp.branchName} ({label(emp.branchType)})</dd></div>
            <div><dt className="text-ink-400">Department</dt><dd className="font-medium">{emp.departmentName ?? '—'}</dd></div>
            <div><dt className="text-ink-400">Reports to</dt><dd className="font-medium">{emp.managerName ?? '—'}</dd></div>
            <div><dt className="text-ink-400">Default shift</dt><dd className="font-medium">{emp.defaultShiftName ?? '—'}</dd></div>
            <div><dt className="text-ink-400">Hired</dt><dd className="font-medium">{emp.hireDate}{emp.terminationDate ? ` – left ${emp.terminationDate}` : ''}</dd></div>
            <div><dt className="text-ink-400">Phone</dt><dd className="font-medium">{emp.phone ?? '—'}</dd></div>
            <div><dt className="text-ink-400">Email</dt><dd className="font-medium">{emp.email ?? '—'}</dd></div>
            <div><dt className="text-ink-400">Emergency contact</dt><dd className="font-medium">{emp.emergencyContact ?? '—'}</dd></div>
            <div><dt className="text-ink-400">System login</dt><dd className="font-medium">{emp.userName ?? 'none (no login)'}</dd></div>
            {emp.monthlySalary !== null && emp.monthlySalary !== undefined && (
              <>
                <div><dt className="text-ink-400">Monthly salary</dt><dd className="font-medium">{formatMoney(emp.monthlySalary)}</dd></div>
                <div><dt className="text-ink-400">Sales commission</dt><dd className="font-medium">{Number(emp.commissionRate)}%</dd></div>
              </>
            )}
          </dl>
          {emp.payItems && emp.payItems.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Monthly allowances and deductions</p>
              <ul className="space-y-0.5 text-xs text-ink-700">
                {emp.payItems.map((i) => (
                  <li key={i.id} className={i.active ? '' : 'text-ink-400 line-through'}>
                    {i.kind === 'ALLOWANCE' ? '+' : '−'} {i.name}: {formatMoney(i.amount)}{i.kind === 'ALLOWANCE' ? (i.taxable ? ' (taxable)' : ' (not taxed)') : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {emp.notes && <p className="text-ink-500">{emp.notes}</p>}

          {emp.leaveBalance && (
            <p className="rounded-lg bg-cream-50 px-3 py-2 text-xs text-ink-700">
              Annual leave {emp.leaveBalance.year}: <strong>{emp.leaveBalance.remaining}</strong> day(s) left of {emp.leaveBalance.entitled}
              {' '}({emp.leaveBalance.taken} taken, {emp.leaveBalance.pending} waiting for approval).
            </p>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Where {emp.fullName.split(' ')[0]} has worked</p>
            <ul className="space-y-1 text-xs text-ink-600">
              {emp.assignments.map((a, i) => (
                <li key={i}>{a.branchName} – from {a.startDate}{a.endDate ? ` to ${a.endDate}` : ' (now)'}{a.note ? ` – ${a.note}` : ''}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Last 30 days of attendance</p>
            {attendance.length === 0 ? <p className="text-xs text-ink-500">Nothing recorded.</p> : (
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id} className="border-t border-cream-200">
                        <td className="py-1 pr-3">{a.workDate}</td><td className="py-1 pr-3">{label(a.status)}</td>
                        <td className="py-1 pr-3">{time(a.checkIn)} – {time(a.checkOut)}</td>
                        <td className="py-1 pr-3 text-right">{minutes(a.workedMinutes)}</td>
                        <td className="py-1 text-right text-amber-700">{a.overtimeMinutes > 0 ? `+${minutes(a.overtimeMinutes)} OT` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex justify-end gap-2 border-t border-cream-200 pt-3">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMoving(true)}>Change location</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onEdit(emp)}>Edit</button>
            </div>
          )}
        </div>
      )}
      {moving && emp && <MoveModal emp={emp} onClose={() => setMoving(false)} onDone={() => { setMoving(false); onChanged(`${emp.fullName} was moved.`); load(); }} />}
    </Modal>
  );
}

function MoveModal({ emp, onClose, onDone }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { listTransferBranches().then((l) => setBranches(Array.isArray(l) ? l : (l?.content ?? []))).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try { await assignEmployee(emp.id, { branchId, effectiveDate: date || undefined, note: note.trim() || undefined }); onDone(); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={`Move ${emp.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-ink-500">Currently at {emp.branchName}. The old location keeps its history; attendance from the move date counts at the new one.</p>
        <Field text="New location">
          <select required className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select…</option>
            {branches.filter((b) => b.id !== emp.branchId).map((b) => <option key={b.id} value={b.id}>{b.name} ({label(b.type)})</option>)}
          </select>
        </Field>
        <Field text="From"><input type="date" className="input" value={date} min={emp.hireDate} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field text="Note (optional)"><input maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Move'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EmployeeForm({ employee, canSalary, onClose, onSaved }) {
  const editing = !!employee;
  const { scope, specificBranchId } = useBranchScope();
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [logins, setLogins] = useState([]);
  const [managers, setManagers] = useState([]);
  const [f, setF] = useState({
    fullName: employee?.fullName ?? '', jobTitle: employee?.jobTitle ?? '',
    hireDate: employee?.hireDate ?? new Date().toISOString().slice(0, 10), branchId: employee?.branchId ?? '',
    departmentId: employee?.departmentId ?? '', defaultShiftId: employee?.defaultShiftId ?? '', phone: employee?.phone ?? '',
    email: employee?.email ?? '', address: employee?.address ?? '', emergencyContact: employee?.emergencyContact ?? '',
    annualLeaveDays: employee?.annualLeaveDays ?? 16, userId: '', notes: employee?.notes ?? '', status: employee?.status ?? 'ACTIVE',
    terminationDate: employee?.terminationDate ?? '', monthlySalary: employee?.monthlySalary ?? '', commissionRate: employee?.commissionRate ?? '',
    positionId: employee?.positionId ?? '', managerId: employee?.managerId ?? '',
    payItems: (employee?.payItems ?? []).map((i) => ({ kind: i.kind, name: i.name, amount: String(i.amount), taxable: i.taxable, active: i.active })),
  });
  const [positions, setPositions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const chosenPosition = positions.find((p) => p.id === f.positionId);
  const loginRole = (f.userId ? logins.find((u) => u.id === f.userId)?.role : employee?.roleName) || null;
  // choosing a position fills the department (its only one, or keeps the current one when the position works there too)
  const pickPosition = (id) => {
    const pos = positions.find((p) => p.id === id);
    const ids = pos?.departmentIds ?? [];
    if (!pos || ids.includes(f.departmentId)) { set({ positionId: id }); return; }
    set({ positionId: id, departmentId: ids.length === 1 ? ids[0] : '', managerId: '' });
  };
  // choosing a department that the chosen position does not work in clears the position
  const pickDepartment = (id) => {
    const keep = !chosenPosition || (chosenPosition.departmentIds ?? []).includes(id);
    set({ departmentId: id, managerId: '', ...(keep ? {} : { positionId: '' }) });
  };

  // "Reporting to": only active people of the chosen department (the server enforces the same rule)
  useEffect(() => {
    if (!f.departmentId) { setManagers([]); return; }
    let cancelled = false;
    listEligibleManagers(f.departmentId, employee?.id, f.positionId || undefined).then((l) => { if (!cancelled) setManagers(l); }).catch(() => { if (!cancelled) setManagers([]); });
    return () => { cancelled = true; };
  }, [f.departmentId, f.positionId]);

  useEffect(() => {
    listDepartments().then((d) => setDepartments(d.filter((x) => x.active))).catch(() => {});
    listShifts().then((s) => setShifts(s.filter((x) => x.active))).catch(() => {});
    listPositions().then((p) => setPositions(p.filter((x) => x.active))).catch(() => {});
    if (!employee?.userId) listLinkableUsers().then(setLogins).catch(() => {});
    if (!editing) {
      listTransferBranches().then((l) => {
        const arr = Array.isArray(l) ? l : (l?.content ?? []);
        setBranches(arr);
        if (scope === 'SPECIFIC' && arr.some((b) => b.id === specificBranchId)) setF((v) => ({ ...v, branchId: specificBranchId }));
      }).catch(() => {});
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      fullName: f.fullName.trim(), jobTitle: f.jobTitle.trim() || undefined, hireDate: f.hireDate,
      branchId: f.branchId, departmentId: f.departmentId || undefined, defaultShiftId: f.defaultShiftId || undefined,
      phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, address: f.address.trim() || undefined,
      emergencyContact: f.emergencyContact.trim() || undefined, annualLeaveDays: Number(f.annualLeaveDays), userId: f.userId || undefined, notes: f.notes.trim() || undefined,
      status: editing ? f.status : undefined, terminationDate: editing && f.terminationDate ? f.terminationDate : undefined,
      monthlySalary: canSalary && f.monthlySalary !== '' ? Number(f.monthlySalary) : undefined,
      commissionRate: canSalary && f.commissionRate !== '' ? Number(f.commissionRate) : undefined,
      positionId: f.positionId || null, managerId: f.managerId || null,
      payItems: canSalary ? f.payItems.filter((i) => i.name.trim() && Number(i.amount) > 0)
        .map((i) => ({ kind: i.kind, name: i.name.trim(), amount: Number(i.amount), taxable: i.kind === 'ALLOWANCE' ? i.taxable : false, active: i.active })) : undefined,
    };
    try {
      const saved = editing ? await updateEmployee(employee.id, payload) : await createEmployee(payload);
      onSaved(saved, !editing);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? `Edit ${employee.fullName}` : 'Add Employee'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Full name"><input required autoFocus maxLength={200} className="input" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
          <Field text={loginRole ? "Role (from the employee's login)" : "Role (from the position)"}>
            <input readOnly className="input" placeholder={chosenPosition ? '— this position needs no login' : '— choose a position'}
              title="The role comes from the employee's login; until a login exists it is the role of the chosen position"
              value={loginRole ?? chosenPosition?.accessRoleName ?? ''} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Position">
            <select required className="input" value={f.positionId} onChange={(e) => pickPosition(e.target.value)}>
              <option value="">Select position…</option>
              {positions.filter((p) => !f.departmentId || (p.departmentIds ?? []).includes(f.departmentId))
                .map((p) => <option key={p.id} value={p.id}>{p.title}{p.departmentNames?.length > 1 ? ` · ${p.departmentNames.join(' / ')}` : ''}{p.needsLogin ? '' : ' (no login)'}</option>)}
            </select>
          </Field>
          <Field text="Hire date"><input required type="date" className="input" value={f.hireDate} onChange={(e) => set({ hireDate: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Job title (when no position is chosen)"><input maxLength={150} disabled={!!f.positionId} className="input" value={f.positionId ? (positions.find((p) => p.id === f.positionId)?.title ?? '') : f.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} /></Field>
          <Field text="Reporting to (manager of the same department)">
            <select className="input" disabled={!f.departmentId} value={f.managerId} onChange={(e) => set({ managerId: e.target.value })}>
              <option value="">{f.departmentId ? '— the head of the department —' : 'Choose a department first'}</option>
              {employee?.managerId && f.managerId === employee.managerId && !managers.some((m) => m.id === employee.managerId) && (
                <option value={employee.managerId}>{employee.managerName} (not in this department)</option>
              )}
              {managers.map((m) => <option key={m.id} value={m.id}>{m.fullName}{m.positionTitle ? ` · ${m.positionTitle}` : ''}</option>)}
            </select>
          </Field>
        </div>
        {!editing && (
          <Field text="Works at (location)">
            <select required className="input" value={f.branchId} onChange={(e) => set({ branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({label(b.type)})</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Department">
            <SearchableSelect required placeholder="Type to search departments…" emptyText="No department matches."
              options={departments.filter((d) => d.active !== false || d.id === f.departmentId).map((d) => ({ value: d.id, label: d.name }))}
              value={f.departmentId} onChange={pickDepartment} />
            {chosenPosition && !f.departmentId && (chosenPosition.departmentNames?.length ?? 0) > 1 && (
              <span className="mt-1 block text-xs text-ink-500">This position works in {chosenPosition.departmentNames.join(' and ')} - choose the main one.</span>
            )}
          </Field>
          <Field text="Default shift">
            <select className="input" value={f.defaultShiftId} onChange={(e) => set({ defaultShiftId: e.target.value })}>
              <option value="">None (8 hours)</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({time(s.startTime)}–{time(s.endTime)})</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Phone"><input maxLength={50} className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field text="Email"><input type="email" maxLength={200} className="input" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        </div>
        <Field text="Address"><input maxLength={500} className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Emergency contact"><input maxLength={300} className="input" value={f.emergencyContact} onChange={(e) => set({ emergencyContact: e.target.value })} /></Field>
          <Field text="Annual leave days"><input type="number" min="0" className="input" value={f.annualLeaveDays} onChange={(e) => set({ annualLeaveDays: e.target.value })} /></Field>
        </div>
        <Field text="System login (optional)">
          {employee?.userId ? (
            <p className="input flex items-center text-sm text-ink-600">{employee.userName} (linked)</p>
          ) : (
            <select className="input" value={f.userId} onChange={(e) => set({ userId: e.target.value })}>
              <option value="">Not linked</option>
              {logins.map((u) => <option key={u.id} value={u.id}>{u.name} – {u.email} ({u.branchName})</option>)}
            </select>
          )}
        </Field>
        {Number(f.commissionRate) > 0 && !employee?.userId && !f.userId && (
          <p className="-mt-2 text-xs text-amber-700">A commission needs a linked login, otherwise the employee's sales cannot be counted.</p>
        )}
        {canSalary && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field text="Monthly salary"><input type="number" min="0" step="0.01" className="input" value={f.monthlySalary} onChange={(e) => set({ monthlySalary: e.target.value })} /></Field>
            <Field text="Sales commission % (needs a linked login)"><input type="number" min="0" max="100" step="0.01" className="input" value={f.commissionRate} onChange={(e) => set({ commissionRate: e.target.value })} /></Field>
          </div>
        )}
        {canSalary && (
          <div>
            <p className="mb-1 text-xs font-medium text-ink-500">Monthly allowances and deductions (applied by payroll)</p>
            {f.payItems.map((i, idx) => (
              <div key={idx} className="mb-2 flex flex-wrap items-center gap-2">
                <select className="input w-32" value={i.kind} onChange={(e) => set({ payItems: f.payItems.map((x, j) => (j === idx ? { ...x, kind: e.target.value } : x)) })}>
                  <option value="ALLOWANCE">Allowance</option><option value="DEDUCTION">Deduction</option>
                </select>
                <input className="input w-44" maxLength={120} placeholder="Name (e.g. Transport)" value={i.name} onChange={(e) => set({ payItems: f.payItems.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)) })} />
                <input type="number" min="0.01" step="0.01" className="input w-28" placeholder="Amount" value={i.amount} onChange={(e) => set({ payItems: f.payItems.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x)) })} />
                {i.kind === 'ALLOWANCE' && (
                  <label className="flex items-center gap-1 text-xs text-ink-600"><input type="checkbox" checked={i.taxable} onChange={(e) => set({ payItems: f.payItems.map((x, j) => (j === idx ? { ...x, taxable: e.target.checked } : x)) })} /> taxable</label>
                )}
                <label className="flex items-center gap-1 text-xs text-ink-600"><input type="checkbox" checked={i.active} onChange={(e) => set({ payItems: f.payItems.map((x, j) => (j === idx ? { ...x, active: e.target.checked } : x)) })} /> active</label>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => set({ payItems: f.payItems.filter((_, j) => j !== idx) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ payItems: [...f.payItems, { kind: 'ALLOWANCE', name: '', amount: '', taxable: true, active: true }] })}>+ Add allowance / deduction</button>
          </div>
        )}
        {editing && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field text="Status">
              <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive (left)</option>
              </select>
            </Field>
            <Field text="Last working day (if left)"><input type="date" className="input" value={f.terminationDate} onChange={(e) => set({ terminationDate: e.target.value })} /></Field>
          </div>
        )}
        <Field text="Notes"><textarea rows={2} maxLength={1000} className="input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : editing ? 'Save changes' : 'Add employee'}</button>
        </div>
      </form>
    </Modal>
  );
}
