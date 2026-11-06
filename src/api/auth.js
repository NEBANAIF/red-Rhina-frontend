import apiClient from './client.js';

export function login(username, password) {
  return apiClient.post('/auth/login', { username, password }).then((res) => res.data);
}

export function fetchCurrentUser() {
  return apiClient.get('/auth/me').then((res) => res.data);
}

export function changePassword(currentPassword, newPassword) {
  return apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

/** Always succeeds (the server never says whether the account exists). */
export function forgotPassword(login) {
  return apiClient.post('/auth/forgot-password', { login });
}

export function resetPasswordWithToken(token, newPassword) {
  return apiClient.post('/auth/reset-password', { token, newPassword });
}

/** { setupRequired } - true while nobody has created the first administrator yet (public). */
export function fetchSetupStatus() {
  return apiClient.get('/setup/status').then((res) => res.data);
}
