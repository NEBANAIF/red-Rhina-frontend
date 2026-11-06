import apiClient from './client.js';

/**
 * Each product comes back with availableStock and stockStatus (IN_STOCK / LOW_STOCK / OUT_OF_STOCK)
 * for the selected branches (scope/branchId - the branch selector's scopeParams).
 * stockStatus filters the list to that status.
 */
export function searchProducts({
  search, activeOnly = true, page = 0, size = 20, stockStatus, hideOutOfStock, scope, branchId, requireAtBranches,
} = {}) {
  return apiClient
    .get('/products', {
      params: { search, activeOnly, page, size, stockStatus, hideOutOfStock, scope, branchId, requireAtBranches },
      // axios needs this to send requireAtBranches=A&requireAtBranches=B rather than requireAtBranches[]=A&...
      paramsSerializer: { indexes: null },
    })
    .then((res) => res.data);
}

/** { total, inStock, lowStock, outOfStock } - active products per stock status for the selected branches. */
export function getStockSummary({ scope = 'ALL', branchId } = {}) {
  return apiClient.get('/products/stock-summary', { params: { scope, branchId } }).then((res) => res.data);
}

/** { name, sku, description, unit, reorderLevel } - no price: it is entered per sale at the POS */
export function createProduct(product) {
  return apiClient.post('/products', product).then((res) => res.data);
}

export function updateProduct(id, product) {
  return apiClient.put(`/products/${id}`, product).then((res) => res.data);
}

export function deactivateProduct(id) {
  return apiClient.delete(`/products/${id}`);
}

/**
 * GET /api/products/import/template - downloads the .xlsx a person fills in
 * with existing product data and re-uploads via importProducts(). Returns
 * a Blob; the caller turns it into a download (see triggerDownload below).
 */
export function downloadImportTemplate() {
  return apiClient
    .get('/products/import/template', { responseType: 'blob' })
    .then((res) => res.data);
}

/** Saves a Blob the browser gave us (e.g. from downloadImportTemplate) as a file. */
export function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * POST /api/products/import - PRODUCT_CREATE and STOCK_ADJUST required
 * server-side (a row can both create a product and record its opening
 * stock). Returns { totalRows, created, failed, rows: [{ rowNumber, sku,
 * success, message }] } - always 200, even when every row failed; check
 * the summary, not the HTTP status, to see what happened.
 */
export function importProducts(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient
    .post('/products/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data);
}
