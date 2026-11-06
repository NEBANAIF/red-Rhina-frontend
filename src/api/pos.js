import apiClient from './client.js';

/**
 * Mirrors CheckoutRequest exactly (see pos/dto/CheckoutRequest.java):
 * { branchId, customerId, items: [{productId, quantity, unitPrice}],
 *   discountAmount, paymentMethod, amountPaid, bankName, accountReference,
 *   loanDueDate }
 * The backend is the sole authority on stock and totals - this call
 * either fully succeeds (returns the completed SaleResponse) or fails
 * atomically with nothing partially applied.
 */
export function checkout(payload) {
  return apiClient.post('/pos/checkout', payload).then((res) => res.data);
}
