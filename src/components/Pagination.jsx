import React from 'react';
import Icon from './Icon.jsx';

/** Matches the backend's PageResponse shape exactly ({ page, totalPages, totalElements, last }). */
export default function Pagination({ page, totalPages, totalElements, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-2 border-t border-cream-200 pt-3 text-sm text-ink-500 sm:flex-row">
      <span className="tabular">
        <span className="font-medium text-ink-700">{totalElements}</span> total
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          className="btn btn-secondary btn-sm"
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" size={14} />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <span className="px-2 text-sm tabular text-ink-600">
          Page <span className="font-medium text-ink-900">{page + 1}</span> of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= totalPages}
          className="btn btn-secondary btn-sm"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}
