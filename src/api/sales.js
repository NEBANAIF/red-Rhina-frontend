import apiClient from './client.js';

/**
 * SalesHistoryController.search takes `from`/`to` as full ISO instants
 * (DATE_TIME, not DATE) - date-only inputs from a <input type="date"> are
 * expanded here to start-of-day / end-of-day so callers can keep passing
 * plain 'YYYY-MM-DD' strings.
 */
export function searchSales({ scope = 'ALL', branchId, customerId, productId, paymentStatus, status, from, to, fromAt, toAt, search, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/sales', {
      params: {
        scope,
        branchId,
        customerId,
        productId,
        paymentStatus,
        status,
        // fromAt / toAt are exact instants (the page's own local days); from / to are plain dates read as UTC.
        from: fromAt || (from ? `${from}T00:00:00Z` : undefined),
        to: toAt || (to ? `${to}T23:59:59.999Z` : undefined),
        search,
        page,
        size,
        sort: 'createdAt,desc',
      },
    })
    .then((res) => res.data);
}

export function getSale(id) {
  return apiClient.get(`/sales/${id}`).then((res) => res.data);
}

export function voidSale(id, reason) {
  return apiClient.post(`/sales/${id}/void`, { reason }).then((res) => res.data);
}

/** GET /api/sales/import/template - the .xlsx to fill in with previous sales (a Blob; save it with triggerDownload from products.js). */
export function downloadSalesImportTemplate() {
  return apiClient.get('/sales/import/template', { responseType: 'blob' }).then((res) => res.data);
}

/**
 * POST /api/sales/import - needs SALES_IMPORT. defaultBranchId is used for rows with no Branch typed; recordInLedger also posts
 * the revenue, cost and cash received to the Finance ledger on each sale's date. Returns
 * { totalRows, salesImported, salesFailed, results: [{ rowNumber, invoice, success, message }] } - always 200 even when every sale
 * failed; read the summary, not the HTTP status.
 */
export function importSales(file, { defaultBranchId, recordInLedger = false } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient
    .post('/sales/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { defaultBranchId: defaultBranchId || undefined, recordInLedger },
    })
    .then((res) => res.data);
}
