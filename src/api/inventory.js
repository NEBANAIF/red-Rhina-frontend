import apiClient from './client.js';

/**
 * GET /api/inventory/overview - the whole Product x Branch matrix in one
 * call (no pagination server-side; this is meant to be read as one
 * screen, not paged - see StockOverviewResponse). Returns
 * { branches: [{branchId, branchName, branchType}], rows: [{productId,
 * productName, sku, quantityByBranch: {branchId: qty}, total}] }.
 */
export function getInventoryOverview({ scope = 'ALL', branchId } = {}) {
  return apiClient.get('/inventory/overview', { params: { scope, branchId } }).then((res) => res.data);
}

/**
 * GET /api/inventory/costs - VIEW_COSTS or VIEW_INVENTORY_VALUE required server-side.
 * Cost and stock value derived from the batches still in stock, for the
 * selected branch scope. Returns { totalStockValue, rows: [{ productId,
 * quantityOnHand, oldestCost, latestCost, stockValue }] } - products with no
 * stock have no row.
 */
export function getProductCosts({ scope = 'ALL', branchId } = {}) {
  return apiClient.get('/inventory/costs', { params: { scope, branchId } }).then((res) => res.data);
}

/**
 * PATCH /api/inventory/products/{productId}/cost - STOCK_ADJUST permission
 * required server-side. Corrects the cost recorded on the product's oldest
 * in-stock batch (what the Products table shows as "Oldest cost") - the
 * "ask around, then fix it" half of Settings > Inventory > Lock cost price.
 * `scope`/`branchId` should mirror the branch selector the rest of the page
 * is using, same as getProductCosts.
 */
export function correctProductCost(productId, costPrice, { scope = 'ALL', branchId } = {}) {
  return apiClient
    .patch(`/inventory/products/${productId}/cost`, { costPrice }, { params: { scope, branchId } })
    .then((res) => res.data);
}
