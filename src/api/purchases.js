import apiClient from './client.js';

/**
 * Besides the usual filters: purchaseType (LOCAL | GLOBAL), originCountry, destinationCountry, currentCountry,
 * warehouseId (the receiving branch), shipmentStatus (NOT_SHIPPED | IN_TRANSIT | ARRIVED | DELAYED), arrivalMonth
 * (1-12) and arrivalYear.
 */
export function searchPurchaseOrders({
  scope = 'ALL', branchId, supplierId, status, search, productId, from, to,
  purchaseType, originCountry, destinationCountry, currentCountry, warehouseId, shipmentStatus, arrivalMonth, arrivalYear,
  page = 0, size = 20,
} = {}) {
  return apiClient
    .get('/purchases', {
      params: {
        scope, branchId, supplierId, status, search, productId, from, to,
        purchaseType, originCountry, destinationCountry, currentCountry, warehouseId, shipmentStatus, arrivalMonth, arrivalYear,
        page, size, sort: 'createdAt,desc',
      },
    })
    .then((res) => res.data);
}

export function getPurchaseOrder(id) {
  return apiClient.get(`/purchases/${id}`).then((res) => res.data);
}

/**
 * { supplierId, branchId, orderDate, items: [{productId, quantity, unitCost}] } for a local purchase. A global one
 * adds purchaseType: 'GLOBAL', originCountry, destinationCountry, shippingMethod, currency, exchangeRate, shippingCost,
 * expectedArrivalDate and stages: [{country, location, arrivalDate, departureDate, status, notes}].
 */
export function createPurchaseOrder(order) {
  return apiClient.post('/purchases', order).then((res) => res.data);
}

export function submitPurchaseOrder(id) {
  return apiClient.post(`/purchases/${id}/submit`).then((res) => res.data);
}

export function approvePurchaseOrder(id) {
  return apiClient.post(`/purchases/${id}/approve`).then((res) => res.data);
}

export function cancelPurchaseOrder(id) {
  return apiClient.post(`/purchases/${id}/cancel`).then((res) => res.data);
}

/**
 * { items: [{purchaseOrderItemId, quantityReceived}], receivedDate?, note?, requestId? }. requestId is a fresh UUID per
 * receive dialog: sending the same one twice is refused, so one delivery can never be booked in twice.
 */
export function receivePurchaseOrder(id, request) {
  return apiClient.post(`/purchases/${id}/receive`, request).then((res) => res.data);
}

/**
 * Replaces the route and shipment details of a global purchase:
 * { shippingMethod, shippingCost, expectedArrivalDate, currency, exchangeRate, stages: [...] }.
 * Only moves the shipment along - it never changes stock.
 */
export function updatePurchaseShipment(id, request) {
  return apiClient.put(`/purchases/${id}/shipment`, request).then((res) => res.data);
}
