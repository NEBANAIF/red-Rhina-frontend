import React, { useCallback, useEffect, useState } from 'react';
import { fetchDashboardSummary } from '../../api/dashboard.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Badge from '../../components/Badge.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Icon from '../../components/Icon.jsx';
import BranchBarChart from '../../components/charts/BranchBarChart.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import { formatMoney, formatDate, formatDateTime, todayIsoDate, toIsoDate } from '../../utils/format.js';

/**
 * Spec section 26: "KPIs should be compact, elegant and professional. Do
 * not make giant KPI cards." - the KPI strip below is a dense grid of
 * small stat blocks, not the oversized hero-card pattern.
 */
export default function DashboardPage() {
  const { scopeParams } = useBranchScope();
  const { hasPermission } = useAuth();
  const [from, setFrom] = useState(todayIsoDate());
  const [to, setTo] = useState(todayIsoDate());
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setState('loading');
    fetchDashboardSummary({ ...scopeParams, from, to })
      .then((data) => {
        setSummary(data);
        setState('ready');
      })
      .catch((err) => {
        setError(extractErrorMessage(err));
        setState('error');
      });
  }, [scopeParams.scope, scopeParams.branchId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading' && !summary) return <LoadingState label="Loading dashboard..." />;
  if (state === 'error') return <ErrorState message={error} onRetry={load} />;

  // Every figure has its own switch (set per role on the Roles & Permissions page). The server
  // already leaves out anything the role may not see; this hides the matching card as well.
  const kpis = [
    { label: 'Total Sales', value: summary.totalSalesCount, isCount: true, icon: 'sales', permission: 'DASHBOARD_REVENUE' },
    { label: 'Revenue', value: summary.revenue, icon: 'finance', permission: 'DASHBOARD_REVENUE' },
    { label: 'COGS', value: summary.cogs, icon: 'purchases', permission: 'VIEW_PROFIT' },
    { label: 'Gross Profit', value: summary.grossProfit, icon: 'trendUp', permission: 'VIEW_PROFIT' },
    { label: 'Expenses', value: summary.totalExpenses, icon: 'expenses', permission: 'DASHBOARD_EXPENSES' },
    { label: 'Net Profit', value: summary.netProfit, emphasize: true, icon: 'trendUp', permission: 'VIEW_PROFIT' },
    { label: 'Profit Margin', value: `${summary.profitMarginPercent}%`, isRaw: true, icon: 'reports', permission: 'VIEW_PROFIT' },
    { label: 'Inventory Value', value: summary.inventoryValue, icon: 'inventory', permission: 'VIEW_INVENTORY_VALUE' },
    { label: 'Low Stock', value: summary.lowStockCount, isCount: true, icon: 'warning', warn: summary.lowStockCount > 0, permission: 'DASHBOARD_LOW_STOCK' },
    { label: 'Out of Stock', value: summary.outOfStockCount, isCount: true, icon: 'error', warn: summary.outOfStockCount > 0, permission: 'DASHBOARD_LOW_STOCK' },
  ];
  const visibleKpis = kpis.filter((kpi) => hasPermission(kpi.permission));
  const showRecentSales = hasPermission('DASHBOARD_RECENT_SALES');
  const showRecentTransfers = hasPermission('DASHBOARD_RECENT_TRANSFERS');
  const showRecentExpenses = hasPermission('DASHBOARD_EXPENSES');
  const showLowStock = hasPermission('DASHBOARD_LOW_STOCK');
  const showBranchPerformance = hasPermission('DASHBOARD_BRANCH_PERFORMANCE') && summary.branchPerformance.length > 1;

  // Branch chart: only the series this role may see (same switches as the table columns).
  const branchSeries = [
    hasPermission('DASHBOARD_REVENUE') && { key: 'revenue', label: 'Revenue', color: '#4470e6' },
    hasPermission('VIEW_PROFIT') && { key: 'grossProfit', label: 'Gross Profit', color: '#94a3b8' },
    hasPermission('VIEW_PROFIT') && { key: 'netProfit', label: 'Net Profit', color: '#10b981' },
  ].filter(Boolean);
  const showBranchChart = showBranchPerformance && branchSeries.length > 0;
  const branchChartRows = showBranchChart
    ? summary.branchPerformance.map((row) => ({ ...row, id: row.branchId, label: row.branchName }))
    : [];
  const branchChartHasData = branchChartRows.some((row) => branchSeries.some((s) => Number(row[s.key] ?? 0) !== 0));

  // Stock status donut: same permission as the Low/Out-of-stock KPIs, which it is built from.
  const showStockStatus = showLowStock;
  const stockSegments = [
    { key: 'in', label: 'In stock', value: Number(summary.inStockCount ?? 0), color: '#10b981' },
    { key: 'low', label: 'Low stock', value: Number(summary.lowStockCount ?? 0), color: '#f59e0b' },
    { key: 'out', label: 'Out of stock', value: Number(summary.outOfStockCount ?? 0), color: '#ef4444' },
  ];
  const stockTotal = stockSegments.reduce((sum, seg) => sum + seg.value, 0);

  const nothingToShow = visibleKpis.length === 0 && !showRecentSales && !showRecentTransfers
    && !showRecentExpenses && !showLowStock && !showBranchPerformance;

  /* Presets just set the same two date fields the pickers use - no new API. */
  function applyPreset(days) {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - days);
    setFrom(toIsoDate(days === 0 ? today : start));
    setTo(toIsoDate(today));
  }
  const activePreset = (days) => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - days);
    return to === toIsoDate(today) && from === toIsoDate(days === 0 ? today : start);
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-cream-300 bg-cream-50 p-0.5 shadow-xs">
            {[
              { label: 'Today', days: 0 },
              { label: '7d', days: 7 },
              { label: '30d', days: 30 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${
                  activePreset(p.days) ? 'bg-cream-100 text-sage-700' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              max={to}
              aria-label="From date"
              onChange={(e) => setFrom(e.target.value)}
              className="input h-9 w-auto py-1.5"
            />
            <span className="text-sm text-ink-400">to</span>
            <input
              type="date"
              value={to}
              min={from}
              max={todayIsoDate()}
              aria-label="To date"
              onChange={(e) => setTo(e.target.value)}
              className="input h-9 w-auto py-1.5"
            />
          </div>

          <button type="button" onClick={load} className="btn-icon border border-cream-300 bg-cream-50" aria-label="Refresh" title="Refresh">
            <Icon name="refresh" size={16} className={state === 'loading' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {nothingToShow && (
        <div className="alert alert-info">
          <Icon name="info" size={16} className="mt-0.5" />
          <span>Your role does not include any dashboard figures. Ask an administrator if you need some.</span>
        </div>
      )}

      {/* Compact KPI strip */}
      {visibleKpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visibleKpis.map((kpi, idx) => (
            <KpiCard
              key={kpi.label}
              index={idx}
              label={kpi.label}
              icon={kpi.icon}
              warn={kpi.warn}
              emphasize={kpi.emphasize}
              value={kpi.isRaw ? kpi.value : kpi.isCount ? kpi.value : formatMoney(kpi.value)}
            />
          ))}
        </div>
      )}

      {(showBranchChart || showStockStatus) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {showBranchChart && (
            <Panel
              title="Branch Performance"
              icon="branches"
              hint="Selected period"
              className={showStockStatus ? 'xl:col-span-2' : 'xl:col-span-3'}
            >
              <div className="py-2">
                {branchChartHasData ? (
                  <BranchBarChart rows={branchChartRows} series={branchSeries} />
                ) : (
                  <EmptyState title="No branch activity" description="Nothing recorded for this period." icon="finance" compact />
                )}
              </div>
            </Panel>
          )}

          {showStockStatus && (
            <Panel
              title="Stock Status"
              icon="inventory"
              hint="Current snapshot"
              className={showBranchChart ? '' : 'xl:col-span-3'}
            >
              <div className="py-3">
                {stockTotal > 0 ? (
                  <DonutChart segments={stockSegments} centerLabel="product lines" />
                ) : (
                  <EmptyState title="No stock records" description="Stock levels appear here once products are received." icon="inventory" compact />
                )}
              </div>
            </Panel>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {showRecentSales && (
          <Panel title="Recent Sales" icon="sales" count={summary.recentSales.length}>
            {summary.recentSales.length === 0 ? (
              <EmptyState title="No recent sales" icon="sales" compact />
            ) : (
              <RowList
                rows={summary.recentSales}
                keyField="id"
                render={(sale) => (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{sale.saleNumber}</p>
                      <p className="truncate text-xs text-ink-400">
                        {sale.branchName} · {sale.customerName || 'Walk-in'} · {formatDateTime(sale.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular text-ink-900 num">{formatMoney(sale.totalAmount)}</span>
                      <Badge status={sale.paymentStatus} />
                    </div>
                  </>
                )}
              />
            )}
          </Panel>
        )}

        {showRecentTransfers && (
          <Panel title="Recent Transfers" icon="transfers" count={summary.recentTransfers.length}>
            {summary.recentTransfers.length === 0 ? (
              <EmptyState title="No recent transfers" icon="transfers" compact />
            ) : (
              <RowList
                rows={summary.recentTransfers}
                keyField="id"
                render={(t) => (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{t.transferNumber}</p>
                      <p className="truncate text-xs text-ink-400">
                        {t.sourceBranchName} → {t.destinationBranchName} · {formatDateTime(t.requestedAt)}
                      </p>
                    </div>
                    <Badge status={t.status} />
                  </>
                )}
              />
            )}
          </Panel>
        )}

        {showRecentExpenses && (
          <Panel title="Recent Expenses" icon="expenses" count={summary.recentExpenses.length}>
            {summary.recentExpenses.length === 0 ? (
              <EmptyState title="No recent expenses" icon="expenses" compact />
            ) : (
              <RowList
                rows={summary.recentExpenses}
                keyField="id"
                render={(e) => (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{e.description}</p>
                      <p className="truncate text-xs text-ink-400">
                        {e.branchName} · {e.category} · {formatDate(e.expenseDate)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular text-ink-900 num">{formatMoney(e.amount)}</span>
                  </>
                )}
              />
            )}
          </Panel>
        )}

        {showLowStock && (
          <Panel title="Low Stock Alerts" icon="warning" count={summary.lowStockAlerts.length} tone={summary.lowStockAlerts.length ? 'warn' : undefined}>
            {summary.lowStockAlerts.length === 0 ? (
              <EmptyState title="Nothing running low" description="Every product is above its reorder level." icon="check" compact />
            ) : (
              <RowList
                rows={summary.lowStockAlerts}
                keyField={(row) => `${row.productId}-${row.branchId}`}
                render={(alert) => (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{alert.productName}</p>
                      <p className="truncate text-xs text-ink-400">
                        {alert.branchName} · reorder at {alert.reorderLevel}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular ${
                        alert.availableQuantity <= 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {alert.availableQuantity} left
                    </span>
                  </>
                )}
              />
            )}
          </Panel>
        )}
      </div>

      {showBranchPerformance && (
        <Panel title="Branch Breakdown" icon="branches">
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="th border-b border-cream-300 bg-cream-50">Branch</th>
                  {hasPermission('DASHBOARD_REVENUE') && <th className="th border-b border-cream-300 bg-cream-50 text-right">Revenue</th>}
                  {hasPermission('VIEW_PROFIT') && <th className="th border-b border-cream-300 bg-cream-50 text-right">Gross Profit</th>}
                  {hasPermission('VIEW_PROFIT') && <th className="th border-b border-cream-300 bg-cream-50 text-right">Net Profit</th>}
                  {hasPermission('VIEW_PROFIT') && <th className="th border-b border-cream-300 bg-cream-50 text-right">Margin</th>}
                </tr>
              </thead>
              <tbody>
                {summary.branchPerformance.map((row) => (
                  <tr key={row.branchId} className="group transition-colors hover:bg-cream-50/70">
                    <td className="td border-b border-cream-200 font-medium text-ink-900 group-last:border-0">{row.branchName}</td>
                    {hasPermission('DASHBOARD_REVENUE') && <td className="td border-b border-cream-200 text-right group-last:border-0">{formatMoney(row.revenue)}</td>}
                    {hasPermission('VIEW_PROFIT') && <td className="td border-b border-cream-200 text-right group-last:border-0">{formatMoney(row.grossProfit)}</td>}
                    {hasPermission('VIEW_PROFIT') && (
                      <td className={`td border-b border-cream-200 text-right font-medium group-last:border-0 ${Number(row.netProfit) < 0 ? 'text-red-600' : 'text-ink-900'}`}>
                        {formatMoney(row.netProfit)}
                      </td>
                    )}
                    {hasPermission('VIEW_PROFIT') && <td className="td border-b border-cream-200 text-right group-last:border-0">{row.profitMarginPercent}%</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, icon, count, tone, hint, className = '', children }) {
  return (
    <section className={`card flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          {icon && (
            <span className={`rounded-md p-1 ${tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-cream-50 text-ink-400'}`}>
              <Icon name={icon} size={14} />
            </span>
          )}
          <h2 className="card-title">{title}</h2>
        </div>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
        {count > 0 && (
          <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[11px] font-medium tabular text-ink-600 num">{count}</span>
        )}
      </div>
      <div className="px-4 py-2 sm:px-5">{children}</div>
    </section>
  );
}

function RowList({ rows, keyField, render }) {
  return (
    <ul className="divide-y divide-cream-200">
      {rows.map((row) => (
        <li
          key={typeof keyField === 'function' ? keyField(row) : row[keyField]}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          {render(row)}
        </li>
      ))}
    </ul>
  );
}
