import React, { useEffect, useMemo, useState } from 'react';
import {
  listMeetings, getMeeting, saveMeeting, startMeeting, completeMeeting, cancelMeeting, respondToMeeting, recordMeetingAttendance,
  addMeetingAction, deleteMeetingAction, setMeetingActionStatus, listMyActions, listPeople,
} from '../../api/meetings.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import { Field, label } from './hrCommon.jsx';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const MEETING_TONE = { SCHEDULED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'muted' };
const ACTION_TONE = { OPEN: 'neutral', IN_PROGRESS: 'warning', DONE: 'success' };

/**
 * Meetings: a meeting needs an agenda, has participants, and produces a checklist of action items - each with the person responsible,
 * a due date and a completion status. Managers schedule and see everything; everyone else sees the meetings they organise or are invited to.
 */
export default function MeetingsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MEETING_MANAGE');
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const [rows, setRows] = useState(null);
  const [myActions, setMyActions] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setError('');
    listMeetings({ status: status || undefined, mine: mine || undefined }).then(setRows).catch((e) => setError(extractErrorMessage(e)));
    listMyActions().then(setMyActions).catch(() => {});
  };
  useEffect(load, [status, mine]);

  const columns = [
    { key: 'title', header: 'Meeting', render: (r) => <span className="font-medium text-ink-900">{r.title}</span> },
    { key: 'startAt', header: 'When', render: (r) => fmt(r.startAt) },
    { key: 'organizerName', header: 'Organiser' },
    { key: 'participants', header: 'People', render: (r) => r.participants.length, className: 'text-right' },
    { key: 'agenda', header: 'Agenda', render: (r) => `${r.agenda.length} topic${r.agenda.length === 1 ? '' : 's'}`, className: 'text-right' },
    { key: 'progress', header: 'Checklist', render: (r) => (r.totalActions === 0 ? '—' : `${r.doneActions}/${r.totalActions} done (${r.percentDone}%)`), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={MEETING_TONE[r.status]}>{label(r.status)}</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Meetings</h1>
        {canManage && <button className="btn btn-primary btn-sm" onClick={() => setForm({})}>+ Schedule meeting</button>}
      </div>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      {myActions.length > 0 && (
        <div className="card card-pad mb-4">
          <h2 className="mb-2 text-base font-semibold text-ink-900">My open action items</h2>
          <ul className="divide-y divide-cream-200 text-sm">
            {myActions.map((a) => (
              <li key={a.actionId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <button type="button" className="text-left" onClick={() => setOpenId(a.meetingId)}>
                  <span className="font-medium text-ink-900">{a.title}</span>
                  <span className="ml-2 text-xs text-ink-500">{a.meetingTitle}</span>
                </button>
                <span className={`text-xs ${a.overdue ? 'font-medium text-red-600' : 'text-ink-500'}`}>{a.dueDate ? `due ${a.dueDate}${a.overdue ? ' – overdue' : ''}` : 'no due date'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field text="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </Field>
          {canManage && <label className="mb-2 flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine</label>}
        </div>
        {!rows && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={load} />}
        {rows && <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpenId(r.id)} emptyMessage="No meetings." />}
      </div>

      {form && <MeetingForm meeting={form.meeting} onClose={() => setForm(null)}
        onSaved={(m, created) => { setForm(null); setNotice(created ? `Meeting "${m.title}" scheduled.` : 'Meeting saved.'); load(); setOpenId(m.id); }} />}
      {openId && <MeetingDetail id={openId} onClose={() => setOpenId(null)} onEdit={(m) => { setOpenId(null); setForm({ meeting: m }); }} onChanged={load} />}
    </div>
  );
}

function PersonPicker({ people, selected, onToggle }) {
  const [q, setQ] = useState('');
  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.employeeNumber.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input className="input mb-1" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-40 overflow-auto rounded-lg border border-cream-300 p-1">
        {shown.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-cream-100">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => onToggle(p.id)} />
            <span className="text-ink-900">{p.name}</span><span className="text-xs text-ink-400">{p.jobTitle ?? ''} · {p.branchName}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-2 py-1 text-xs text-ink-400">Nobody found.</p>}
      </div>
    </div>
  );
}

function MeetingForm({ meeting, onClose, onSaved }) {
  const editing = !!meeting;
  const [people, setPeople] = useState([]);
  const [f, setF] = useState(() => {
    const start = meeting?.startAt ?? new Date(Date.now() + 3600e3).toISOString();
    const end = meeting?.endAt ?? new Date(Date.now() + 2 * 3600e3).toISOString();
    return {
      title: meeting?.title ?? '', location: meeting?.location ?? '', startAt: toLocalInput(start), endAt: toLocalInput(end),
      organizerId: meeting?.organizerId ?? '',
      agenda: meeting ? meeting.agenda.map((a) => ({ topic: a.topic, durationMinutes: a.durationMinutes ?? '', presenterId: a.presenterId ?? '' })) : [{ topic: '', durationMinutes: '', presenterId: '' }],
      participants: new Set(meeting ? meeting.participants.map((p) => p.employeeId) : []),
      actions: [],
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { listPeople().then(setPeople).catch((e) => setError(extractErrorMessage(e))); }, []);

  const set = (p) => setF((v) => ({ ...v, ...p }));
  const setAgenda = (i, patch) => set({ agenda: f.agenda.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const setAction = (i, patch) => set({ actions: f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const toggle = (id) => { const n = new Set(f.participants); if (n.has(id)) n.delete(id); else n.add(id); set({ participants: n }); };
  const invited = useMemo(() => people.filter((p) => f.participants.has(p.id) || p.id === f.organizerId), [people, f.participants, f.organizerId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const agenda = f.agenda.filter((a) => a.topic.trim());
    if (agenda.length === 0) { setError('A meeting needs an agenda - add at least one topic.'); return; }
    if (f.participants.size === 0) { setError('Choose at least one participant.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: f.title.trim(), location: f.location.trim() || undefined,
        startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), organizerId: f.organizerId || undefined,
        agenda: agenda.map((a) => ({ topic: a.topic.trim(), durationMinutes: a.durationMinutes ? Number(a.durationMinutes) : undefined, presenterId: a.presenterId || undefined })),
        participants: [...f.participants].map((employeeId) => ({ employeeId, required: true })),
        actions: editing ? undefined : f.actions.filter((a) => a.title.trim() && a.assigneeId)
          .map((a) => ({ title: a.title.trim(), assigneeId: a.assigneeId, dueDate: a.dueDate || undefined })),
      };
      onSaved(await saveMeeting(meeting?.id, payload), !editing);
    } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal open title={editing ? 'Edit meeting' : 'Schedule meeting'} onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field text="Title"><input required maxLength={200} className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field text="Location / link"><input maxLength={200} className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} /></Field>
          <Field text="Starts"><input required type="datetime-local" className="input" value={f.startAt} onChange={(e) => set({ startAt: e.target.value })} /></Field>
          <Field text="Ends"><input required type="datetime-local" className="input" min={f.startAt} value={f.endAt} onChange={(e) => set({ endAt: e.target.value })} /></Field>
          <Field text="Organiser (default: you)">
            <select className="input" value={f.organizerId} onChange={(e) => set({ organizerId: e.target.value })}>
              <option value="">Me</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-ink-800">Agenda <span className="text-red-600">*</span> <span className="text-xs font-normal text-ink-500">(required – at least one topic)</span></p>
          {f.agenda.map((a, i) => (
            <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
              <span className="w-5 text-xs text-ink-400">{i + 1}.</span>
              <input className="input min-w-[12rem] flex-1" maxLength={300} placeholder="Topic" value={a.topic} onChange={(e) => setAgenda(i, { topic: e.target.value })} />
              <input type="number" min="1" className="input w-24" placeholder="Minutes" value={a.durationMinutes} onChange={(e) => setAgenda(i, { durationMinutes: e.target.value })} />
              <select className="input w-44" value={a.presenterId} onChange={(e) => setAgenda(i, { presenterId: e.target.value })}>
                <option value="">Presenter…</option>
                {invited.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {f.agenda.length > 1 && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => set({ agenda: f.agenda.filter((_, j) => j !== i) })}>Remove</button>}
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ agenda: [...f.agenda, { topic: '', durationMinutes: '', presenterId: '' }] })}>+ Add topic</button>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-ink-800">Participants <span className="text-red-600">*</span> <span className="text-xs font-normal text-ink-500">({f.participants.size} chosen; the organiser is always included)</span></p>
          <PersonPicker people={people} selected={f.participants} onToggle={toggle} />
        </div>

        {!editing && (
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-800">Action items (checklist) <span className="text-xs font-normal text-ink-500">– you can also add them during the meeting</span></p>
            {f.actions.map((a, i) => (
              <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
                <input className="input min-w-[12rem] flex-1" maxLength={300} placeholder="What has to be done" value={a.title} onChange={(e) => setAction(i, { title: e.target.value })} />
                <select className="input w-44" value={a.assigneeId} onChange={(e) => setAction(i, { assigneeId: e.target.value })}>
                  <option value="">Responsible…</option>
                  {invited.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="date" className="input w-40" value={a.dueDate} onChange={(e) => setAction(i, { dueDate: e.target.value })} />
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => set({ actions: f.actions.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ actions: [...f.actions, { title: '', assigneeId: '', dueDate: '' }] })}>+ Add action item</button>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : editing ? 'Save changes' : 'Schedule'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MeetingDetail({ id, onClose, onEdit, onChanged }) {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newAction, setNewAction] = useState({ title: '', assigneeId: '', dueDate: '' });

  const load = () => getMeeting(id).then(setM).catch((e) => setError(extractErrorMessage(e)));
  useEffect(() => { load(); }, [id]);

  const act = async (fn) => {
    setBusy(true);
    setError('');
    try { setM(await fn()); onChanged(); return true; } catch (e) { setError(extractErrorMessage(e)); return false; } finally { setBusy(false); }
  };

  const complete = () => {
    const minutes = window.prompt('Minutes / outcome of the meeting (optional):', m.minutes ?? '');
    if (minutes === null) return;
    act(() => completeMeeting(id, minutes));
  };
  const cancel = () => {
    const reason = window.prompt('Why is the meeting cancelled?');
    if (reason === null) return;
    if (!reason.trim()) { setError('Say why the meeting is cancelled.'); return; }
    act(() => cancelMeeting(id, reason.trim()));
  };
  const addAction = async (e) => {
    e.preventDefault();
    if (await act(() => addMeetingAction(id, { title: newAction.title.trim(), assigneeId: newAction.assigneeId, dueDate: newAction.dueDate || undefined }))) {
      setNewAction({ title: '', assigneeId: '', dueDate: '' });
    }
  };

  const live = m && (m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS');
  return (
    <Modal open title={m ? m.title : 'Meeting'} onClose={onClose} size="xl">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {!m && !error && <LoadingState />}
      {m && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={MEETING_TONE[m.status]}>{label(m.status)}</Badge>
            <span className="text-xs text-ink-500">{fmt(m.startAt)} – {fmt(m.endAt)}{m.location ? ` · ${m.location}` : ''} · organised by {m.organizerName}</span>
          </div>
          {m.cancelReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Cancelled: {m.cancelReason}</p>}

          {m.status === 'SCHEDULED' && m.myResponse && m.myResponse !== 'ATTENDED' && (
            <div className="flex items-center gap-2 rounded-lg bg-cream-50 px-3 py-2 text-xs">
              Your answer: <strong>{label(m.myResponse)}</strong>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => respondToMeeting(id, 'ACCEPTED'))}>Accept</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => respondToMeeting(id, 'DECLINED'))}>Decline</button>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Agenda</h3>
            <ol className="list-decimal space-y-0.5 pl-5">
              {m.agenda.map((a) => (
                <li key={a.id}><span className="text-ink-900">{a.topic}</span>
                  <span className="ml-2 text-xs text-ink-500">{a.durationMinutes ? `${a.durationMinutes} min` : ''}{a.presenterName ? ` · ${a.presenterName}` : ''}</span></li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Participants ({m.participants.length})</h3>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {m.participants.map((p) => (
                <li key={p.employeeId} className="flex items-center justify-between gap-2 rounded border border-cream-200 px-2 py-1">
                  <span className="truncate"><span className="text-ink-900">{p.name}</span> <span className="text-xs text-ink-400">{p.jobTitle ?? ''}</span></span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Badge tone={p.response === 'ATTENDED' || p.response === 'ACCEPTED' ? 'success' : p.response === 'DECLINED' || p.response === 'ABSENT' ? 'danger' : 'neutral'}>{label(p.response)}</Badge>
                    {m.canEdit && (m.status === 'IN_PROGRESS' || m.status === 'COMPLETED') && (
                      <>
                        <button type="button" className="text-xs text-sage-600 hover:underline" disabled={busy} onClick={() => act(() => recordMeetingAttendance(id, p.employeeId, 'ATTENDED'))}>Present</button>
                        <button type="button" className="text-xs text-red-600 hover:underline" disabled={busy} onClick={() => act(() => recordMeetingAttendance(id, p.employeeId, 'ABSENT'))}>Absent</button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Checklist – action items</h3>
              <span className="text-xs text-ink-500">{m.doneActions}/{m.totalActions} done ({m.percentDone}%)</span>
            </div>
            {m.totalActions > 0 && <div className="mb-2 h-1.5 overflow-hidden rounded bg-cream-200"><div className="h-full bg-sage-500" style={{ width: `${m.percentDone}%` }} /></div>}
            {m.actions.length === 0 && <p className="text-xs text-ink-500">No action items yet.</p>}
            <ul className="space-y-1.5">
              {m.actions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-cream-200 px-2 py-1.5">
                  <div className="min-w-0">
                    <span className={`font-medium ${a.status === 'DONE' ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{a.title}</span>
                    <span className="block text-xs text-ink-500">
                      Responsible: {a.assigneeName}{a.dueDate ? ` · due ${a.dueDate}` : ''}{a.overdue ? ' · OVERDUE' : ''}
                      {a.completedAt ? ` · done ${fmt(a.completedAt)}${a.completedByName ? ` by ${a.completedByName}` : ''}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="input w-32 py-1 text-xs" value={a.status} disabled={busy || m.status === 'CANCELLED'}
                      onChange={(e) => act(() => setMeetingActionStatus(id, a.id, e.target.value))}>
                      {['OPEN', 'IN_PROGRESS', 'DONE'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                    {m.canEdit && a.status !== 'DONE' && m.status !== 'CANCELLED' && (
                      <button type="button" className="text-xs text-red-600 hover:underline" disabled={busy} onClick={() => window.confirm('Remove this action item?') && act(() => deleteMeetingAction(id, a.id))}>Remove</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {m.canEdit && m.status !== 'CANCELLED' && (
              <form onSubmit={addAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input required className="input min-w-[12rem] flex-1" maxLength={300} placeholder="New action item" value={newAction.title} onChange={(e) => setNewAction({ ...newAction, title: e.target.value })} />
                <select required className="input w-44" value={newAction.assigneeId} onChange={(e) => setNewAction({ ...newAction, assigneeId: e.target.value })}>
                  <option value="">Responsible…</option>
                  {m.participants.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.name}</option>)}
                </select>
                <input type="date" className="input w-40" value={newAction.dueDate} onChange={(e) => setNewAction({ ...newAction, dueDate: e.target.value })} />
                <button type="submit" disabled={busy} className="btn btn-secondary btn-sm">Add</button>
              </form>
            )}
          </div>

          {m.minutes && <div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Minutes</h3><p className="whitespace-pre-wrap text-ink-700">{m.minutes}</p></div>}

          {m.canEdit && live && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={cancel}>Cancel meeting</button>
              {m.status === 'SCHEDULED' && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onEdit(m)}>Edit</button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => startMeeting(id))}>Start meeting</button>
                </>
              )}
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={complete}>Complete meeting</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
