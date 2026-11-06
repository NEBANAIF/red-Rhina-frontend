import apiClient from './client.js';

export function listMeetings({ status, from, to, mine } = {}) {
  return apiClient.get('/meetings', { params: { status, from, to, mine } }).then((res) => res.data);
}
export function getMeeting(id) {
  return apiClient.get(`/meetings/${id}`).then((res) => res.data);
}
/** Active employees that can be invited: [{ id, employeeNumber, name, jobTitle, departmentName, branchName }] (needs MEETING_MANAGE) */
export function listPeople() {
  return apiClient.get('/meetings/people').then((res) => res.data);
}
export function listMyActions() {
  return apiClient.get('/meetings/my-actions').then((res) => res.data);
}
/** payload: { title, location?, startAt ISO, endAt ISO, organizerId?, agenda: [{ topic, durationMinutes?, presenterId? }] (at least one),
 *  participants: [{ employeeId, required? }], actions?: [{ title, details?, assigneeId, dueDate? }] } */
export function saveMeeting(id, payload) {
  return (id ? apiClient.put(`/meetings/${id}`, payload) : apiClient.post('/meetings', payload)).then((res) => res.data);
}
export function startMeeting(id) {
  return apiClient.post(`/meetings/${id}/start`).then((res) => res.data);
}
export function completeMeeting(id, minutes) {
  return apiClient.post(`/meetings/${id}/complete`, { minutes }).then((res) => res.data);
}
export function cancelMeeting(id, reason) {
  return apiClient.post(`/meetings/${id}/cancel`, { reason }).then((res) => res.data);
}
/** response: ACCEPTED | DECLINED */
export function respondToMeeting(id, response) {
  return apiClient.post(`/meetings/${id}/respond`, { response }).then((res) => res.data);
}
/** response: ATTENDED | ABSENT */
export function recordMeetingAttendance(id, employeeId, response) {
  return apiClient.post(`/meetings/${id}/attendance`, { employeeId, response }).then((res) => res.data);
}
export function addMeetingAction(id, payload) {
  return apiClient.post(`/meetings/${id}/actions`, payload).then((res) => res.data);
}
export function updateMeetingAction(id, actionId, payload) {
  return apiClient.put(`/meetings/${id}/actions/${actionId}`, payload).then((res) => res.data);
}
export function deleteMeetingAction(id, actionId) {
  return apiClient.delete(`/meetings/${id}/actions/${actionId}`).then((res) => res.data);
}
/** status: OPEN | IN_PROGRESS | DONE */
export function setMeetingActionStatus(id, actionId, status) {
  return apiClient.post(`/meetings/${id}/actions/${actionId}/status`, { status }).then((res) => res.data);
}
