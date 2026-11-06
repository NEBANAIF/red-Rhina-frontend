import apiClient from './client.js';

/**
 * tab UNREAD: what the signed-in user has not read yet (read ones disappear).
 * tab TO_REVIEW: everything still pending or on hold, read or not.
 * Each item: { id, type, title, message, branchId, branchName, actorName, referenceType, referenceId,
 *   createdAt, reviewStatus (PENDING | ON_HOLD | APPROVED), reviewedByName, reviewedAt, read }
 */
export function listNotifications({ tab = 'UNREAD', page = 0, size = 20 } = {}) {
  return apiClient.get('/notifications', { params: { tab, page, size } }).then((res) => res.data);
}

/** { unread, toReview } - what the bell shows. */
export function getNotificationCounts() {
  return apiClient.get('/notifications/counts').then((res) => res.data);
}

export function markNotificationRead(id) {
  return apiClient.post(`/notifications/${id}/read`).then((res) => res.data);
}

/** -> { marked } */
export function markAllNotificationsRead() {
  return apiClient.post('/notifications/read-all').then((res) => res.data);
}

/** ACTIVITY_REVIEW: PENDING -> ON_HOLD (someone is checking it). */
export function holdNotification(id) {
  return apiClient.post(`/notifications/${id}/hold`).then((res) => res.data);
}

/** ACTIVITY_REVIEW: PENDING / ON_HOLD -> APPROVED (checked, correct). */
export function approveNotification(id) {
  return apiClient.post(`/notifications/${id}/approve`).then((res) => res.data);
}
