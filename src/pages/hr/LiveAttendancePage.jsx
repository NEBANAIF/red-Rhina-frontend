import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getMyLiveStatus, liveAction, getLiveBoard } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Badge from '../../components/Badge.jsx';
import { minutes, time, label } from './hrCommon.jsx';

const REFRESH_MS = 15000;

const STATE_TONE = { NOT_STARTED: 'neutral', WORKING: 'success', ON_BREAK: 'warning', FINISHED: 'info', ABSENT: 'danger', ON_LEAVE: 'info' };

/** A clock time in the company's time zone (the zone the server counts the working day in). */
function clock(iso, zone) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(iso));
}

/**
 * Minutes of an open session grow while the page is open: the server sends its figures at `serverTime`, and the screen adds the time
 * that has passed since they arrived. Finished days show the final figures.
 */
function liveFigures(s, receivedAt, now) {
  const open = s.state === 'WORKING' || s.state === 'ON_BREAK';
  const extra = open ? Math.max(0, (now - receivedAt) / 60000) : 0;
  const elapsed = s.elapsedMinutes + extra;
  const breaks = s.breakMinutes + (s.state === 'ON_BREAK' ? extra : 0);
  const worked = open ? Math.max(0, elapsed - breaks) : s.workedMinutes;
  const overtime = open ? Math.max(0, worked - s.expectedMinutes) : s.overtimeMinutes;
  return { worked: Math.floor(worked), breaks: Math.floor(breaks), overtime: Math.floor(overtime), expected: s.expectedMinutes };
}

