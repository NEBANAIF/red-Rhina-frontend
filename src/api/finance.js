import apiClient from './client.js';

export function getPnL({ scope = 'ALL', branchId, from, to } = {}) {
  return apiClient.get('/finance/pnl', { params: { scope, branchId, from, to } }).then((res) => res.data);
}

export function searchFinancialTransactions({ scope = 'ALL', branchId, type, from, to, page = 0, size = 25 } = {}) {
  return apiClient
    .get('/finance/transactions', { params: { scope, branchId, type, from, to, page, size } })
    .then((res) => res.data);
}
