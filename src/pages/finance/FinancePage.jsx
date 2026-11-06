import React, { useEffect, useState } from 'react';
import { getPnL, searchFinancialTransactions } from '../../api/finance.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import DataTable from '../../components/DataTable.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';
import ElegantSelect from '../../components/ElegantSelect.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Ratio helper - never a divide-by-zero, mirrors the backend's own
 * "zero when revenue is zero" rule for profitMarginPercent. Rounded to
 * one decimal for display only; nothing here is sent back to the server. */
function percentOf(part, whole) {
  const p = Number(part ?? 0);
  const w = Number(whole ?? 0);
  if (!w) return 0;
  return Math.round((p / w) * 1000) / 10;
}

const ALL_TRANSACTION_TYPES = [
  { value: 'SALE_REVENUE', label: 'Sale Revenue', tone: 'success' },
  { value: 'COGS', label: 'COGS', tone: 'muted', profitSensitive: true },
  { value: 'EXPENSE', label: 'Expense', tone: 'attention' },
  { value: 'PAYMENT_IN', label: 'Payment In', tone: 'success' },
  { value: 'PAYMENT_OUT', label: 'Payment Out', tone: 'danger' },
];

/**
 * Spec section 24's exact formula set, read straight from
 * FinanceReportService.getPnL - revenue/COGS/gross profit are computed
 * from real Sale/SaleBatchAllocation/CustomerReturn data server-side,
 * never derived client-side from anything else.
 *
 * COGS, gross profit, net profit, profit margin and anything derived from
 * them are gated behind VIEW_PROFIT, matching how Dashboard and Sales
 * History already treat those same figures - FINANCE_VIEW alone (what
 * gets you onto this page) was never meant to imply profit visibility.
 */
