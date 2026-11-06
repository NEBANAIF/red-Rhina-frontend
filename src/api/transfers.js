import apiClient from './client.js';

export function searchTransfers({ scope = 'ALL', branchId, status, search, productId, from, to, fromAt, toAt, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/transfers', { params: {
        scope, branchId, status, search, productId, page, size, sort: 'createdAt,desc',
        // fromAt / toAt are exact instants (the page's own local days); from / to are plain dates read as UTC.
        from: fromAt || (from ? `${from}T00:00:00Z` : undefined),
        to: toAt || (to ? `${to}T23:59:59.999Z` : undefined),
      },
    })
    .then((res) => res.data);
}

export function getTransfer(id) {
  return apiClient.get(`/transfers/${id}`).then((res) => res.data);
}

/** { sourceBranchId, destinationBranchId, items: [{productId, quantity}] } */
export function createTransfer(transfer) {
  return apiClient.post('/transfers', transfer).then((res) => res.data);
}

export function approveTransfer(id) {
  return apiClient.post(`/transfers/${id}/approve`).then((res) => res.data);
}

export function rejectTransfer(id, reason) {
  return apiClient.post(`/transfers/${id}/reject`, { reason }).then((res) => res.data);
}

export function cancelTransfer(id) {
  return apiClient.post(`/transfers/${id}/cancel`).then((res) => res.data);
}

/** Source branch releases stock - this is when FIFO consumption actually happens. */
export function dispatchTransfer(id) {
  return apiClient.post(`/transfers/${id}/dispatch`).then((res) => res.data);
}

/** Destination branch confirms arrival - new batches created there, preserving original cost. */
export function receiveTransfer(id) {
  return apiClient.post(`/transfers/${id}/receive`).then((res) => res.data);
}
