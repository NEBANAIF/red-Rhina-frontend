import React from 'react';

/* Status -> tone. Tones are defined once so a status looks identical on every
   page (sales, purchases, transfers, loans...). */
const TONE_BY_STATUS = {
  // Generic positive / completed states
  COMPLETED: 'success',
  PAID: 'success',
  RECEIVED: 'success',
  APPROVED: 'success',
  ACTIVE: 'success',
  // In-progress / neutral
  PENDING: 'warning',
  PARTIAL: 'warning',
  PARTIALLY_PAID: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  IN_TRANSIT: 'info',
  ARRIVED: 'success',
  NOT_SHIPPED: 'neutral',
  NOT_RECEIVED: 'neutral',
  DELAYED: 'danger',
  GLOBAL: 'info',
  LOCAL: 'neutral',
  DRAFT: 'neutral',
  // Branch type badges (not really a "status", but reuses the same component)
  STORE: 'info',
  WAREHOUSE: 'accent',
  SHOWROOM: 'info',
  PRESENT: 'success',
  LATE: 'warning',
  HALF_DAY: 'warning',
  ABSENT: 'danger',
  ON_LEAVE: 'info',
  UNPAID: 'danger',
  DELIVERED: 'success',
  // Negative / attention states
  CREDIT: 'attention',
  OVERDUE: 'danger',
  CANCELLED: 'muted',
  REJECTED: 'danger',
  VOID: 'muted',
  INACTIVE: 'muted',
};

const TONE_CLASSES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 [--dot:#10b981]',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 [--dot:#f59e0b]',
  info: 'border-brand-200 bg-cream-100 text-sage-700 [--dot:#4470e6]',
  accent: 'border-purple-200 bg-purple-50 text-purple-700 [--dot:#a855f7]',
  attention: 'border-orange-200 bg-orange-50 text-orange-700 [--dot:#f97316]',
  danger: 'border-red-200 bg-red-50 text-red-700 [--dot:#ef4444]',
  muted: 'border-cream-300 bg-cream-50 text-ink-500 [--dot:#94a3b8]',
  neutral: 'border-cream-300 bg-cream-100 text-ink-600 [--dot:#94a3b8]',
};

/**
 * Renders any backend status/enum string with a sensible colour, defaulting to
 * neutral grey for anything unmapped. `tone` can override the lookup for
 * one-off cases; `dot` adds a leading status dot for dense table cells.
 */
export default function Badge({ status, tone, dot = true, children }) {
  const resolved = TONE_CLASSES[tone || TONE_BY_STATUS[status]] || TONE_CLASSES.neutral;
  const label = children ?? formatStatusLabel(status);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-md border px-2 py-0.5 text-xs font-medium ${resolved}`}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dot)]" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </span>
  );
}

function formatStatusLabel(status) {
  if (!status) return '';
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
