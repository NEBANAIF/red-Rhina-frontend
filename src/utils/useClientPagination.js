import { useEffect, useMemo, useState } from 'react';

/**
 * Client-side paging for list endpoints that return a plain array instead
 * of a backend Page (customers, suppliers, branches, banks, stock overview,
 * reports) - slices the already-loaded array into pages so long lists don't
 * all render as one huge table, without needing a backend pagination
 * endpoint for each of these.
 *
 * Mirrors the shape Pagination.jsx already expects from real backend pages
 * ({ page, totalPages, totalElements, onPageChange }), so the same
 * component is reused everywhere.
 */
export default function useClientPagination(rows, pageSize = 20) {
  const [page, setPage] = useState(0);
  const items = rows || [];
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));

  // Snap back to the last valid page if the list shrinks (e.g. a filter
  // narrows the results) or re-loads while sitting on a now out-of-range page.
  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageRows = useMemo(
    () => items.slice(page * pageSize, page * pageSize + pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, pageRows, totalPages, totalElements };
}
