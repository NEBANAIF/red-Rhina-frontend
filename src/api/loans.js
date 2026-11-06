import apiClient from './client.js';

export function searchLoans({ scope = 'ALL', branchId, customerId, status, outstandingOnly, dueFrom, dueTo, search, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/loans', { params: { scope, branchId, customerId, status, outstandingOnly, dueFrom, dueTo, search, page, size } })
    .then((res) => res.data);
}

export function getLoan(id) {
  return apiClient.get(`/loans/${id}`).then((res) => res.data);
}

/** payload: { method, amount, bankName, accountReference } - mirrors RecordLoanPaymentRequest. */
export function recordLoanPayment(loanId, payload) {
  return apiClient.post(`/loans/${loanId}/payments`, payload).then((res) => res.data);
}
