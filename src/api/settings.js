import apiClient from './client.js';

/** { appName } - no sign-in needed; the login screen shows the app name. */
export function getPublicSettings() {
  return apiClient.get('/settings/public').then((res) => res.data);
}

/** { lockCostPrice, hideOutOfStockAtPos, appName } - readable by any signed-in user. */
export function getSettings() {
  return apiClient.get('/settings').then((res) => res.data);
}

/** { lockCostPrice, hideOutOfStockAtPos, appName } - requires SETTINGS_MANAGE server-side. */
export function updateSettings(settings) {
  return apiClient.put('/settings', settings).then((res) => res.data);
}
