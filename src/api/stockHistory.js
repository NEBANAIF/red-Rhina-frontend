import apiClient from './client.js';

export function searchStockHistory({ scope = 'ALL', branchId, productId, movementType, from, to, fromAt, toAt, page = 0, size = 25 } = {}) {
  return apiClient
    .get('/stock-history', {
      params: {
        scope, branchId, productId, movementType,
        from: fromAt || (from ? `${from}T00:00:00Z` : undefined),
        to: toAt || (to ? `${to}T23:59:59.999Z` : undefined),
        page, size, sort: 'occurredAt,desc',
      },
    })
    .then((res) => res.data);
}
