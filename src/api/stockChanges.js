import apiClient from './client.js';

/**
 * Manual stock changes are HELD: nothing moves until someone with "Approve stock changes" approves.
 *
 * submit: { changeType: 'ADD_BATCH' | 'REMOVE_STOCK' | 'EDIT_BATCH', productId, branchId, quantity,
 *   costPrice (ADD_BATCH), receivedDate? (ADD_BATCH), movementType: 'ADJUSTMENT' | 'DAMAGED' | 'LOST' (REMOVE_STOCK),
 *   batchId? (REMOVE_STOCK - omit for oldest first), note (required for REMOVE_STOCK) }
 * EDIT_BATCH: { batchId, productId, branchId, quantity (the batch's own), batchNumber, costPrice?, expiryDate? } - the
 * values the batch should have once approved. Needs BATCH_CREATE or STOCK_ADJUST.
 * ADD_BATCH needs BATCH_CREATE, REMOVE_STOCK needs STOCK_ADJUST (all server-side).
 */
export function submitStockChange(change) {
  return apiClient.post('/stock-changes', change).then((res) => res.data);
}

/**
 * status PENDING (default) | APPROVED | REJECTED. Each item: { id, changeType, status, productName, sku, unit,
 * branchName, quantity, costPrice (only if allowed to see it), receivedDate, movementType, batchNumber, note,
 * requestedByName, requestedAt, reviewedByName, reviewedAt, reviewNote, mine }
 */
export function listStockChanges({ status = 'PENDING', page = 0, size = 50 } = {}) {
  return apiClient.get('/stock-changes', { params: { status, page, size } }).then((res) => res.data);
}

/** STOCK_APPROVE: this is the moment the stock actually moves. Fails (and stays pending) if it can no longer be applied. */
export function approveStockChange(id) {
  return apiClient.post(`/stock-changes/${id}/approve`).then((res) => res.data);
}

/** STOCK_APPROVE, or the person who entered it: discard it - the stock never moves. */
export function rejectStockChange(id, note) {
  return apiClient.post(`/stock-changes/${id}/reject`, { note }).then((res) => res.data);
}
