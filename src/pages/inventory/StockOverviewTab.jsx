import React, { useEffect, useState } from 'react';
import { getInventoryOverview } from '../../api/inventory.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import Pagination from '../../components/Pagination.jsx';
import useClientPagination from '../../utils/useClientPagination.js';

/**
 * "Product | Main Warehouse | Bole Store | ... | Total" (spec section 10).
 * Not built on DataTable - the column set is DYNAMIC (one per branch in
 * scope), which DataTable's fixed `columns` prop isn't shaped for, and
 * this table is meant to be read as a wide grid, not collapsed to cards
 * (a per-branch quantity comparison loses its point stacked vertically).
 */
export default function StockOverviewTab() {
  const { scopeParams } = useBranchScope();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setStatus('loading');
    getInventoryOverview(scopeParams)
      .then((res) => {
        setData(res);
        setStatus('ready');
      })
      .catch((err) => {
        setError(extractErrorMessage(err));
        setStatus('error');
      });
  }, [scopeParams.scope, scopeParams.branchId]);

  if (status === 'loading') return <LoadingState label="Loading stock overview..." />;
  if (status === 'error') return <ErrorState message={error} />;
  if (!data || data.rows.length === 0) return <EmptyState title="No products with stock yet" />;

  const filteredRows = search
    ? data.rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(search.toLowerCase()) ||
          r.sku.toLowerCase().includes(search.toLowerCase()),
      )
    : data.rows;

  return <StockOverviewTable rows={filteredRows} branches={data.branches} search={search} setSearch={setSearch} />;
}

function StockOverviewTable({ rows, branches, search, setSearch }) {
  const { page, setPage, pageRows, totalPages, totalElements } = useClientPagination(rows);
  useEffect(() => { setPage(0); }, [search, setPage]);

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} placeholder="Search products…" className="mb-3" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="sticky left-0 z-10 py-2 pr-4 font-medium" style={{ background: 'var(--card-bg)' }}>Product</th>
              {branches.map((b) => (
                <th key={b.branchId} className="whitespace-nowrap py-2 pr-4 text-right font-medium">
                  {b.branchName}
                </th>
              ))}
              <th className="py-2 pr-4 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.productId} className="border-b border-slate-50 last:border-0">
                <td className="sticky left-0 z-10 py-2.5 pr-4" style={{ background: 'var(--card-bg)' }}>
                  <p className="font-medium text-ink-900">{row.productName}</p>
                  <p className="text-xs text-ink-400">{row.sku}</p>
                </td>
                {branches.map((b) => (
                  <td key={b.branchId} className="py-2.5 pr-4 text-right tabular-nums">
                    {row.quantityByBranch[b.branchId] ?? 0}
                  </td>
                ))}
                <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} totalElements={totalElements} onPageChange={setPage} />
    </div>
  );
}
