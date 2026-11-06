import React, { useCallback, useEffect, useState } from 'react';
import { getHierarchy } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';

function ChartBox({ p }) {
  return (
    <div className="min-w-[170px] max-w-[210px] rounded-xl border border-cream-300 bg-white px-3 py-2 text-center shadow-sm">
      <div className="text-sm font-semibold leading-tight text-ink-900">{p.name}</div>
      <div className="mt-0.5 text-[11px] text-ink-600">{p.positionTitle || p.jobTitle || 'No position'}</div>
      <div className="mt-0.5 text-[10px] text-ink-400">{[p.departmentName, p.branchName].filter(Boolean).join(' · ')}</div>
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        {p.level && <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-medium capitalize text-ink-700">{p.level.toLowerCase()}</span>}
        {!p.hasLogin && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">No login</span>}
      </div>
      {p.roleName && <div className="mt-1 inline-block rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-medium text-sage-700">{p.roleName}</div>}
    </div>
  );
}

/** One person with everyone who reports to them below (connector lines are plain borders). */
function ChartNode({ p }) {
  const reports = p.reports || [];
  return (
    <li className="relative flex flex-col items-center px-2 pt-4 before:absolute before:left-0 before:top-0 before:h-4 before:w-1/2 before:border-r before:border-t before:border-ink-300 after:absolute after:right-0 after:top-0 after:h-4 after:w-1/2 after:border-t after:border-ink-300 first:before:border-0 last:after:border-0 only:before:hidden only:after:hidden">
      <ChartBox p={p} />
      {reports.length > 0 && (
        <ul className="relative flex pt-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:border-l before:border-ink-300">
          {reports.map((r) => <ChartNode key={r.id} p={r} />)}
        </ul>
      )}
    </li>
  );
}

/**
 * Company Hierarchy: one visual organisation chart of the employees - managers above the people who report to them.
 * It is drawn from each employee's "Reporting to", so it follows every change automatically (it reloads when you come back to the
 * tab and every 30 seconds).
 */
export default function HierarchyPage() {
  const { scopeParams } = useBranchScope();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getHierarchy(scopeParams).then((d) => { setData(d); setError(''); }).catch((e) => setError(extractErrorMessage(e)));
  }, [scopeParams.scope, scopeParams.branchId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  return (
    <div>
      <h1 className="page-title">Company Hierarchy</h1>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Who reports to whom. Set it with "Reporting to" on each employee; the chart updates by itself.
      </p>
      {error && !data && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <LoadingState />}
      {data && (
        <div className="card card-pad overflow-x-auto">
          {data.reportingTree.length === 0
            ? <p className="text-sm text-ink-500">No employees yet.</p>
            : <ul className="mx-auto flex w-max min-w-full justify-center">{data.reportingTree.map((p) => <ChartNode key={p.id} p={p} />)}</ul>}
        </div>
      )}
    </div>
  );
}
