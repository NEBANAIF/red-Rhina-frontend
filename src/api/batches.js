import apiClient from './client.js';

/** Every stock receipt with preserved cost - the source of truth for stock and COGS (spec section 8). */
export function searchBatches({ scope = 'ALL', branchId, productId, from, to, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/batches', { params: { scope, branchId, productId, from, to, page, size } })
    .then((res) => res.data);
}

/**
 * GET /api/batches/available - batches of one product that still have stock at
 * one branch, oldest first. What the POS offers when a cashier wants to sell
 * from a specific batch instead of the default oldest-first.
 */
export function listAvailableBatches({ productId, branchId }) {
  return apiClient.get('/batches/available', { params: { productId, branchId } }).then((res) => res.data);
}
