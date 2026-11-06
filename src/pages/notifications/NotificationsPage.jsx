import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listNotifications, markNotificationRead, markAllNotificationsRead, holdNotification, approveNotification,
} from '../../api/notifications.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useNotificationCounts } from '../../notifications/NotificationCountsContext.jsx';
import Badge from '../../components/Badge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Icon from '../../components/Icon.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import Pagination from '../../components/Pagination.jsx';
import { formatDateTime } from '../../utils/format.js';

/**
 * Every sale and stock change, newest first, for the branches the signed-in user can see.
 *
 *  - Unread: what this user has not read. Marking one as read (or reviewing it) removes it from
 *    THIS list only; it stays unread for other people.
 *  - To review: everything still pending or on hold, whether read or not, until it is approved.
 *
 * Sales and ordinary stock changes have already happened: Hold and Approve are a check on them and
 * never undo or block them. A manual stock change (Add Batch / Remove Stock / initial stock) is
 * different - it is HELD, the stock has not moved, and "Review & approve" opens the Batches page
 * where approving it is what makes the stock move.
 */

const TABS = [
  { key: 'UNREAD', label: 'Unread', countKey: 'unread' },
  { key: 'TO_REVIEW', label: 'To review', countKey: 'toReview' },
];

const TYPE_ICON = {
  SALE_COMPLETED: { icon: 'sales', bubble: 'bg-emerald-50 text-emerald-600' },
  SALE_VOIDED: { icon: 'warning', bubble: 'bg-red-50 text-red-600' },
  STOCK_CHANGE: { icon: 'inventory', bubble: 'bg-cream-100 text-sage-700' },
};

const REVIEW_BADGE = {
  PENDING: { tone: 'warning', label: 'Awaiting review' },
  ON_HOLD: { tone: 'attention', label: 'On hold' },
  APPROVED: { tone: 'success', label: 'Approved' },
  REJECTED: { tone: 'danger', label: 'Rejected' },
};

// A manual stock change held for approval: the stock has not moved yet.
const HELD_REQUEST = 'STOCK_CHANGE_REQUEST';
const HELD_BADGE = { ...REVIEW_BADGE, PENDING: { tone: 'warning', label: 'Waiting for approval' } };

function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : formatDateTime(iso);
}

export default function NotificationsPage() {
  const { hasPermission } = useAuth();
  const canReview = hasPermission('ACTIVITY_REVIEW');
  const { counts, refresh } = useNotificationCounts();

  const [tab, setTab] = useState('UNREAD');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const requestId = useRef(0);

  // silent: refresh in the background (new arrivals, after an action) without the loading spinner.
  const load = useCallback((silent = false) => {
    const id = ++requestId.current;
    if (!silent) setStatus('loading');
    return listNotifications({ tab, page })
      .then((res) => {
        if (id !== requestId.current) return;
        // Removing the last item on a page leaves that page empty: step back one page.
        if (res.content.length === 0 && page > 0) {
          setPage(page - 1);
          return;
        }
        setData(res);
        setStatus('ready');
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        if (!silent) {
          setError(extractErrorMessage(err));
          setStatus('error');
        }
      });
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  // The bell polls; when its numbers change something new arrived, so bring the list up to date.
  useEffect(() => {
    if (counts) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts?.unread, counts?.toReview]);

  const switchTab = (key) => {
    if (key === tab) return;
    setData(null);
    setActionError('');
    setPage(0);
    setTab(key);
  };

  const run = async (n, action) => {
    setBusyId(n.id);
    setActionError('');
    try {
      await action(n.id);
      await load(true);
      await refresh();
    } catch (err) {
      setActionError(extractErrorMessage(err));
      load(true);
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    setBusyAll(true);
    setActionError('');
    try {
      await markAllNotificationsRead();
      await load(true);
      await refresh();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusyAll(false);
    }
  };

  const items = data?.content ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            Every sale and stock change. Read ones disappear from your Unread list; anything still waiting for a check stays under To review until it is approved.
          </p>
        </div>
        {tab === 'UNREAD' && items.length > 0 && (
          <button onClick={markAll} disabled={busyAll} className="btn btn-secondary btn-sm self-start sm:self-auto">
            <Icon name="check" size={14} />
            {busyAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="inline-flex rounded-lg border border-cream-300 bg-cream-50 p-0.5 shadow-xs" role="tablist">
        {TABS.map((t) => {
          const count = counts ? counts[t.countKey] : null;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                active ? 'bg-cream-100 text-sage-700' : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                  t.key === 'UNREAD' ? 'bg-red-500 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {status === 'loading' && !data && <LoadingState />}
      {status === 'error' && <ErrorState message={error} onRetry={() => load()} />}

      {status === 'ready' && data && (
        items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={tab === 'UNREAD' ? 'bell' : 'check'}
              title={tab === 'UNREAD' ? "You're all caught up" : 'Nothing is waiting for review'}
              description={tab === 'UNREAD'
                ? 'New sales and stock changes will show up here.'
                : 'Sales and stock changes that still need checking will show up here.'}
              compact
            />
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  canReview={canReview}
                  busy={busyId === n.id}
                  onRead={() => run(n, markNotificationRead)}
                  onHold={() => run(n, holdNotification)}
                  onApprove={() => run(n, approveNotification)}
                />
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
          </>
        )
      )}
    </div>
  );
}

function NotificationItem({ n, canReview, busy, onRead, onHold, onApprove }) {
  const type = TYPE_ICON[n.type] ?? TYPE_ICON.STOCK_CHANGE;
  const held = n.referenceType === HELD_REQUEST;
  const review = (held ? HELD_BADGE : REVIEW_BADGE)[n.reviewStatus] ?? REVIEW_BADGE.PENDING;
  const navigate = useNavigate();

  return (
    <li className={`card flex gap-3 p-4 ${n.read ? '' : 'border-l-4 border-l-sage-500'}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${type.bubble}`}>
        <Icon name={type.icon} size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink-900">{n.title}</p>
          <Badge tone={review.tone}>{review.label}</Badge>
          {!n.read && <span className="text-[11px] font-medium uppercase tracking-wide text-sage-600">New</span>}
        </div>

        <p className="mt-0.5 break-words text-sm text-ink-600">{n.message}</p>

        <p className="mt-1 text-xs text-ink-400">
          {n.branchName}
          {n.actorName && <> · {n.actorName}</>}
          {' · '}
          <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time>
          {n.reviewStatus === 'ON_HOLD' && n.reviewedByName && <> · held by {n.reviewedByName}</>}
          {n.reviewStatus === 'APPROVED' && n.reviewedByName && <> · approved by {n.reviewedByName}</>}
          {n.reviewStatus === 'REJECTED' && n.reviewedByName && <> · rejected by {n.reviewedByName}</>}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {held && n.reviewStatus === 'PENDING' && (
            // Approving moves the stock, so it is done where the full details (cost included) are shown.
            <button onClick={() => navigate('/batches')} className="btn btn-primary btn-sm">Review &amp; approve</button>
          )}
          {!held && canReview && n.reviewStatus === 'PENDING' && (
            <button onClick={onHold} disabled={busy} className="btn btn-secondary btn-sm">Hold</button>
          )}
          {!held && canReview && n.reviewStatus !== 'APPROVED' && (
            <button onClick={onApprove} disabled={busy} className="btn btn-primary btn-sm">Approve</button>
          )}
          {!n.read && (
            <button onClick={onRead} disabled={busy} className="btn btn-secondary btn-sm">Mark as read</button>
          )}
        </div>
      </div>
    </li>
  );
}
