import apiClient from './client.js';

export function searchCustomers(search, activeOnly = true) {
  return apiClient.get('/customers', { params: { search, activeOnly } }).then((res) => res.data);
}

export function createCustomer(customer) {
  return apiClient.post('/customers', customer).then((res) => res.data);
}

export function updateCustomer(id, customer) {
  return apiClient.put(`/customers/${id}`, customer).then((res) => res.data);
}

export function setCustomerActive(id, active) {
  return apiClient.patch(`/customers/${id}/status`, null, { params: { active } }).then((res) => res.data);
}

export function getCustomerBalance(id) {
  return apiClient.get(`/customers/${id}/balance`).then((res) => res.data);
}