/** Real-time attendance: check in / take a break / check out with the server clock, and (for HR) a live board of everyone. */
export default function LiveAttendancePage() {
  const { hasPermission } = useAuth();
  const canBoard = hasPermission('HR_VIEW');
  return (
    <div>
      <h1 className="page-title">Live Attendance</h1>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Times come from the server clock, so they cannot be typed in. Worked time = time at work − breaks (at least the shift's standard break);
        overtime = worked time beyond the shift; late = minutes after the shift start once the grace period has passed.
      </p>
      <MyDay />
      {canBoard && <Board canAct={hasPermission('ATTENDANCE_MANAGE')} />}
    </div>
  );
}

function MyDay() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const receivedAt = useRef(Date.now());

  const apply = (d) => { receivedAt.current = Date.now(); setNow(Date.now()); setS(d); };
  const load = useCallback(() => getMyLiveStatus().then((d) => { setError(''); apply(d); }).catch((e) => setError(extractErrorMessage(e))), []);
  useEffect(() => { load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const act = async (action) => {
    setBusy(true);
    setError('');
    try { apply(await liveAction(action)); } catch (e) { setError(extractErrorMessage(e)); } finally { setBusy(false); }
  };

  if (!s && !error) return <LoadingState />;
  if (!s) return <ErrorState message={error} onRetry={load} />;
  const f = liveFigures(s, receivedAt.current, now);
  const zone = s.timeZone;
  const clockNow = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: zone })
    .format(new Date(new Date(s.serverTime).getTime() + (now - receivedAt.current)));
  return (
    <div className="card card-pad mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">{s.employeeName} · {s.employeeNumber}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">{clockNow}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            <Badge tone={STATE_TONE[s.state]}>{label(s.state)}</Badge>
            <span>{s.workDate} · {zone}</span>
            {s.shiftName && <span>· Shift {s.shiftName} {time(s.shiftStart)}–{time(s.shiftEnd)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.state === 'NOT_STARTED' && <button className="btn btn-primary" disabled={busy} onClick={() => act('check-in')}>Check in</button>}
          {s.state === 'WORKING' && <button className="btn btn-secondary" disabled={busy} onClick={() => act('break/start')}>Start break</button>}
          {s.state === 'ON_BREAK' && <button className="btn btn-primary" disabled={busy} onClick={() => act('break/end')}>End break</button>}
          {(s.state === 'WORKING' || s.state === 'ON_BREAK') && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => window.confirm('Check out now?') && act('check-out')}>Check out</button>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {s.state === 'ABSENT' && <p className="mt-3 text-sm text-ink-500">You are marked absent today. Ask your manager to correct the attendance sheet.</p>}
      {s.state === 'ON_LEAVE' && <p className="mt-3 text-sm text-ink-500">You are on approved leave today.</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Checked in" value={clock(s.checkInAt, zone)} />
        <KpiCard label={s.state === 'FINISHED' ? 'Worked' : 'Worked so far'} value={minutes(f.worked)} />
        <KpiCard label="Breaks" value={minutes(f.breaks)} />
        <KpiCard label="Late" value={s.lateMinutes > 0 ? minutes(s.lateMinutes) : 'On time'} />
        <KpiCard label="Overtime" value={minutes(f.overtime)} />
      </div>
      {s.checkOutAt && <p className="mt-3 text-xs text-ink-500">Checked out at {clock(s.checkOutAt, zone)}. Expected working time: {minutes(s.expectedMinutes)}.</p>}
    </div>
  );
}

function Board({ canAct }) {
  const { scopeParams } = useBranchScope();
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [now, setNow] = useState(Date.now());
  const receivedAt = useRef(Date.now());

  const load = useCallback(() => getLiveBoard({ search: search || undefined, ...scopeParams })
    .then((d) => { receivedAt.current = Date.now(); setNow(Date.now()); setError(''); setData(d); })
    .catch((e) => setError(extractErrorMessage(e))), [search, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const act = async (employeeId, action) => {
    setBusyId(employeeId);
    setError('');
    try { await liveAction(action, employeeId); await load(); } catch (e) { setError(extractErrorMessage(e)); } finally { setBusyId(''); }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink-900">Live board</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400">Refreshes every {REFRESH_MS / 1000}s</span>
          <input className="input w-56" placeholder="Search name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {!data && !error && <LoadingState />}
      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard label="Working" value={data.working} />
            <KpiCard label="On break" value={data.onBreak} />
            <KpiCard label="Finished" value={data.finished} />
            <KpiCard label="Late" value={data.late} />
            <KpiCard label="Not in yet" value={data.notStarted} />
            <KpiCard label="Absent" value={data.absent} />
            <KpiCard label="On leave" value={data.onLeave} />
            <KpiCard label="Overtime" value={minutes(data.overtimeMinutes)} />
          </div>
          <div className="card card-pad overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-1 pr-3">Employee</th><th className="py-1 pr-3">Location</th><th className="py-1 pr-3">Shift</th><th className="py-1 pr-3">State</th>
                  <th className="py-1 pr-3">In</th><th className="py-1 pr-3">Out</th><th className="py-1 pr-3 text-right">Worked</th><th className="py-1 pr-3 text-right">Breaks</th>
                  <th className="py-1 pr-3 text-right">Late</th><th className="py-1 pr-3 text-right">Overtime</th>{canAct && <th />}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={11} className="py-6 text-center text-ink-400">Nobody is scheduled to work here today.</td></tr>}
                {data.rows.map((r) => {
                  const f = liveFigures(r, receivedAt.current, now);
                  return (
                    <tr key={r.employeeId} className="border-t border-cream-200">
                      <td className="py-1.5 pr-3"><span className="font-medium text-ink-900">{r.employeeName}</span> <span className="text-xs text-ink-400">{r.employeeNumber}</span></td>
                      <td className="py-1.5 pr-3">{r.branchName}</td>
                      <td className="py-1.5 pr-3">{r.shiftName ? `${r.shiftName} ${time(r.shiftStart)}–${time(r.shiftEnd)}` : '—'}</td>
                      <td className="py-1.5 pr-3"><Badge tone={STATE_TONE[r.state]}>{label(r.state)}</Badge></td>
                      <td className="py-1.5 pr-3">{clock(r.checkInAt, data.timeZone)}</td>
                      <td className="py-1.5 pr-3">{clock(r.checkOutAt, data.timeZone)}</td>
                      <td className="py-1.5 pr-3 text-right">{r.state === 'NOT_STARTED' ? '—' : minutes(f.worked)}</td>
                      <td className="py-1.5 pr-3 text-right">{r.state === 'NOT_STARTED' ? '—' : minutes(f.breaks)}</td>
                      <td className={`py-1.5 pr-3 text-right ${r.lateMinutes > 0 ? 'font-medium text-amber-700' : ''}`}>{r.lateMinutes > 0 ? minutes(r.lateMinutes) : '—'}</td>
                      <td className="py-1.5 pr-3 text-right">{f.overtime > 0 ? minutes(f.overtime) : '—'}</td>
                      {canAct && (
                        <td className="py-1.5 text-right whitespace-nowrap">
                          {r.state === 'NOT_STARTED' && <button className="btn btn-secondary btn-sm" disabled={busyId === r.employeeId} onClick={() => act(r.employeeId, 'check-in')}>Check in</button>}
                          {r.state === 'WORKING' && <button className="btn btn-secondary btn-sm mr-1" disabled={busyId === r.employeeId} onClick={() => act(r.employeeId, 'break/start')}>Break</button>}
                          {r.state === 'ON_BREAK' && <button className="btn btn-secondary btn-sm mr-1" disabled={busyId === r.employeeId} onClick={() => act(r.employeeId, 'break/end')}>End break</button>}
                          {(r.state === 'WORKING' || r.state === 'ON_BREAK') && <button className="btn btn-secondary btn-sm" disabled={busyId === r.employeeId} onClick={() => act(r.employeeId, 'check-out')}>Check out</button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
