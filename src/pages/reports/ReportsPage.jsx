import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getBestSellingProducts, getSlowMovingProducts, getSalesTrend,
  getRevenueGrowth, getProfitGrowth, getBranchComparison, getStockStatusReport,
} from '../../api/reports.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import DataTable from '../../components/DataTable.jsx';
import Icon from '../../components/Icon.jsx';
import TrendChart from '../../components/charts/TrendChart.jsx';
import RankedBars from '../../components/charts/RankedBars.jsx';
import BranchBarChart from '../../components/charts/BranchBarChart.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import StockStatusBadge from '../../components/StockStatusBadge.jsx';
import { STOCK_STATUS } from '../../utils/stockStatus.js';
import {
  formatMoney, formatIsoDate, toLocalIsoDate, parseIsoDate, daysInRange,
} from '../../utils/format.js';

/* ------------------------------------------------------------------ dates */

const PRESETS = [
  { key: 'month', label: 'This month' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'lastMonth', label: 'Last month' },
];

function presetRange(key) {
  const now = new Date();
  const today = toLocalIsoDate(now);
  if (key === '7d' || key === '30d') {
    const start = new Date(now);
    start.setDate(now.getDate() - (key === '7d' ? 6 : 29));
    return { from: toLocalIsoDate(start), to: today };
  }
  if (key === 'lastMonth') {
    return {
      from: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  return { from: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

/** The sales-trend endpoint only returns days that had sales; charts want every day, with zeros. */
function fillDays(trend, from, to) {
  if (daysInRange(from, to) > 800) return trend;
  const byDate = new Map(trend.map((d) => [String(d.date).slice(0, 10), d]));
  const out = [];
  for (let d = parseIsoDate(from); toLocalIsoDate(d) <= to; d.setDate(d.getDate() + 1)) {
    const iso = toLocalIsoDate(d);
    const row = byDate.get(iso);
    out.push({
      date: iso,
      revenue: Number(row?.revenue ?? 0),
      grossProfit: Number(row?.grossProfit ?? 0),
      salesCount: Number(row?.salesCount ?? 0),
    });
  }
  return out;
}

/* ---------------------------------------------------------------- columns */

const BRANCH_COLUMNS = [
  { key: 'branchName', header: 'Branch', primary: true },
  { key: 'revenue', header: 'Revenue', render: (r) => formatMoney(r.revenue), className: 'text-right' },
  { key: 'grossProfit', header: 'Gross Profit', render: (r) => formatMoney(r.grossProfit), className: 'text-right' },
  { key: 'netProfit', header: 'Net Profit', render: (r) => formatMoney(r.netProfit), className: 'text-right' },
  { key: 'profitMarginPercent', header: 'Margin', render: (r) => `${r.profitMarginPercent}%`, className: 'text-right' },
];

/* ------------------------------------------------------------ plain words */

const pct = (n) => `${Math.abs(Number(n)).toFixed(1).replace(/\.0$/, '')}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "up 12.4% from 1,000.00 in the previous 21 days" - or a fallback when there is nothing earlier to compare with. */
function comparison(growth, periodLabel) {
  if (Number(growth.previousValue) === 0) return `there was nothing in ${periodLabel} to compare with`;
  const g = Number(growth.growthPercent);
  if (g === 0) return `the same as in ${periodLabel}`;
  return `${g > 0 ? 'up' : 'down'} ${pct(g)} from ${formatMoney(growth.previousValue)} in ${periodLabel}`;
}

function buildInsights({ data, days }) {
  const { revenueGrowth, profitGrowth, bestSelling, branchComparison } = data;
  const periodLabel = days === 1 ? 'the previous day' : `the previous ${days} days`;
  const revenue = Number(revenueGrowth.currentValue);
  const net = Number(profitGrowth.currentValue);
  const items = [];

  if (revenue === 0 && Number(revenueGrowth.previousValue) === 0) {
    const none = [{ tone: 'neutral', icon: 'info', content: <>No sales were recorded in this period.</> }];
    // Expenses can still exist without any sales - don't hide the resulting loss.
    if (net < 0) {
      none.push({
        tone: 'bad', icon: 'warning',
        content: <>Expenses were still recorded, leaving a <strong>net loss of {formatMoney(Math.abs(net))}</strong>.</>,
      });
    }
    return none;
  }

  items.push({
    tone: Number(revenueGrowth.growthPercent) < 0 ? 'bad' : 'good',
    icon: Number(revenueGrowth.growthPercent) < 0 ? 'trendDown' : 'trendUp',
    content: <>You sold <strong>{formatMoney(revenue)}</strong> worth of goods — {comparison(revenueGrowth, periodLabel)}.</>,
  });

  items.push({
    tone: net < 0 ? 'bad' : 'good',
    icon: net < 0 ? 'warning' : 'check',
    content: net < 0
      ? <>After product costs and expenses the business made a <strong>net loss of {formatMoney(Math.abs(net))}</strong> — {comparison(profitGrowth, periodLabel)}.</>
      : <>After product costs and expenses, <strong>{formatMoney(net)}</strong> was left as profit — {comparison(profitGrowth, periodLabel)}.</>,
  });

  if (bestSelling.length > 0) {
    const top = bestSelling[0];
    items.push({
      tone: 'neutral', icon: 'sales',
      content: <>Best seller: <strong>{top.productName}</strong> — {plural(top.quantitySold, 'unit')} sold for {formatMoney(top.revenue)}.</>,
    });
  }

  if (branchComparison.length > 1) {
    const total = branchComparison.reduce((sum, b) => sum + Number(b.revenue), 0);
    const top = branchComparison[0];
    if (total > 0) {
      items.push({
        tone: 'neutral', icon: 'branches',
        content: <><strong>{top.branchName}</strong> brought in the most revenue ({Math.round((Number(top.revenue) / total) * 100)}% of the total).</>,
      });
    }
    const losing = branchComparison.filter((b) => Number(b.netProfit) < 0);
    if (losing.length > 0) {
      items.push({
        tone: 'bad', icon: 'warning',
        content: <>{losing.map((b) => b.branchName).join(', ')} made a net loss in this period.</>,
      });
    }
  }
  return items;
}

const TONE = {
  good: 'bg-emerald-50 text-emerald-600',
  bad: 'bg-red-50 text-red-600',
  warn: 'bg-amber-50 text-amber-600',
  neutral: 'bg-cream-100 text-ink-500',
};

const GLOSSARY = [
  ['Revenue', 'The money from completed sales, minus refunds for items customers returned.'],
  ['Cost of goods (COGS)', 'What the items you sold originally cost you to buy.'],
  ['Gross profit', 'Revenue minus cost of goods — what the products themselves earned.'],
  ['Expenses', 'Running costs recorded on the Expenses page.'],
  ['Net profit', 'Gross profit minus expenses. A negative number means a loss.'],
  ['Margin', 'Net profit as a percentage of revenue. Higher is better.'],
  ['Growth / "vs previous period"', 'The change compared with the period of the same length that comes right before your chosen dates.'],
];

/* ------------------------------------------------------------------- page */

/**
 * Every figure here reads from ReportController/ReportService, which reuses
 * FinanceReportService's Revenue/COGS/Gross Profit formulas (spec section 24) -
 * "branch comparison" here and the Finance page's P&L for one branch always
 * agree because they are the same query.
 *
 * Headline numbers (revenue, profit, growth) come from that P&L source. The daily
 * trend chart comes from the sales-trend endpoint, which is before customer
 * returns - the chart caption says so.
 */
export default function ReportsPage() {
  const { scopeParams } = useBranchScope();
  const { hasPermission } = useAuth();
  const initial = presetRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    if (from > to) {
      setError('The start date must be on or before the end date.');
      setStatus('error');
      return;
    }
    const id = ++requestId.current;
    setStatus('loading');
    const params = { ...scopeParams, from, to };
    Promise.all([
      getBestSellingProducts({ ...params, limit: 10 }),
      getSlowMovingProducts({ ...params, limit: 10 }),
      getSalesTrend(params),
      getRevenueGrowth(params),
      getProfitGrowth(params),
      getBranchComparison(params),
    ])
      .then(([bestSelling, slowMoving, trend, revenueGrowth, profitGrowth, branchComparison]) => {
        if (id !== requestId.current) return; // a newer request superseded this one
        setData({ bestSelling, slowMoving, trend, revenueGrowth, profitGrowth, branchComparison });
        setStatus('ready');
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(extractErrorMessage(err));
        setStatus('error');
      });
  }, [from, to, scopeParams.scope, scopeParams.branchId]);

  useEffect(() => { load(); }, [load]);

  const days = from <= to ? daysInRange(from, to) : 0;
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.from === from && r.to === to;
  })?.key;

  return (
    <div className="space-y-5">
      {/* Header + date range */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Reports &amp; Analytics</h1>
          <p className="page-subtitle">
            {days > 0
              ? `${formatIsoDate(from)}${from === to ? '' : ` — ${formatIsoDate(to)}`} · ${plural(days, 'day')}`
              : 'Pick a valid date range'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-lg border border-cream-300 bg-cream-50 p-0.5 shadow-xs">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { const r = presetRange(p.key); setFrom(r.from); setTo(r.to); }}
                className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${
                  activePreset === p.key ? 'bg-cream-100 text-sage-700' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} max={to} aria-label="From date" onChange={(e) => setFrom(e.target.value)} className="input h-9 w-auto py-1.5" />
            <span className="text-sm text-ink-400">to</span>
            <input type="date" value={to} min={from} max={toLocalIsoDate(new Date())} aria-label="To date" onChange={(e) => setTo(e.target.value)} className="input h-9 w-auto py-1.5" />
          </div>
        </div>
      </div>

      {status === 'loading' && !data && <LoadingState label="Crunching the numbers..." />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}

      {status !== 'error' && data && (
        <ReportBody data={data} days={days} from={from} to={to} hasPermission={hasPermission} dimmed={status === 'loading'} />
      )}

      <StockStatusSection scopeParams={scopeParams} />
    </div>
  );
}

/* ------------------------------------------------------------ stock status */

const ATTENTION_COLUMNS = [
  { key: 'productName', header: 'Product', primary: true, render: (r) => (
      <div><p className="font-medium text-ink-900">{r.productName}</p><p className="text-xs text-ink-400">{r.sku}</p></div>
    ) },
  { key: 'status', header: 'Status', render: (r) => <StockStatusBadge status={r.status} /> },
  { key: 'available', header: 'Available', className: 'text-right tabular-nums', render: (r) => `${r.available} ${r.unit ?? ''}`.trim() },
  { key: 'reorderLevel', header: 'Reorder at', className: 'text-right tabular-nums' },
];

/** The stock picture right now (not tied to the date range above): in words, as a chart, and as the list to restock. */
function StockStatusSection({ scopeParams }) {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    getStockStatusReport(scopeParams)
      .then((data) => { if (!cancelled) setState({ status: 'ready', data }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [scopeParams.scope, scopeParams.branchId]);

  const { status, data } = state;
  return (
    <Section
      title="Stock status"
      description="Right now, for the branches you can see — the date range above doesn't change it. Low stock means at or below the product's reorder level."
    >
      {status === 'loading' && !data && <p className="text-sm text-ink-400">Checking stock levels…</p>}
      {status === 'error' && <p className="text-sm text-red-600">Couldn&apos;t load the stock status. Try again in a moment.</p>}
      {data && <StockStatusBody data={data} dimmed={status === 'loading'} />}
    </Section>
  );
}

function StockStatusBody({ data, dimmed }) {
  const { summary, needsAttention } = data;
  const segments = [
    { key: 'in', label: STOCK_STATUS.IN_STOCK.label, value: Number(summary.inStock), color: STOCK_STATUS.IN_STOCK.color },
    { key: 'low', label: STOCK_STATUS.LOW_STOCK.label, value: Number(summary.lowStock), color: STOCK_STATUS.LOW_STOCK.color },
    { key: 'out', label: STOCK_STATUS.OUT_OF_STOCK.label, value: Number(summary.outOfStock), color: STOCK_STATUS.OUT_OF_STOCK.color },
  ];
  const total = Number(summary.total);
  const low = Number(summary.lowStock);
  const out = Number(summary.outOfStock);
  const listed = needsAttention.length;

  const lines = [];
  if (total === 0) {
    lines.push({ tone: 'neutral', icon: 'info', content: <>There are no products yet.</> });
  } else {
    lines.push({
      tone: 'neutral', icon: 'info',
      content: <>You have <strong>{plural(total, 'product')}</strong>: <strong>{summary.inStock} in stock</strong>, <strong>{low} running low</strong> and <strong>{out} out of stock</strong>.</>,
    });
    if (out > 0) {
      lines.push({
        tone: 'bad', icon: 'error',
        content: <><strong>{plural(out, 'product')} {out === 1 ? 'is' : 'are'} out of stock</strong> and can&apos;t be sold until restocked.</>,
      });
    }
    if (low > 0) {
      lines.push({
        tone: 'warn', icon: 'warning',
        content: <><strong>{plural(low, 'product')} {low === 1 ? 'is' : 'are'} running low</strong> — at or below {low === 1 ? 'its' : 'their'} reorder level.</>,
      });
    }
    if (out === 0 && low === 0) {
      lines.push({ tone: 'good', icon: 'check', content: <>Everything is well stocked.</> });
    }
  }

  return (
    <div className={`space-y-5 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
      <ul className="space-y-2.5">
        {lines.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-ink-700">
            <span className={`mt-0.5 shrink-0 rounded-md p-1 ${TONE[item.tone]}`}>
              <Icon name={item.icon} size={14} />
            </span>
            <span>{item.content}</span>
          </li>
        ))}
      </ul>

      {total > 0 && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <DonutChart segments={segments} centerLabel="products" />
          <div>
            {listed === 0 ? (
              <p className="text-sm text-ink-400">No product needs restocking.</p>
            ) : (
              <>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">To restock</p>
                <DataTable columns={ATTENTION_COLUMNS} rows={needsAttention} keyField="productId" />
                {listed < low + out && (
                  <p className="mt-2 text-xs text-ink-400">Showing the {listed} most urgent of {low + out}.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportBody({ data, days, from, to, hasPermission, dimmed }) {
  const { revenueGrowth, profitGrowth, trend, bestSelling, slowMoving, branchComparison } = data;

  const points = fillDays(trend, from, to);
  const salesCount = trend.reduce((sum, d) => sum + Number(d.salesCount), 0);
  const trendRevenue = trend.reduce((sum, d) => sum + Number(d.revenue), 0);
  const averageSale = salesCount > 0 ? trendRevenue / salesCount : 0;
  const trendSeries = [
    { key: 'revenue', label: 'Sales', color: '#4470e6', area: true },
    hasPermission('VIEW_PROFIT') && { key: 'grossProfit', label: 'Gross profit', color: '#10b981' },
  ].filter(Boolean);

  const net = Number(profitGrowth.currentValue);
  const kpiHint = (g) => (Number(g.previousValue) === 0 ? 'no earlier figure to compare' : `${pct(g.growthPercent)} vs previous period`);

  const showBranchChart = branchComparison.length > 1;
  const branchSeries = [
    { key: 'revenue', label: 'Revenue', color: '#4470e6' },
    { key: 'grossProfit', label: 'Gross Profit', color: '#94a3b8' },
    { key: 'netProfit', label: 'Net Profit', color: '#10b981' },
  ];

  const productRows = (rows) => rows.map((r) => ({
    id: r.productId,
    title: r.productName,
    subtitle: r.sku,
    value: Number(r.quantitySold),
    valueLabel: `${r.quantitySold} sold`,
    detail: formatMoney(r.revenue),
  }));

  const insights = buildInsights({ data, days });
  const noSales = trend.length === 0;
  const nothingToChart = noSales && bestSelling.length === 0;

  return (
    <div className={`space-y-5 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
      {/* Plain-words summary */}
      <section className="card">
        <div className="border-b border-cream-200 px-4 py-3 sm:px-5">
          <h2 className="card-title">The short version</h2>
          <p className="mt-0.5 text-xs text-ink-400">What happened in this period, in plain words.</p>
        </div>
        <ul className="space-y-2.5 px-4 py-4 sm:px-5">
          {insights.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-ink-700">
              <span className={`mt-0.5 shrink-0 rounded-md p-1 ${TONE[item.tone]}`}>
                <Icon name={item.icon} size={14} />
              </span>
              <span>{item.content}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Key figures */}
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenue"
          icon="finance"
          value={formatMoney(revenueGrowth.currentValue)}
          trend={Number(revenueGrowth.growthPercent)}
          hint={kpiHint(revenueGrowth)}
        />
        <KpiCard
          label="Net Profit"
          icon="trendUp"
          value={formatMoney(net)}
          emphasize={net > 0}
          warn={net < 0}
          trend={Number(profitGrowth.growthPercent)}
          hint={kpiHint(profitGrowth)}
        />
        <KpiCard index={2} label="Sales made" icon="sales" value={salesCount} hint="completed sales" />
        <KpiCard index={3} label="Average sale" icon="pos" value={formatMoney(averageSale)} hint="per sale, before returns" />
      </div>

      {nothingToChart ? (
        <section className="card">
          <EmptyState
            title="No sales in this period"
            description="Try 'Last 30 days' or a longer date range to see charts and rankings."
            icon="sales"
            compact
          />
        </section>
      ) : (
        <>
          {/* Daily trend */}
          <Section title="Sales day by day" description="How much you sold each day. Move your mouse over the chart (or drag a finger on a phone) to see a day's exact figures.">
            {noSales ? (
              <EmptyState title="No sales in this period" description="Try a longer date range." icon="sales" compact />
            ) : (
              <>
                <TrendChart points={points} series={trendSeries} tooltipExtras={[{ key: 'salesCount', label: 'Sales made' }]} />
                <p className="mt-2 text-xs text-ink-400">
                  Daily figures are before customer returns, so they can add up to slightly more than the Revenue shown above.
                </p>
              </>
            )}
          </Section>

          {/* Products */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Section title="Best-selling products" description="The products that sold the most units.">
              {bestSelling.length === 0
                ? <EmptyState title="No sales in this period" icon="sales" compact />
                : <RankedBars rows={productRows(bestSelling)} color="#4470e6" />}
            </Section>
            <Section
              title="Slow-moving products"
              description="Products that did sell, but only a little. Worth promoting, or ordering less of. Products with no sales at all are not listed."
            >
              {slowMoving.length === 0
                ? <EmptyState title="No products to show" icon="inventory" compact />
                : <RankedBars rows={productRows(slowMoving)} color="#f59e0b" />}
            </Section>
          </div>

          {/* Branches */}
          {showBranchChart && (
            <Section title="Branch comparison" description="How each branch did. A bar below the line (in red) means that branch lost money.">
              <BranchBarChart
                rows={branchComparison.map((b) => ({ ...b, id: b.branchId, label: b.branchName }))}
                series={branchSeries}
              />
            </Section>
          )}
        </>
      )}

      {/* Exact figures */}
      {(!nothingToChart || branchComparison.length > 0) && (
        <Section title="Branch details" description="Revenue, profit and margin for each branch you can see.">
          {branchComparison.length === 0
            ? <EmptyState title="No branches to compare" icon="branches" compact />
            : <DataTable columns={BRANCH_COLUMNS} rows={branchComparison} keyField="branchId" />}
        </Section>
      )}

      {/* Glossary */}
      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-cream-50 p-1 text-ink-400"><Icon name="info" size={14} /></span>
            <span className="card-title">What do these terms mean?</span>
          </span>
          <Icon name="chevronDown" size={16} className="text-ink-400 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-cream-200 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term}>
              <dt className="font-medium text-slate-800">{term}</dt>
              <dd className="text-ink-500">{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="card">
      <div className="border-b border-cream-200 px-4 py-3 sm:px-5">
        <h2 className="card-title">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{description}</p>}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
