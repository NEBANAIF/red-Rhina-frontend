import apiClient from './client.js';

/** The business's own credits and loans (money it owes). Separate from customer loans (api/loans.js). */
export function searchDebts({ type, status, outstandingOnly, overdueOnly, search, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/debts', { params: { type, status, outstandingOnly, overdueOnly, search, page, size } })
    .then((res) => res.data);
}

export function getDebtSummary() {
  return apiClient.get('/debts/summary').then((res) => res.data);
}

export function getDebt(id) {
  return apiClient.get(`/debts/${id}`).then((res) => res.data);
}

/** payload: { lenderName, debtType, description, principalAmount, interestAmount, startDate, dueDate, notes } */
export function createDebt(payload) {
  return apiClient.post('/debts', payload).then((res) => res.data);
}

export function updateDebt(id, payload) {
  return apiClient.put(`/debts/${id}`, payload).then((res) => res.data);
}

/** payload: { amount, paymentDate, method, reference, note } */
export function recordDebtPayment(id, payload) {
  return apiClient.post(`/debts/${id}/payments`, payload).then((res) => res.data);
}
