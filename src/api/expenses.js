import apiClient from './client.js';

/**
 * Note: listing requires EXPENSE_VIEW (managers only) - EXPENSE_CREATE
 * alone (held by every branch role) is not enough to call this. A caller
 * with only EXPENSE_CREATE will get a 403 here even though createExpense
 * below works fine for them - see ExpenseController's javadoc. The
 * Expenses page handles that split explicitly rather than assuming
 * everyone who can log an expense can also browse them.
 */
export function searchExpenses({ scope = 'ALL', branchId, category, from, to, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/expenses', { params: { scope, branchId, category, from, to, page, size, sort: 'expenseDate,desc' } })
    .then((res) => res.data);
}

/** { branchId, category, amount, description, expenseDate, paymentMethod, reference } */
export function createExpense(expense) {
  return apiClient.post('/expenses', expense).then((res) => res.data);
}
