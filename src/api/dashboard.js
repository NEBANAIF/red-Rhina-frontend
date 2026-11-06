import apiClient from './client.js';

/** scope: 'ALL' | 'STORES' | 'WAREHOUSES' | 'FACTORIES' | 'SPECIFIC'; from/to: 'YYYY-MM-DD' strings, both optional (server defaults to today). */
export function fetchDashboardSummary({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient
    .get('/dashboard/summary', { params: { scope, branchId, from, to } })
    .then((res) => res.data);
}
