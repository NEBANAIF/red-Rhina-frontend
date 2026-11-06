import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useNotificationCounts } from '../notifications/NotificationCountsContext.jsx';
import Icon from './Icon.jsx';

/** The bell in the top bar: red number = unread notifications. Opens the Notifications page. */
export default function NotificationBell() {
  const { hasPermission } = useAuth();
  const { counts } = useNotificationCounts();
  const navigate = useNavigate();
  if (!hasPermission('ACTIVITY_VIEW')) return null;

  const unread = counts?.unread ?? 0;
  const toReview = counts?.toReview ?? 0;
  const label = `Notifications: ${unread} unread, ${toReview} waiting for review`;

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className="btn-icon relative"
      title={label}
      aria-label={label}
    >
      <Icon name="bell" size={18} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-white tabular-nums">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
