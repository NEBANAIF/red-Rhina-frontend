import React, { useEffect, useMemo, useState } from 'react';
import { getManufacturingReport } from '../../api/manufacturing.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import { useAppName } from '../../config/BrandContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import TrendChart from '../../components/charts/TrendChart.jsx';
import RankedBars from '../../components/charts/RankedBars.jsx';
import { exportExcel, exportCsv, exportPdf, safeFileName } from '../../utils/exporter.js';
import { formatMoney, formatCompact, toIsoDate } from '../../utils/format.js';

const fmt = (n) => Number(n ?? 0).toLocaleString();

/** Every manufacturing report: what it is called, and which filters make sense for it. */
const REPORTS = [
  { type: 'PRODUCTION', label: 'Production', product: true },
  { type: 'MATERIAL_CONSUMPTION', label: 'Material consumption', product: true },
  { type: 'INTERNATIONAL_PURCHASES', label: 'International purchases', status: ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
  { type: 'SHIPMENT_DELAYS', label: 'Shipment delays', dateHint: 'Shipments expected to arrive in the period' },
  { type: 'PRODUCTION_COSTS', label: 'Production costs', product: true },
  { type: 'WASTE', label: 'Waste', product: true },
  { type: 'QUALITY', label: 'Quality control', product: true, status: ['PASS', 'FAIL'] },
  { type: 'MACHINE_DOWNTIME', label: 'Machine downtime' },
  { type: 'FINISHED_GOODS', label: 'Finished goods', product: true },
  { type: 'DIRECT_SALES', label: 'Direct sales', product: true, status: ['UNPAID', 'PARTIAL', 'PAID'] },
];
const label = (v) => v.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const show = (format, v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (format === 'money') return formatMoney(v);
  if (format === 'percent') return `${Number(v)}%`;
  if (format === 'number') return fmt(v);
  return String(v);
};

function Field({ text, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{text}</span>{children}</label>;
}

function Chart({ chart }) {
  if (!chart || chart.points.length === 0) return <p className="text-sm text-ink-500">Nothing to chart for this period.</p>;
  const f = (v) => (chart.format === 'money' ? formatCompact(v) : chart.format === 'percent' ? `${Number(v)}%` : fmt(v));
  if (chart.kind === 'line') {
    return (
      <TrendChart
        points={chart.points.map((p) => ({ date: p.label, value: Number(p.value) }))}
        series={[{ key: 'value', label: chart.title, color: '#5e7852', area: true }]}
        formatValue={f}
      />
    );
  }
  return (
    <RankedBars
      color="#5e7852"
      rows={chart.points.map((p) => ({ id: p.label, title: p.label, value: Number(p.value), valueLabel: show(chart.format, p.value) }))}
    />
  );
}

/** Manufacturing reports: pick a report, filter it, read the summary and chart, and export the full table (Excel, CSV, PDF). */
export default function ManufacturingReportsPage() {
  const { user } = useAuth();
  const { appName } = useAppName();
  const { scopeParams, scope, specificBranchId, branches } = useBranchScope();
  const [type, setType] = useState('PRODUCTION');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return toIsoDate(d); });
  const [to, setTo] = useState(() => toIsoDate(new Date()));
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const def = REPORTS.find((r) => r.type === type);

  // a filter that does not exist for the newly picked report must not stay applied
  useEffect(() => { setStatus(''); if (!def.product) setProduct(null); }, [type]);

  const load = () => {
    setState('loading');
    getManufacturingReport(type, { ...scopeParams, from, to, productId: def.product ? product?.id : undefined, status: status || undefined })
      .then((d) => { setData(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [type, from, to, product, status, scopeParams.scope, scopeParams.branchId]);

  const columns = useMemo(() => (data?.columns ?? []).map((c) => ({
    key: c.key,
    header: c.label,
    className: ['money', 'number', 'percent'].includes(c.format) ? 'text-right' : '',
    render: (r) => show(c.format, r[c.key]),
  })), [data]);

  // report rows have no id of their own; the table needs a stable key
  const tableRows = useMemo(() => (data?.rows ?? []).map((r, i) => ({ ...r, _rowId: i })), [data]);

  const exportColumns = (data?.columns ?? []).map((c) => ({
    header: c.label,
    value: (r) => r[c.key] ?? '',
    type: c.format === 'percent' ? 'number' : c.format,
    total: c.total,
  }));

  const branchLine = scope === 'SPECIFIC'
    ? `Factory: ${branches.find((b) => b.id === specificBranchId)?.name ?? 'selected factory'}`
    : 'Factories: all factories you may see';
  const infoLines = [`Period: ${from} to ${to}`, branchLine, ...(product ? [`Product: ${product.name}`] : []), ...(status ? [`Status: ${label(status)}`] : [])];

  const doExport = async (format) => {
    if (!data) return;
    setExporting(format);
    try {
      const filename = safeFileName(`${data.title}_${from}_${to}`);
      const args = { title: data.title, appName, columns: exportColumns, rows: data.rows, infoLines, generatedBy: user?.name };
      if (format === 'xlsx') await exportExcel({ ...args, filename });
      else if (format === 'csv') exportCsv({ filename, columns: exportColumns, rows: data.rows });
      else exportPdf(args);
    } catch (e) {
      setError(extractErrorMessage(e));
      setState('error');
    } finally {
      setExporting('');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Manufacturing Reports</h1>
        <div className="flex gap-2">
          {[['xlsx', 'Excel'], ['csv', 'CSV'], ['pdf', 'PDF']].map(([f, text]) => (
            <button key={f} type="button" className="btn btn-secondary btn-sm" disabled={!data || exporting !== ''} onClick={() => doExport(f)}>
              {exporting === f ? 'Exporting…' : `Export ${text}`}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field text="Report">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {REPORTS.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
            </select>
          </Field>
          <Field text="From"><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field text="To"><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          {def.product && (
            <Field text="Product">
              <div className="flex items-center gap-1">
                <div className="w-56"><ProductSelect value={product} onChange={setProduct} productType="FINISHED_GOOD" placeholder="All products" /></div>
                {product && <button type="button" className="text-xs font-medium text-sage-600 hover:underline" onClick={() => setProduct(null)}>Clear</button>}
              </div>
            </Field>
          )}
          {def.status && (
            <Field text="Status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {def.status.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </Field>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-400">
          {def.dateHint ?? 'The dates filter on when the work was completed, bought or recorded.'} Use the selector at the top for one factory or all factories.
        </p>
      </div>

      {state === 'error' && <ErrorState message={error} onRetry={load} />}
      {state === 'loading' && !data && <LoadingState />}
      {data && state !== 'error' && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {data.summary.map((s, i) => (
              <KpiCard key={s.label} index={i} label={s.label} value={show(s.format, s.value)} emphasize={i === data.summary.length - 1} />
            ))}
          </div>

          <div className="mb-4 card card-pad">
            <h2 className="mb-3 text-base font-semibold text-ink-900">{data.chart.title}</h2>
            <Chart chart={data.chart} />
          </div>

          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink-900">{data.title}</h2>
              <span className="text-xs text-ink-400">{fmt(data.rows.length)} row(s) · {data.from} to {data.to}</span>
            </div>
            <DataTable columns={columns} rows={tableRows} keyField="_rowId" emptyMessage="No data for these filters." />
          </div>
        </>
      )}
    </div>
  );
}
