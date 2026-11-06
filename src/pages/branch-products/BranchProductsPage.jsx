import React, { useEffect, useState } from 'react';
import { listBranches } from '../../api/branches.js';
import { getProductBranchChecklist, setProductBranchAllowed } from '../../api/productBranches.js';
import { extractErrorMessage } from '../../api/client.js';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';

/**
 * Which products belong at a branch. Pick the branch above, then tick or untick each product
 * below — ticked means it belongs there, unticked means it doesn't. An unticked product is left
 * out of that branch's product list, POS, purchases, batches, and transfers to or from it.
 *
 * Every product starts ticked at every branch, so nothing is invisible until someone deliberately
 * unticks it here.
 */
export default function BranchProductsPage() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    listBranches().then((list) => {
      setBranches(list);
      if (list.length > 0) setBranchId(list[0].id);
    }).catch(() => {});
  }, []);

  const load = () => {
    if (!branchId) return;
    setStatus('loading');
    getProductBranchChecklist({ branchId, search: search || undefined, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [branchId, page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(); }, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggle = async (row) => {
    const next = !row.allowed;
    setBusyId(row.productId);
    // optimistic
    setData((d) => ({ ...d, content: d.content.map((r) => (r.productId === row.productId ? { ...r, allowed: next } : r)) }));
    try {
      await setProductBranchAllowed(row.productId, branchId, next);
    } catch (err) {
      // roll back
      setData((d) => ({ ...d, content: d.content.map((r) => (r.productId === row.productId ? { ...r, allowed: !next } : r)) }));
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title mb-1">Branch Products</h1>
      <p className="page-subtitle mb-4">
        Tick a product to say it belongs at this branch. Untick it and it disappears from this
        branch&apos;s product list, POS, purchases, batches, and transfers to or from it.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input w-full sm:w-64" value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(0); }}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} · {b.type === 'STORE' ? 'Store' : b.type === 'FACTORY' ? 'Factory' : 'Warehouse'}</option>
          ))}
        </select>
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search products…" />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="card card-pad">
        {status === 'loading' && !data && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && data && (
          data.content.length === 0 ? (
            <EmptyState icon="inventory" title="No products found" compact />
          ) : (
            <>
              <ul className="divide-y divide-cream-200">
                {data.content.map((row) => (
                  <li key={row.productId} className="flex items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={row.allowed}
                      disabled={busyId === row.productId}
                      onChange={() => toggle(row)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${row.allowed ? 'text-ink-900' : 'text-ink-400'}`}>{row.productName}</p>
                      <p className="truncate text-xs text-ink-400">{row.sku}{row.unit ? ` · ${row.unit}` : ''}</p>
                    </div>
                    {!row.allowed && (
                      <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                        Not at this branch
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
