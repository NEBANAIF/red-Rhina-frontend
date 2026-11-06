import apiClient from './client.js';

/** referenceType: 'SALE' | 'LOAN_PAYMENT' | 'SUPPLIER_PAYMENT' */
export function getPaymentsByReference(referenceType, referenceId) {
  return apiClient.get('/payments', { params: { referenceType, referenceId } }).then((res) => res.data);
}

/**
 * GET /api/payments/search - the Payments page table, newest first. Filters are all optional:
 * { scope, branchId, method, bankId, referenceType, from, to, page, size } where from/to are ISO
 * timestamps. Returns the usual page: { content, page, totalPages, totalElements, ... }.
 */
export function searchPayments(params) {
  return apiClient.get('/payments/search', { params }).then((res) => res.data);
}
