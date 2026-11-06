import apiClient from './client.js';

export function listSuppliers(includeInactive = false) {
  return apiClient.get('/suppliers', { params: { includeInactive } }).then((res) => res.data);
}

export function getSupplier(id) {
  return apiClient.get(`/suppliers/${id}`).then((res) => res.data);
}

export function getSupplierBalance(id) {
  return apiClient.get(`/suppliers/${id}/balance`).then((res) => res.data);
}

export function createSupplier(supplier) {
  return apiClient.post('/suppliers', supplier).then((res) => res.data);
}

export function updateSupplier(id, supplier) {
  return apiClient.put(`/suppliers/${id}`, supplier).then((res) => res.data);
}

export function setSupplierActive(id, active) {
  return apiClient.patch(`/suppliers/${id}/status`, null, { params: { active } }).then((res) => res.data);
}
