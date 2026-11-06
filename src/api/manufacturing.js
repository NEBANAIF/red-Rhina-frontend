import apiClient from './client.js';

/** Bills of materials, raw materials and production orders (manufacturing). */

/**
 * One manufacturing report in a generic shape: { type, title, from, to, columns: [{ key, label, format, total }], rows: [{...}],
 * summary: [{ label, value, format }], chart: { kind: 'bar' | 'line', title, format, points: [{ label, value }] } }.
 * type: PRODUCTION | MATERIAL_CONSUMPTION | INTERNATIONAL_PURCHASES | SHIPMENT_DELAYS | PRODUCTION_COSTS | WASTE | QUALITY |
 * MACHINE_DOWNTIME | FINISHED_GOODS | DIRECT_SALES. productId / status are optional filters (where the report supports them).
 */
export function getManufacturingReport(type, { scope, branchId, from, to, productId, status } = {}) {
  return apiClient.get(`/manufacturing/reports/${type}`, { params: { scope, branchId, from, to, productId, status } }).then((res) => res.data);
}
/** Manufacturing dashboard for the picked factories. from/to: 'YYYY-MM-DD' (default: the last 30 days). */
export function getManufacturingDashboard({ scope, branchId, from, to } = {}) {
  return apiClient.get('/manufacturing/dashboard', { params: { scope, branchId, from, to } }).then((res) => res.data);
}
/** Raw materials with stock status, what open production needs, and shortfalls. */
export function getRawMaterials({ scope, branchId } = {}) {
  return apiClient.get('/manufacturing/materials', { params: { scope, branchId } }).then((res) => res.data);
}
/** "Can we make N units at this factory?" - materials required vs in stock, max producible, estimated cost. */
export function planProduction({ productId, quantity, branchId }) {
  return apiClient.get('/manufacturing/plan', { params: { productId, quantity, branchId } }).then((res) => res.data);
}

export function listBoms() {
  return apiClient.get('/manufacturing/boms').then((res) => res.data);
}
export function getBom(id) {
  return apiClient.get(`/manufacturing/boms/${id}`).then((res) => res.data);
}
/** payload: { productId, batchSize, laborCostPerBatch, overheadCostPerBatch, notes, lines: [{ materialId, quantity, calcMode: 'PER_UNIT' | 'PER_BATCH' }] } - labour/overhead per ONE production batch */
export function createBom(payload) {
  return apiClient.post('/manufacturing/boms', payload).then((res) => res.data);
}
export function updateBom(id, payload) {
  return apiClient.put(`/manufacturing/boms/${id}`, payload).then((res) => res.data);
}

