import apiClient from './client.js';

export function searchUsers({ branchId, role, search, active, from, to, fromAt, toAt, page = 0, size = 20 } = {}) {
  return apiClient.get('/users', {
    params: {
      branchId, role, search, active, page, size,
      from: fromAt || (from ? `${from}T00:00:00Z` : undefined),
      to: toAt || (to ? `${to}T23:59:59.999Z` : undefined),
    },
  }).then((res) => res.data);
}

export function getUser(id) {
  return apiClient.get(`/users/${id}`).then((res) => res.data);
}

/** { name, email, phone, password, roleId, branchId } - roleId is any role from the Roles page. */
export function createUser(user) {
  return apiClient.post('/users', user).then((res) => res.data);
}

/** { name, phone, roleId, branchId } - no email/password here, see UpdateUserRequest's javadoc. */
export function updateUser(id, user) {
  return apiClient.put(`/users/${id}`, user).then((res) => res.data);
}

export function setUserActive(id, active) {
  return apiClient.patch(`/users/${id}/status`, { active }).then((res) => res.data);
}

export function resetUserPassword(id, newPassword) {
  return apiClient.post(`/users/${id}/reset-password`, { newPassword });
}

/**
 * Create a login with a generated temporary password that is e-mailed.
 * { employeeId?, name, email, confirmEmail, phone?, username, roleId, branchId? }
 * Returns { created, email, username, roleName, emailSent, temporaryPassword (only when the e-mail could not be sent), message }.
 */
export function provisionUser(payload) {
  return apiClient.post('/users/provision', payload).then((res) => res.data);
}

/** New temporary credentials for a user who has not chosen their own password yet. */
export function reissueCredentials(id) {
  return apiClient.post(`/users/${id}/reissue-credentials`).then((res) => res.data);
}

export function suggestUsername(name) {
  return apiClient.get('/users/suggest-username', { params: { name } }).then((res) => res.data.username);
}

/** Sends a test e-mail: { sent, message } - message explains the problem when it could not be sent. */
export function sendTestEmail(to) {
  return apiClient.post('/users/test-email', { to }).then((res) => res.data);
}

/** { source: 'app' | 'file' | 'none', configured, username, hasPassword } */
export function getMailSettings() {
  return apiClient.get('/users/mail-settings').then((res) => res.data);
}

/** { username (SMTP login), password (SMTP key / app password; blank keeps the saved one), host, port, fromAddress } */
export function saveMailSettings(payload) {
  return apiClient.put('/users/mail-settings', payload).then((res) => res.data);
}
