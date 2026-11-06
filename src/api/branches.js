import apiClient from './client.js';

/** type: 'STORE' | 'WAREHOUSE' | 'FACTORY' | 'SHOWROOM' | undefined (all). Server-side scoped to what the caller can actually see. */
export function listBranches(type) {
  return apiClient.get('/branches', { params: { type } }).then((res) => res.data);
}

/**
 * Every active branch as { id, name, code, type } - for choosing the source and destination of a
 * transfer. Unlike listBranches this is NOT limited to the caller's own branch (a store has to be
 * able to name the warehouse it wants stock from), and it carries no branch details.
 */
export function listTransferBranches() {
  return apiClient.get('/branches/transfer-targets').then((res) => res.data);
}

export function getBranch(id) {
  return apiClient.get(`/branches/${id}`).then((res) => res.data);
}

/** Live figures computed from Inventory/Sales/Purchases/Expenses - not cached, never stale. */
export function getBranchStats(id) {
  return apiClient.get(`/branches/${id}/stats`).then((res) => res.data);
}

/** { name, code, type, address, phone, email } */
export function createBranch(branch) {
  return apiClient.post('/branches', branch).then((res) => res.data);
}

/** { name, address, phone, email } - type is immutable after creation, see UpdateBranchRequest's javadoc. */
export function updateBranch(id, branch) {
  return apiClient.put(`/branches/${id}`, branch).then((res) => res.data);
}

export function setBranchActive(id, active) {
  return apiClient.patch(`/branches/${id}/status`, { active }).then((res) => res.data);
}

/** userId may be null to unassign the current manager. */
export function assignBranchManager(id, userId) {
  return apiClient.patch(`/branches/${id}/manager`, { userId }).then((res) => res.data);
}
