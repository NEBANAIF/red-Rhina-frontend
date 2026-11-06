import React, { useEffect, useState } from 'react';
import { searchUsers, updateUser, setUserActive, resetUserPassword, provisionUser, reissueCredentials, suggestUsername, sendTestEmail, getMailSettings, saveMailSettings } from '../../api/users.js';
import { getEmployee, listLinkableEmployees } from '../../api/hr.js';
import { useSearchParams } from 'react-router-dom';
import PasswordInput from '../../components/PasswordInput.jsx';
import PasswordChecklist from '../../components/PasswordChecklist.jsx';
import { isPasswordValid } from '../../utils/passwordPolicy.js';
import { listBranches } from '../../api/branches.js';
import { listRoles } from '../../api/roles.js';
import { extractErrorMessage } from '../../api/client.js';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Badge from '../../components/Badge.jsx';
import { formatDate } from '../../utils/format.js';
import Icon from '../../components/Icon.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';
import FilterBar, { FilterField } from '../../components/FilterBar.jsx';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import { dayStartIso, dayEndIso } from '../../utils/dateRange.js';

// The roles come from the Roles & Permissions page (GET /api/roles). A role knows what kind of
// branch it belongs to (branchType: STORE, WAREHOUSE, or none for the Administrator), so the form
// only offers a branch of the right type. The backend re-validates this regardless.

const COLUMNS = (onEdit, onResetPassword, onToggleActive, onResend) => [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
  { key: 'username', header: 'Username' },
  { key: 'email', header: 'Email' },
  { key: 'roleName', header: 'Role', render: (r) => r.roleName || r.role.replaceAll('_', ' ') },
  { key: 'branchName', header: 'Branch', render: (r) => r.branchName || '—' },
  {
    key: 'active', header: 'Status',
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1">
        <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} />
        {r.mustChangePassword && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Waiting for first sign-in</span>}
      </span>
    ),
  },
  {
    key: 'actions', header: '', className: 'text-right',
    render: (r) => (
      <div className="flex justify-end gap-3 text-xs">
        <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="btn-icon" title="Edit user" aria-label="Edit user"><Icon name="edit" size={15} /></button>
        {r.mustChangePassword && <button onClick={(e) => { e.stopPropagation(); onResend(r); }} className="btn-icon" title="Send new credentials by e-mail" aria-label="Send new credentials"><Icon name="mail" size={15} /></button>}
        <button onClick={(e) => { e.stopPropagation(); onResetPassword(r); }} className="btn-icon" title="Reset password" aria-label="Reset password"><Icon name="lock" size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); onToggleActive(r); }} className="btn-icon" title={r.active ? "Deactivate" : "Activate"} aria-label={r.active ? "Deactivate user" : "Activate user"}>{r.active ? <Icon name="close" size={15} /> : <Icon name="check" size={15} />}</button>
      </div>
    ),
  },
];

const EXPORT_COLUMNS = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Email', value: (r) => r.email },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Role', value: (r) => r.roleName || (r.role || '').replaceAll('_', ' ') },
  { header: 'Branch', value: (r) => r.branchName },
  { header: 'Status', value: (r) => (r.active ? 'Active' : 'Inactive') },
  { header: 'Created', value: (r) => r.createdAt, type: 'date' },
];

