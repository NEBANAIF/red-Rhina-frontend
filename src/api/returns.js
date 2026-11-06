import apiClient from './client.js';

/** payload: { saleId, items: [{ saleBatchAllocationId, quantity, restock }] } - mirrors CreateCustomerReturnRequest. */
export function createCustomerReturn(payload) {
  return apiClient.post('/returns/customer', payload).then((res) => res.data);
}

export function searchCustomerReturns({ scope = 'ALL', branchId, saleId, customerId, from, to, fromAt, toAt, search, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/returns/customer', { params: {
        scope, branchId, saleId, customerId, search, page, size,
        from: fromAt || (from ? `${from}T00:00:00Z` : undefined),
        to: toAt || (to ? `${to}T23:59:59.999Z` : undefined),
      },
    })
    .then((res) => res.data);
}

export function getCustomerReturn(id) {
  return apiClient.get(`/returns/customer/${id}`).then((res) => res.data);
}

/** payload: { purchaseOrderId, items: [{ purchaseOrderItemId, quantity }] } - mirrors CreateSupplierReturnRequest. */
export function createSupplierReturn(payload) {
  return apiClient.post('/returns/supplier', payload).then((res) => res.data);
}

export function searchSupplierReturns({ scope = 'ALL', branchId, supplierId, purchaseOrderId, from, to, fromAt, toAt, search, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/returns/supplier', { params: {
        scope, branchId, supplierId, purchaseOrderId, search, page, size,
        from: fromAt || (from ? `${from}T00:00:00Z` : undefined),
        to: toAt || (to ? `${to}T23:59:59.999Z` : undefined),
      },
    })
    .then((res) => res.data);
}

export function getSupplierReturn(id) {
  return apiClient.get(`/returns/supplier/${id}`).then((res) => res.data);
}
