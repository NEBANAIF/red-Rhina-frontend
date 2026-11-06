import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHrOverview } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import RankedBars from '../../components/charts/RankedBars.jsx';
import { typeLabel } from './hrCommon.jsx';

const fmt = (n) => Number(n ?? 0).toLocaleString();

/** HR dashboard: headcount, today's attendance and pending leave for the locations picked in the branch selector. */
export default function HrDashboardPage() {
  const { scopeParams } = useBranchScope();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = () => {
    setState('loading');
    getHrOverview(scopeParams).then((d) => { setData(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [scopeParams.scope, scopeParams.branchId]);

  if (state === 'error') return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  return (
    <div>
      <h1 className="page-title mb-4">Human Resources</h1>
      <p className="-mt-2 mb-4 text-sm text-ink-500">Employees, attendance and leave for the locations picked in the selector at the top. Attendance figures are for today.</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard index={0} label="Employees" value={fmt(data.headcount)} emphasize hint={`${fmt(data.newHires30Days)} hired in the last 30 days`} />
        <KpiCard index={1} label="Present today" value={fmt(data.presentToday)} hint={`${fmt(data.lateToday)} late`} />
        <KpiCard index={2} label="Absent / on leave" value={`${fmt(data.absentToday)} / ${fmt(data.onLeaveToday)}`} warn={data.absentToday > 0} />
        <KpiCard index={3} label="Not recorded yet" value={fmt(data.notRecordedToday)} warn={data.notRecordedToday > 0} hint="no attendance for today" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h2 className="mb-3 text-base font-semibold text-ink-900">Employees by role</h2>
          {data.byType.length === 0 ? <p className="text-sm text-ink-500">No employees yet.</p> : (
            <RankedBars color="#5e7852" rows={data.byType.map((c) => ({ id: c.label, title: typeLabel(c.label), value: c.value, valueLabel: fmt(c.value) }))} />
          )}
        </div>
        <div className="card card-pad">
          <h2 className="mb-3 text-base font-semibold text-ink-900">Employees by location</h2>
          {data.byLocation.length === 0 ? <p className="text-sm text-ink-500">No employees yet.</p> : (
            <RankedBars color="#c9a86a" rows={data.byLocation.map((c) => ({ id: c.label, title: c.label, value: c.value, valueLabel: fmt(c.value) }))} />
          )}
        </div>
      </div>

      <div className="card card-pad">
        <p className="text-sm text-ink-700">
          {data.pendingLeave > 0
            ? <>{fmt(data.pendingLeave)} leave request(s) are waiting for a decision. <Link to="/hr/leave" className="font-medium text-sage-600 hover:underline">Open leave</Link></>
            : 'No leave requests are waiting for a decision.'}
        </p>
      </div>
    </div>
  );
}