export default function UsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const [mailOpen, setMailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefill, setPrefill] = useState(null);       // the employee a new login is being created for
  const [credentials, setCredentials] = useState(null); // result of creating / re-sending credentials
  const [params, setParams] = useSearchParams();

  // Arriving from "Add employee": /users?employeeId=... opens the form with the employee's details filled in
  useEffect(() => {
    const employeeId = params.get('employeeId');
    if (!employeeId) return;
    getEmployee(employeeId)
      .then((emp) => {
        if (emp.userId) { setNotice(`${emp.fullName} already has a login.`); return; }
        setPrefill({ employeeId: emp.id, name: emp.fullName, email: emp.email || '', phone: emp.phone || '', branchId: emp.branchId, branchName: emp.branchName });
        setCreateOpen(true);
      })
      .catch((err) => setNotice(extractErrorMessage(err)))
      .finally(() => { params.delete('employeeId'); setParams(params, { replace: true }); });
  }, []);

  const resend = async (u) => {
    if (!window.confirm(`Send new temporary credentials to ${u.email}? The old temporary password will stop working.`)) return;
    try { setCredentials(await reissueCredentials(u.id)); load(); }
    catch (err) { setNotice(extractErrorMessage(err)); }
  };

  const load = () => {
    setStatus('loading');
    searchUsers({
      search: search || undefined, page, branchId: branchFilter || undefined,
      active: activeFilter === '' ? undefined : activeFilter === 'active',
      fromAt: dayStartIso(from), toAt: dayEndIso(to),
    })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };
  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(from || to || branchFilter || activeFilter);
  const clearFilters = () => { setPage(0); setFrom(''); setTo(''); setBranchFilter(''); setActiveFilter(''); };
  useEffect(() => { if (!rangeInvalid) load(); }, [page, from, to, branchFilter, activeFilter]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [search]);
  useEffect(() => { listBranches().then(setBranches); listRoles().then(setRoles); }, []);

  const confirmToggle = async () => {
    setBusy(true);
    try { await setUserActive(toggleTarget.id, !toggleTarget.active); setToggleTarget(null); load(); }
    catch (err) { alert(extractErrorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Users</h1>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Search name or email…" width="w-full sm:w-56" />
          <ExportButton
            title="Users" columns={EXPORT_COLUMNS}
            dateField="createdAt" dateLabel="Created date"
            nameFields={['name', 'email', 'roleName', 'branchName']} nameLabel="Name, email, role or branch"
            initialSearch={search} initialFrom={from} initialTo={to}
            fetchRows={({ serverFrom, serverTo }) => fetchAllPages(searchUsers, {
              branchId: branchFilter || undefined, active: activeFilter === '' ? undefined : activeFilter === 'active',
              from: serverFrom, to: serverTo,
            })}
          />
          <button type="button" className="btn btn-sm" onClick={() => setMailOpen(true)}>E-mail settings</button>
          <button onClick={() => { setPrefill(null); setCreateOpen(true); }} className="btn btn-primary btn-sm">
            + New User
          </button>
        </div>
      </div>

      {notice && <div className="mb-3 rounded-lg bg-cream-100 px-3 py-2 text-sm text-ink-700">{notice} <button className="ml-2 underline" onClick={() => setNotice('')}>dismiss</button></div>}

      <FilterBar
        from={from} to={to} dateLabel="Created date"
        onDates={(r) => { setPage(0); setFrom(r.from); setTo(r.to); }}
        active={filtersActive} onClear={clearFilters}
      >
        <FilterField label="Branch">
          <ElegantSelect value={branchFilter} onChange={(v) => { setPage(0); setBranchFilter(v); }} ariaLabel="Filter by branch" minWidth={170}>
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </ElegantSelect>
        </FilterField>
        <FilterField label="Status">
          <ElegantSelect value={activeFilter} onChange={(v) => { setPage(0); setActiveFilter(v); }} ariaLabel="Filter by status" minWidth={140}>
            <option value="">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </ElegantSelect>
        </FilterField>
      </FilterBar>

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable
              columns={COLUMNS(setEditing, setResetTarget, setToggleTarget, resend)}
              rows={data.content}
              emptyMessage="No users found."
            />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <UserFormModal
        open={createOpen || !!editing}
        user={editing}
        prefill={prefill}
        branches={branches}
        roles={roles}
        onClose={() => { setCreateOpen(false); setEditing(null); setPrefill(null); }}
        onSaved={(result) => { setCreateOpen(false); setEditing(null); setPrefill(null); if (result) setCredentials(result); load(); }}
      />
      <CredentialsResult result={credentials} onClose={() => setCredentials(null)} />

      <MailSettingsModal open={mailOpen} onClose={() => setMailOpen(false)} />
      <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} />

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate user?' : 'Activate user?'}
        description={toggleTarget?.active ? `${toggleTarget?.name} will no longer be able to sign in.` : `${toggleTarget?.name} will be able to sign in again.`}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.active}
        busy={busy}
        onConfirm={confirmToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}

function UserFormModal({ open, user, prefill: prefillProp, branches, roles, onClose, onSaved }) {
  const isEdit = !!user;
  // A login can optionally be created for an employee that already exists (a worker without an account)
  const [employees, setEmployees] = useState([]);
  const [linked, setLinked] = useState(null);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const prefill = prefillProp || linked;
  useEffect(() => {
    if (!open || isEdit || prefillProp) return;
    setLinked(null);
    setEmployeesLoaded(false);
    listLinkableEmployees().then((l) => { setEmployees(l); setEmployeesLoaded(true); }).catch(() => { setEmployees([]); setEmployeesLoaded(true); });
  }, [open, isEdit, prefillProp]);
  // a login is always for an employee: department > branch > employee > user
  const noEmployees = !isEdit && !prefillProp && employeesLoaded && employees.length === 0;
  const pickEmployee = (id) => {
    const emp = employees.find((x) => x.id === id);
    if (!emp) { setLinked(null); setForm((f) => ({ ...f, name: '', email: '', phone: '', username: '' })); return; }
    setLinked({ employeeId: emp.id, name: emp.fullName, email: emp.email || '', phone: emp.phone || '', branchId: emp.branchId, branchName: emp.branchName });
    setForm((f) => ({ ...f, name: emp.fullName, email: emp.email || '', phone: emp.phone || '', roleId: f.roleId || emp.accessRoleId || '' }));
    suggestUsername(emp.fullName).then((u) => setForm((f) => ({ ...f, username: u }))).catch(() => {});
  };
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(isEdit
      ? { name: user.name, username: user.username || '', email: user.email, confirmEmail: '', phone: user.phone || '', roleId: user.roleId || '', branchId: user.branchId || '' }
      : { ...blank(), name: prefillProp?.name || '', email: prefillProp?.email || '', phone: prefillProp?.phone || '' });
    if (!isEdit && prefillProp?.name) suggestUsername(prefillProp.name).then((u) => setForm((f) => ({ ...f, username: u }))).catch(() => {});
  }, [open, user, prefillProp]);

  const nameChanged = (name) => {
    setForm((f) => ({ ...f, name }));
    if (!isEdit && !prefill && name.trim().length > 1) suggestUsername(name).then((u) => setForm((f) => (f.usernameTouched ? f : { ...f, username: u }))).catch(() => {});
  };

  const selectedRole = roles.find((r) => r.id === form.roleId);
  const requiredType = selectedRole?.branchType || null;
  const branchOptions = requiredType ? branches.filter((b) => b.type === requiredType) : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && !prefill?.employeeId) { setError('Choose the employee this login is for.'); return; }
    setSaving(true); setError('');
    try {
      const branchId = selectedRole?.administrator ? null : (form.branchId || null);
      if (isEdit) {
        await updateUser(user.id, { name: form.name, phone: form.phone, roleId: form.roleId, branchId, username: form.username });
      } else {
        if (form.email.trim().toLowerCase() !== form.confirmEmail.trim().toLowerCase()) { setError('The two e-mail addresses are not the same.'); setSaving(false); return; }
        const result = await provisionUser({
          employeeId: prefill?.employeeId, name: form.name, username: form.username, email: form.email.trim(), confirmEmail: form.confirmEmail.trim(),
          phone: form.phone, roleId: form.roleId, branchId: prefill ? undefined : branchId,
        });
        onSaved(result);
        return;
      }
      onSaved();
    } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={isEdit ? `Edit ${user?.name}` : prefill ? `Create login for ${prefill.name}` : 'New User'} onClose={onClose}>
      {noEmployees && (
        <p className="alert alert-warning text-sm">
          There is no employee without a login. A login is always created for an employee.
          Register the person in HR &gt; Employees first (an employee needs a department and a branch), then create their login here.
        </p>
      )}
      <form onSubmit={submit} className={noEmployees ? 'hidden' : 'space-y-3'}>
        {!isEdit && !prefillProp && employees.length > 0 && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Employee this login is for</span>
            <select required className="input" value={linked?.employeeId || ''} onChange={(e) => pickEmployee(e.target.value)}>
              <option value="">Select the employee...</option>
              {employees.map((x) => <option key={x.id} value={x.id}>{x.fullName}{x.positionTitle ? ` - ${x.positionTitle}` : ''} ({x.branchName})</option>)}
            </select>
          </label>
        )}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Name</span>
          <input required className="input" readOnly={!!prefill} value={form.name} onChange={(e) => nameChanged(e.target.value)} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Email{!isEdit && ' (the credentials are sent here)'}</span>
          <input required type="email" disabled={isEdit} className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        {!isEdit && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Confirm email (type it again)</span>
            <input required type="email" autoComplete="off" onPaste={(e) => e.preventDefault()} className="input" value={form.confirmEmail} onChange={(e) => setForm({ ...form, confirmEmail: e.target.value })} />
          </label>
        )}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Username (used to sign in, must be unique)</span>
          <input required minLength={3} maxLength={60} pattern="[A-Za-z0-9._\-]{3,60}" title="3-60 characters: letters, digits, dot, dash or underscore" autoComplete="off" className="input" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value, usernameTouched: true })} />
        </label>
        {!isEdit && <p className="-mt-1 text-xs text-ink-500">A random temporary password is generated and e-mailed with the username. They must choose their own password at the first sign-in.</p>}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Role</span>
          <select required className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value, branchId: '' })}>
            <option value="">Select role...</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {roles.length === 0 && <span className="mt-1 block text-xs text-amber-700">There are no roles yet. Create one on the Roles page first.</span>}
        </label>
        {prefill && <p className="text-xs text-ink-500">Location: <span className="font-medium text-ink-800">{prefill.branchName}</span> (from the employee record)</p>}
        {requiredType && !prefill && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Branch ({requiredType.toLowerCase()})</span>
            <select required className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select branch...</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create login and e-mail credentials'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ target, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { setPassword(''); setError(''); setDone(false); }, [target]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await resetUserPassword(target.id, password); setDone(true); }
    catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!target} title={`Reset Password — ${target?.name}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">Password set. {target?.name} will be asked to choose their own password at the next sign-in. Share the password through a secure channel.</p>
          <div className="flex justify-end"><button onClick={onClose} className="btn btn-primary btn-sm">Done</button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">New Password</span>
            <PasswordInput required autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordChecklist password={password} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={saving || !isPasswordValid(password)} className="btn btn-primary btn-sm">
              {saving ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function blank() {
  return { name: '', username: '', email: '', confirmEmail: '', phone: '', roleId: '', branchId: '' };
}

/** What happened after creating a login / re-sending credentials: e-mailed, or (mail down) shown once for the administrator. */
function CredentialsResult({ result, onClose }) {
  return (
    <Modal open={!!result} title={result?.emailSent ? 'Credentials sent' : 'Login created'} onClose={onClose}>
      {result && (
        <div className="space-y-3 text-sm">
          {result.emailSent
            ? <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-emerald-800"><b>Congratulations, the login was created!</b> {result.message}</p>
            : <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900"><b>The e-mail could not be sent.</b> Give the username and temporary password below to the person yourself. {result.message}</p>}
          <div className="rounded-lg bg-cream-50 p-3">
            <div>Username: <span className="font-mono font-medium">{result.username}</span></div>
            <div>Role: <span className="font-medium">{result.roleName}</span></div>
            {result.temporaryPassword && (
              <div className="mt-1 flex flex-wrap items-center gap-2">Temporary password (shown only now): <span className="select-all rounded bg-white px-2 py-0.5 font-mono font-semibold">{result.temporaryPassword}</span>
                <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(`Username: ${result.username}\nTemporary password: ${result.temporaryPassword}`)}>Copy</button></div>
            )}
          </div>
          <p className="text-xs text-ink-500">The temporary password works once and for {72} hours. At the first sign-in the person must choose their own password.</p>
          <div className="flex justify-end"><button onClick={onClose} className="btn btn-primary btn-sm">Done</button></div>
        </div>
      )}
    </Modal>
  );
}

const MAIL_PROVIDERS = [
  { key: 'gmail', name: 'Gmail', host: 'smtp.gmail.com', port: 587, login: 'Your Gmail address', loginFixed: '', secret: 'App password (16 letters)',
    help: 'Turn on 2-Step Verification, then create an app password at myaccount.google.com/apppasswords. Sends from your Gmail address.' },
  { key: 'brevo', name: 'Brevo (free, about 300 a day)', host: 'smtp-relay.brevo.com', port: 587, login: 'SMTP login (shown in Brevo > SMTP & API > SMTP)', loginFixed: '', secret: 'SMTP key',
    help: 'Create a free account at brevo.com, go to SMTP & API > SMTP, create an SMTP key, and add and verify your sender address under Senders. The "Send from" address must be that verified sender.' },
  { key: 'sendgrid', name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, login: 'Login', loginFixed: 'apikey', secret: 'API key',
    help: 'In SendGrid create an API key (Mail Send permission) and verify a sender address. The login is always the word apikey.' },
  { key: 'resend', name: 'Resend', host: 'smtp.resend.com', port: 587, login: 'Login', loginFixed: 'resend', secret: 'API key',
    help: 'In Resend create an API key and verify your domain. The login is always the word resend, and "Send from" must be an address on your verified domain.' },
  { key: 'ses', name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, login: 'SMTP user name', loginFixed: '', secret: 'SMTP password',
    help: 'In Amazon SES create SMTP credentials and verify the sender. Change the server if your region is not us-east-1 (for example email-smtp.eu-west-1.amazonaws.com).' },
  { key: 'other', name: 'Other SMTP server', host: '', port: 587, login: 'SMTP login', loginFixed: '', secret: 'SMTP password', help: 'Use the server name, port, login and password your e-mail provider gives you.' },
];

/** The e-mail account the system sends from: pick the provider, paste its SMTP key, press save. Stored in the application - no files, no restart. */
function MailSettingsModal({ open, onClose }) {
  const [info, setInfo] = useState(null);
  const [provider, setProvider] = useState('gmail');
  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const p = MAIL_PROVIDERS.find((x) => x.key === provider);

  const pickProvider = (key) => {
    const next = MAIL_PROVIDERS.find((x) => x.key === key);
    setProvider(key); setHost(next.host); setPort(next.port);
    if (next.loginFixed) setUsername(next.loginFixed);
  };

  useEffect(() => {
    if (!open) return;
    setResult(null); setPassword('');
    getMailSettings().then((i) => {
      setInfo(i);
      if (i.host) {
        const known = MAIL_PROVIDERS.find((x) => x.key !== 'other' && x.host === i.host);
        setProvider(known ? known.key : (i.host.endsWith('amazonaws.com') ? 'ses' : 'other'));
        setHost(i.host); setPort(i.port || 587); setUsername(i.username || ''); setFromAddress(i.fromAddress || ''); setTestTo(i.fromAddress || '');
      }
    }).catch((e) => setResult({ ok: false, text: extractErrorMessage(e) }));
  }, [open]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const sender = (provider === 'gmail' && !fromAddress.trim()) ? username.trim() : fromAddress.trim();
      const i = await saveMailSettings({ username: username.trim(), password, host: host.trim(), port: Number(port), fromAddress: sender });
      setInfo(i); setPassword('');
      const to = (testTo || sender).trim();
      const t = await sendTestEmail(to);
      setResult({ ok: t.sent, text: t.sent ? `Saved. A test e-mail was sent to ${to} - check the inbox (and Spam).` : `Saved, but the test e-mail failed: ${t.message}` });
    } catch (err) { setResult({ ok: false, text: extractErrorMessage(err) }); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} title="E-mail settings" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-ink-600">The system sends new-user passwords and reset links from this account.
          {info && info.source !== 'none' && <span className="ml-1 font-medium text-emerald-700">Currently set up{info.source === 'file' ? ' (from the server settings)' : ''}.</span>}
          {info && info.source === 'none' && <span className="ml-1 font-medium text-amber-700">Not set up yet.</span>}</p>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">E-mail provider</span>
          <select className="input" value={provider} onChange={(e) => pickProvider(e.target.value)}>
            {MAIL_PROVIDERS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
        </label>
        <p className="rounded-lg bg-cream-100 px-3 py-2 text-xs text-ink-600">{p.help}</p>
        {(provider === 'ses' || provider === 'other') && (
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-ink-500">Server</span>
              <input required className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Port</span>
              <input required type="number" className="input" value={port} onChange={(e) => setPort(e.target.value)} /></label>
          </div>
        )}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{p.login}</span>
          <input required className="input" readOnly={!!p.loginFixed} value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{p.secret}</span>
          <PasswordInput autoComplete="new-password" className="input" placeholder={info?.hasPassword ? 'saved - leave empty to keep it' : ''} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Send from (the address people see, for example no-reply@yourcompany.com)</span>
          <input required={provider !== 'gmail'} type="email" className="input" placeholder={provider === 'gmail' ? 'same as the Gmail address' : 'no-reply@yourcompany.com'} value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Send the test e-mail to</span>
          <input type="email" className="input" placeholder="your own e-mail address" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></label>
        {result && <div className={`rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{result.text}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save and send test'}</button>
        </div>
      </form>
    </Modal>
  );
}
