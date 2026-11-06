import apiClient from './client.js';

/** GET /api/banks - every bank with its account number, active or not. Needs BANK_VIEW. */
export function listBanks() {
  return apiClient.get('/banks').then((res) => res.data);
}

/**
 * GET /api/banks/options - active banks only, for dropdowns: [{ id, name, accountEnding }].
 * No full account numbers, so anyone who takes payments can use it.
 */
export function listBankOptions() {
  return apiClient.get('/banks/options').then((res) => res.data);
}

/** { name, accountName, accountNumber, notes } - needs BANK_MANAGE. */
export function createBank(bank) {
  return apiClient.post('/banks', bank).then((res) => res.data);
}

export function updateBank(id, bank) {
  return apiClient.put(`/banks/${id}`, bank).then((res) => res.data);
}

/** Banks are switched off, never deleted - payments refer to them. */
export function setBankActive(id, active) {
  return apiClient.patch(`/banks/${id}/status`, { active }).then((res) => res.data);
}
