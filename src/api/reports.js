import apiClient from './client.js';

/** Every function here requires from/to (LocalDate ISO strings, e.g. '2026-01-01') - see ReportController. */

export function getBestSellingProducts({ scope = 'ALL', branchId, from, to, limit = 10 } = {}) {
  return apiClient.get('/reports/best-selling-products', { params: { scope, branchId, from, to, limit } }).then((res) => res.data);
}

export function getSlowMovingProducts({ scope = 'ALL', branchId, from, to, limit = 10 } = {}) {
  return apiClient.get('/reports/slow-moving-products', { params: { scope, branchId, from, to, limit } }).then((res) => res.data);
}

export function getSalesByProduct({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient.get('/reports/sales-by-product', { params: { scope, branchId, from, to } }).then((res) => res.data);
}

export function getSalesTrend({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient.get('/reports/sales-trend', { params: { scope, branchId, from, to } }).then((res) => res.data);
}

export function getRevenueGrowth({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient.get('/reports/revenue-growth', { params: { scope, branchId, from, to } }).then((res) => res.data);
}

export function getProfitGrowth({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient.get('/reports/profit-growth', { params: { scope, branchId, from, to } }).then((res) => res.data);
}

export function getBranchComparison({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient.get('/reports/branch-comparison', { params: { scope, branchId, from, to } }).then((res) => res.data);
}

/**
 * Current stock position, not tied to a date range:
 * { summary: { total, inStock, lowStock, outOfStock },
 *   needsAttention: [{ productId, productName, sku, unit, available, reorderLevel, status }] } -
 * needsAttention lists low / out-of-stock products, out of stock first (capped at 100).
 */
export function getStockStatusReport({ scope = 'ALL', branchId } = {}) {
  return apiClient.get('/reports/stock-status', { params: { scope, branchId } }).then((res) => res.data);
}