export function searchProductionOrders({ status, type, search, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/production-orders', { params: { status, type, search, page, size, scope, branchId } }).then((res) => res.data);
}
export function getProductionOrder(id) {
  return apiClient.get(`/manufacturing/production-orders/${id}`).then((res) => res.data);
}
/** payload: { orderType, productId, branchId, plannedQuantity, plannedDate, customerId, customerReference, notes } */
export function createProductionOrder(payload) {
  return apiClient.post('/manufacturing/production-orders', payload).then((res) => res.data);
}
export function startProductionOrder(id) {
  return apiClient.post(`/manufacturing/production-orders/${id}/start`).then((res) => res.data);
}
export function cancelProductionOrder(id) {
  return apiClient.post(`/manufacturing/production-orders/${id}/cancel`).then((res) => res.data);
}
/**
 * payload: { destinationType: 'WAREHOUSE' | 'SHOWROOM' | 'BRANCH' | 'CUSTOMER', destinationBranchId (not for CUSTOMER), producedQuantity,
 * rejectedQuantity, laborCost?, overheadCost?, directSale?: { customerId?, customerName?, unitPrice, amountPaid?, deliveryAddress?,
 * deliveryContact?, deliveryDate?, notes? } (only for CUSTOMER) } - labour / overhead use the standard cost if left out */
export function completeProductionOrder(id, payload) {
  return apiClient.post(`/manufacturing/production-orders/${id}/complete`, payload).then((res) => res.data);
}

// ---- machines + maintenance
export function listMachines({ scope, branchId } = {}) {
  return apiClient.get('/manufacturing/machines', { params: { scope, branchId } }).then((res) => res.data);
}
export function getMachine(id) {
  return apiClient.get(`/manufacturing/machines/${id}`).then((res) => res.data);
}
/** payload: { name, code, description, branchId, status, installedDate, serviceIntervalDays, notes } */
export function createMachine(payload) {
  return apiClient.post('/manufacturing/machines', payload).then((res) => res.data);
}
export function updateMachine(id, payload) {
  return apiClient.put(`/manufacturing/machines/${id}`, payload).then((res) => res.data);
}
/** payload: { maintenanceType, maintenanceDate, description, cost, technician, downtimeHours, backInService } */
export function recordMaintenance(id, payload) {
  return apiClient.post(`/manufacturing/machines/${id}/maintenance`, payload).then((res) => res.data);
}

// ---- quality inspections
export function listInspections({ page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/inspections', { params: { page, size, scope, branchId } }).then((res) => res.data);
}
export function getQualitySummary({ scope, branchId } = {}) {
  return apiClient.get('/manufacturing/inspections/summary', { params: { scope, branchId } }).then((res) => res.data);
}
/** payload: { productionOrderId, inspectionDate, sampleSize, defectsFound, result: 'PASS' | 'FAIL', notes } */
export function recordInspection(payload) {
  return apiClient.post('/manufacturing/inspections', payload).then((res) => res.data);
}

// ---- test certificates of production batches
export function listCertificates({ page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/certificates', { params: { page, size, scope, branchId } }).then((res) => res.data);
}
/** payload: { productionOrderId, issueDate, batchReference, customerName, standardRef, remarks, lines: [{ parameter, unit, requirement, measured, result }] } */
export function issueCertificate(payload) {
  return apiClient.post('/manufacturing/certificates', payload).then((res) => res.data);
}

// ---- raw materials: catalogue, purchases, stock adjustments, factory-to-factory transfers, history (manufacturing only)

/** payload: { name, sku?, unit, reorderLevel?, active? } */
export function createRawMaterial(payload) {
  return apiClient.post('/manufacturing/materials', payload).then((res) => res.data);
}
export function updateRawMaterial(id, payload) {
  return apiClient.put(`/manufacturing/materials/${id}`, payload).then((res) => res.data);
}
/** payload: { materialId, branchId, quantityChange (+ add / - remove), reason, unitCost? (adding), batchNumber + expiryDate (REQUIRED when adding), receivedDate? (adding), batchId? (removing from one batch) } */
export function adjustRawMaterial(payload) {
  return apiClient.post('/manufacturing/materials/adjust', payload).then((res) => res.data);
}
/** payload: { materialId, fromBranchId, toBranchId, quantity, reason? } - factory to factory only */
export function transferRawMaterial(payload) {
  return apiClient.post('/manufacturing/materials/transfer', payload).then((res) => res.data);
}
export function listRawMaterialMovements({ materialId, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/material-movements', { params: { materialId, page, size, scope, branchId } }).then((res) => res.data);
}
export function listRawMaterialPurchases({ page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/material-purchases', { params: { page, size, scope, branchId } }).then((res) => res.data);
}
/** payload: { supplierId?, branchId (the factory that receives), purchaseDate?, notes?, items: [{ materialId, quantity, unitCost, batchNumber, expiryDate }] } - batch number and expiry date are required on every item */
export function createRawMaterialPurchase(payload) {
  return apiClient.post('/manufacturing/material-purchases', payload).then((res) => res.data);
}

// ---- purchase deliveries and shipments (partial deliveries, international shipments)

/** payload: { requestKey, deliveryDate?, notes?, items: [{ itemId, quantity }] } - only these quantities go into stock */
export function receiveRawMaterialDelivery(purchaseId, payload) {
  return apiClient.post(`/manufacturing/material-purchases/${purchaseId}/deliveries`, payload).then((res) => res.data);
}
/** payload: { shipmentStatus?, expectedArrival?, shippingRoute?, customsCost?, freightCost?, otherCost? } */
export function updateRawMaterialShipment(purchaseId, payload) {
  return apiClient.put(`/manufacturing/material-purchases/${purchaseId}/shipment`, payload).then((res) => res.data);
}
export function cancelRawMaterialPurchase(purchaseId) {
  return apiClient.post(`/manufacturing/material-purchases/${purchaseId}/cancel`).then((res) => res.data);
}

// ---- direct sales (finished goods sent straight from a factory to a customer)
export function listDirectSales({ page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/direct-sales', { params: { page, size, scope, branchId } }).then((res) => res.data);
}
/** payload: { amount, paidOn?, note?, requestKey } */
export function recordDirectSalePayment(id, payload) {
  return apiClient.post(`/manufacturing/direct-sales/${id}/payments`, payload).then((res) => res.data);
}
export function markDirectSaleDelivered(id, deliveredOn) {
  return apiClient.post(`/manufacturing/direct-sales/${id}/deliver`, null, { params: { deliveredOn } }).then((res) => res.data);
}

// ---- raw material batches: lot-by-lot stock, consumption history and expiry alerts
/** status: ACTIVE | EXPIRING | EXPIRED | DEPLETED | ALL */
export function listRawMaterialBatches({ materialId, status, soonDays, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/material-batches', { params: { materialId, status, soonDays, page, size, scope, branchId } }).then((res) => res.data);
}
/** { days, expiredBatches, expiredQuantity, expiredValue, expiringBatches, expiringQuantity, expiringValue, batches: [...] } */
export function getRawMaterialBatchAlerts({ days = 30, scope, branchId } = {}) {
  return apiClient.get('/manufacturing/material-batches/alerts', { params: { days, scope, branchId } }).then((res) => res.data);
}
export function listRawMaterialBatchConsumptions(batchId) {
  return apiClient.get(`/manufacturing/material-batches/${batchId}/consumptions`).then((res) => res.data);
}

/** Active employees at a factory that can be assigned to production (with or without a login). */
export function listAssignableWorkers(branchId) {
  return apiClient.get('/manufacturing/workers', { params: { branchId } }).then((res) => res.data);
}
export function getOrderWorkers(id) {
  return apiClient.get(`/manufacturing/production-orders/${id}/workers`).then((res) => res.data);
}
/** Replaces the workers of an order: employeeIds = the complete list. */
export function setOrderWorkers(id, employeeIds) {
  return apiClient.put(`/manufacturing/production-orders/${id}/workers`, { employeeIds }).then((res) => res.data);
}
