import apiClient from './client.js';

/**
 * Which products belong at a branch (the checklist on the Branch Products page). A product with
 * no row for a branch is invisible there - left out of that branch's product list, POS, purchases,
 * batches, and transfers to or from it. Requires BRANCH_MANAGE.
 *
 * Each row: { productId, productName, sku, unit, allowed } - allowed = ticked = belongs there.
 */
export function getProductBranchChecklist({ branchId, search, page = 0, size = 50 } = {}) {
  return apiClient
    .get('/product-branches', { params: { branchId, search, page, size } })
    .then((res) => res.data);
}

/** true = tick (belongs at this branch), false = untick (doesn't). */
export function setProductBranchAllowed(productId, branchId, allowed) {
  return apiClient.put(`/product-branches/${productId}/${branchId}`, { allowed });
}
