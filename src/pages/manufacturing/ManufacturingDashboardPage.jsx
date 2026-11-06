import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getManufacturingDashboard } from '../../api/manufacturing.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import TrendChart from '../../components/charts/TrendChart.jsx';
import RankedBars from '../../components/charts/RankedBars.jsx';
import { formatMoney, formatCompact, toIsoDate } from '../../utils/format.js';
import { ExpiryAlertBanner } from './BatchesPanel.jsx';

const fmt = (n) => Number(n ?? 0).toLocaleString();
const PERIODS = [{ days: 7, label: 'Last 7 days' }, { days: 30, label: 'Last 30 days' }, { days: 90, label: 'Last 90 days' }];

function rangeFor(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function Panel({ title, action, children }) {
  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Manufacturing dashboard: production, raw material stock, shortages, waste, quality, machines, costs and performance. */
export default function ManufacturingDashboardPage() {
  const { scopeParams } = useBranchScope();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    getManufacturingDashboard({ ...scopeParams, ...rangeFor(days) })
      .then((d) => { setData(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  }, [scopeParams.scope, scopeParams.branchId, days]);
  useEffect(() => { load(); }, [load]);

  if (state === 'error') return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  const { production: p, materials: m, waste: w, quality: q, machines: mc, costs: c, performance: perf } = data;
  const attention = mc ? mc.maintenanceOverdue + mc.underMaintenance + mc.outOfService : 0;
  const showCosts = !!c && c.total !== null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Manufacturing Dashboard</h1>
        <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          {PERIODS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
        </select>
      </div>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Production, waste, costs and performance cover orders completed from {data.from} to {data.to}; raw material stock, machines and quality show the current position.
        Use the selector at the top to look at one factory or all factories.
      </p>

      {m && <ExpiryAlertBanner linkToMaterials />}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {p && <KpiCard index={0} label="In progress / planned" value={`${fmt(p.inProgress)} / ${fmt(p.planned)}`} hint="open production orders" />}
        {p && <KpiCard index={1} label="Completed orders" value={fmt(p.completed)} hint="in the period" />}
        {p && <KpiCard index={2} label="Units produced" value={fmt(p.producedUnits)} emphasize hint={`${fmt(p.acceptedUnits)} accepted`} />}
        {w && <KpiCard index={3} label="Waste (rejected)" value={`${w.wastePercent}%`} warn={Number(w.wastePercent) >= 5} hint={`${fmt(w.rejectedUnits)} units`} />}
        {q && <KpiCard index={4} label="Quality pass rate" value={`${q.passRate}%`} warn={q.inspections > 0 && Number(q.passRate) < 90} hint={`${fmt(q.inspections)} inspections`} />}
        {m && <KpiCard index={5} label="Raw material shortages" value={fmt(m.shortForProduction)} warn={m.shortForProduction > 0} hint={`${fmt(m.lowStock)} low · ${fmt(m.outOfStock)} out`} />}
        {mc && <KpiCard index={6} label="Machines needing attention" value={fmt(attention)} warn={attention > 0} hint={`of ${fmt(mc.total)} machines`} />}
        {c && <KpiCard index={7} label="Production cost" value={formatMoney(c.total)} emphasize hint={showCosts ? `avg ${formatMoney(c.averageUnitCost)} / unit` : ''} />}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {p && <div className="lg:col-span-2">
          <Panel title="Production per day">
            <TrendChart
              points={p.daily.map((d) => ({ date: d.date, produced: d.produced, rejected: d.rejected }))}
              series={[{ key: 'produced', label: 'Produced', color: '#5e7852', area: true }, { key: 'rejected', label: 'Rejected', color: '#e07070' }]}
              formatValue={fmt}
            />
          </Panel>
        </div>}
        {showCosts && <Panel title="Production cost breakdown">
          <DonutChart
            centerLabel="total cost"
            formatValue={formatCompact}
            segments={[
              { key: 'material', label: 'Raw materials', value: Number(c.material), color: '#5e7852' },
              { key: 'labor', label: 'Labour', value: Number(c.labor), color: '#c9a86a' },
              { key: 'overhead', label: 'Overhead', value: Number(c.overhead), color: '#7d8fb3' },
            ]}
          />
        </Panel>}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {m && <Panel title="Raw material shortages" action={<Link to="/manufacturing/materials" className="text-xs font-medium text-sage-600 hover:underline">Open</Link>}>
          {m.shortages.length === 0 ? (
            <p className="text-sm text-ink-500">No shortages: open production orders are covered by stock.{m.stockValue !== null ? ` Stock value ${formatMoney(m.stockValue)}.` : ''}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {m.shortages.map((s) => (
                <li key={s.name} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-ink-800">{s.name}</span>
                  <span className="shrink-0 font-medium text-red-600">short {fmt(s.shortfall)} {s.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>}

        {mc && <Panel title="Machines & maintenance" action={<Link to="/manufacturing/machines" className="text-xs font-medium text-sage-600 hover:underline">Open</Link>}>
          <DonutChart
            centerLabel="machines"
            segments={[
              { key: 'ok', label: 'Operational', value: mc.operational, color: '#5e7852' },
              { key: 'maint', label: 'Under maintenance', value: mc.underMaintenance, color: '#c9a86a' },
              { key: 'out', label: 'Out of service', value: mc.outOfService, color: '#e07070' },
            ]}
          />
          <p className="mt-2 text-xs text-ink-500">
            {fmt(mc.maintenanceOverdue)} overdue · {fmt(mc.dueWithin7Days)} due within 7 days · {mc.maintenanceCost !== null ? `maintenance ${formatMoney(mc.maintenanceCost)} · ` : ''}downtime {fmt(mc.downtimeHours)} h in the period
          </p>
          {mc.alerts.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink-700">
              {mc.alerts.map((a) => (
                <li key={`${a.name}-${a.branchName}`}>
                  <span className={a.overdue || a.status !== 'OPERATIONAL' ? 'font-medium text-red-600' : ''}>{a.name}</span> ({a.branchName})
                  {a.status !== 'OPERATIONAL' ? ` – ${a.status.replace('_', ' ').toLowerCase()}` : ''}
                  {a.nextDue ? ` – service ${a.overdue ? 'was due' : 'due'} ${a.nextDue}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Panel>}

        {perf && <Panel title="Performance">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-400">Completed on time</dt><dd className="text-lg font-semibold">{perf.onTimeRate}%</dd></div>
            <div><dt className="text-xs text-ink-400">Yield (accepted / produced)</dt><dd className="text-lg font-semibold">{perf.yieldRate}%</dd></div>
            <div><dt className="text-xs text-ink-400">Avg production time</dt><dd className="text-lg font-semibold">{perf.averageLeadDays} days</dd></div>
            <div><dt className="text-xs text-ink-400">Orders completed</dt><dd className="text-lg font-semibold">{perf.completionRate}%</dd></div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            {w && w.estimatedCost !== null ? `Waste cost absorbed by good units: ${formatMoney(w.estimatedCost)}. ` : ''}{q ? `Quality: ${fmt(q.passed)} passed, ${fmt(q.failed)} failed, average defect rate ${q.averageDefectRate}%.` : ''}
          </p>
        </Panel>}
      </div>

      {showCosts && <Panel title="Production cost by product" action={<Link to="/manufacturing/production" className="text-xs font-medium text-sage-600 hover:underline">Production orders</Link>}>
        {c.byProduct.length === 0 ? (
          <p className="text-sm text-ink-500">No completed production in this period.</p>
        ) : (
          <RankedBars
            color="#5e7852"
            rows={c.byProduct.map((x) => ({
              id: x.productName, title: x.productName, value: Number(x.totalCost),
              valueLabel: formatMoney(x.totalCost), detail: `${fmt(x.units)} units · ${formatMoney(x.unitCost)} each`,
            }))}
          />
        )}
      </Panel>}
    </div>
  );
}