export default function FinancePage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canSeeProfit = hasPermission('VIEW_PROFIT');

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [pnl, setPnl] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = () => {
    setStatus('loading');
    getPnL({ ...scopeParams, from, to })
      .then((res) => { setPnl(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [from, to, scopeParams.scope, scopeParams.branchId]);

  const grossMarginPercent = pnl ? percentOf(pnl.grossProfit, pnl.revenue) : 0;
  const expenseRatioPercent = pnl ? percentOf(pnl.totalExpenses, pnl.revenue) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Finance</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          <span className="text-ink-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
      </div>

      {status === 'loading' && <LoadingState label="Calculating P&L..." />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'ready' && pnl && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KpiCard index={0} label="Revenue" value={formatMoney(pnl.revenue)} />
            {canSeeProfit && <KpiCard index={1} label="COGS" value={formatMoney(pnl.cogs)} />}
            {canSeeProfit && <KpiCard index={2} label="Gross Profit" value={formatMoney(pnl.grossProfit)} />}
            <KpiCard index={3} label="Expenses" value={formatMoney(pnl.totalExpenses)} />
            {canSeeProfit && <KpiCard index={4} label="Net Profit" value={formatMoney(pnl.netProfit)} emphasize />}
            {canSeeProfit && <KpiCard index={5} label="Profit Margin" value={`${pnl.profitMarginPercent}%`} />}
          </div>

          {canSeeProfit && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-ink-700">Accounting ratios</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <KpiCard
                  label="Gross Margin"
                  value={`${grossMarginPercent}%`}
                  hint="Gross profit ÷ revenue"
                />
                <KpiCard
                  label="Expense Ratio"
                  value={`${expenseRatioPercent}%`}
                  warn={expenseRatioPercent > 50}
                  hint="Expenses ÷ revenue"
                />
                <KpiCard
                  label="COGS Ratio"
                  value={`${percentOf(pnl.cogs, pnl.revenue)}%`}
                  hint="COGS ÷ revenue"
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        <TransactionsLedger from={from} to={to} scopeParams={scopeParams} canSeeProfit={canSeeProfit} />
      </div>
    </div>
  );
}

/**
 * The accounting ledger behind the P&L above - every SALE_REVENUE, COGS,
 * EXPENSE, PAYMENT_IN and PAYMENT_OUT posting, each linked back to its
 * source document. The /finance/transactions endpoint and its frontend
 * client (searchFinancialTransactions) already existed but nothing ever
 * called them, so this is new surface area, not a copy of what Expenses,
 * Payments or Sales History already show - those list the source
 * documents themselves, this lists the postings they generated.
 */
function TransactionsLedger({ from, to, scopeParams, canSeeProfit }) {
  const typeOptions = ALL_TRANSACTION_TYPES.filter((t) => canSeeProfit || !t.profitSensitive);

  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = () => {
    setStatus('loading');
    searchFinancialTransactions({ ...scopeParams, type: type || undefined, from, to, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [type, page, from, to, scopeParams.scope, scopeParams.branchId]);
  // A COGS row can slip in from a stale selection if permissions change mid-session; drop it client-side too.
  useEffect(() => { if (type === 'COGS' && !canSeeProfit) setType(''); }, [canSeeProfit, type]);
  useEffect(() => { setPage(0); }, [type, from, to]);

  const rows = (data?.content || []).filter((r) => canSeeProfit || r.type !== 'COGS');

  const exportColumns = [
    { header: 'Date', value: (r) => r.occurredOn, type: 'date' },
    { header: 'Type', value: (r) => ALL_TRANSACTION_TYPES.find((t) => t.value === r.type)?.label || r.type },
    { header: 'Branch', value: (r) => r.branchName },
    { header: 'Source', value: (r) => (r.referenceType ? r.referenceType.replace('_', ' ') : '') },
    // Signed like the screen: money going out (expenses, payments out, COGS) is negative.
    { header: 'Amount', type: 'money', total: true, value: (r) => {
      const out = r.type === 'EXPENSE' || r.type === 'PAYMENT_OUT' || r.type === 'COGS';
      return (out ? -1 : 1) * Math.abs(Number(r.amount ?? 0));
    } },
  ];

  const columns = [
    { key: 'occurredOn', header: 'Date', render: (r) => formatDate(r.occurredOn) },
    {
      key: 'type',
      header: 'Type',
      render: (r) => {
        const meta = ALL_TRANSACTION_TYPES.find((t) => t.value === r.type);
        return <Badge tone={meta?.tone} dot>{meta?.label || r.type}</Badge>;
      },
    },
    { key: 'branchName', header: 'Branch' },
    { key: 'referenceType', header: 'Source', render: (r) => (r.referenceType ? r.referenceType.replace('_', ' ') : '—') },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => {
        const negative = r.type === 'EXPENSE' || r.type === 'PAYMENT_OUT' || r.type === 'COGS';
        return (
          <span className={negative ? 'text-red-600' : 'text-emerald-700'}>
            {negative ? '-' : '+'}{formatMoney(Math.abs(Number(r.amount ?? 0)))}
          </span>
        );
      },
    },
  ];

  return (
    <div className="card card-pad">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-700">Transaction ledger</p>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <ExportButton
            title="Financial Transactions" columns={exportColumns} scoped
            dateField="occurredOn" dateLabel="Transaction date"
            nameFields={['branchName', 'referenceType', (r) => ALL_TRANSACTION_TYPES.find((t) => t.value === r.type)?.label || r.type]} nameLabel="Branch, type or source"
            initialFrom={from} initialTo={to}
            fetchRows={async ({ serverFrom, serverTo, scopeParams: sp }) => (await fetchAllPages(searchFinancialTransactions, {
              ...sp, type: type || undefined, from: serverFrom, to: serverTo,
            })).filter((r) => canSeeProfit || r.type !== 'COGS')}
          />
          <ElegantSelect value={type} onChange={setType} ariaLabel="Transaction type">
            <option value="">All types</option>
            {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </ElegantSelect>
        </div>
      </div>

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'ready' && data && (
        <>
          <DataTable columns={columns} rows={rows} emptyMessage="No financial transactions for this period." />
          <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
