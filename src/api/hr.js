import apiClient from './client.js';

// ---- overview, employees
export function getHrOverview({ scope, branchId } = {}) {
  return apiClient.get('/hr/overview', { params: { scope, branchId } }).then((res) => res.data);
}
export function listEmployees({ search, type, departmentId, status, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/hr/employees', { params: { search, type, departmentId, status, page, size, scope, branchId } }).then((res) => res.data);
}
export function getEmployee(id) {
  return apiClient.get(`/hr/employees/${id}`).then((res) => res.data);
}
/** payload: { fullName, employeeType, hireDate, branchId, jobTitle?, phone?, email?, address?, emergencyContact?, departmentId?, defaultShiftId?,
 *  annualLeaveDays?, notes?, status?, terminationDate?, monthlySalary? / commissionRate? (only taken when you may see salaries) } */
export function createEmployee(payload) {
  return apiClient.post('/hr/employees', payload).then((res) => res.data);
}
export function updateEmployee(id, payload) {
  return apiClient.put(`/hr/employees/${id}`, payload).then((res) => res.data);
}
/** Logins not yet linked to an employee: [{ id, name, email, role, branchName }] */
export function listLinkableUsers() {
  return apiClient.get('/hr/linkable-users').then((res) => res.data);
}
/** Active employees without a login: [{ id, fullName, email, phone, branchId, branchName, positionTitle, level, accessRoleId }] */
export function listLinkableEmployees() {
  return apiClient.get('/hr/linkable-employees').then((res) => res.data);
}
/** Move to another location: { branchId, effectiveDate?, note? } */
export function assignEmployee(id, payload) {
  return apiClient.post(`/hr/employees/${id}/assign`, payload).then((res) => res.data);
}

// ---- departments and shifts
export function listDepartments() {
  return apiClient.get('/hr/departments').then((res) => res.data);
}
export function saveDepartment(id, payload) {
  return (id ? apiClient.put(`/hr/departments/${id}`, payload) : apiClient.post('/hr/departments', payload)).then((res) => res.data);
}
export function listShifts() {
  return apiClient.get('/hr/shifts').then((res) => res.data);
}
/** payload: { name, startTime 'HH:mm', endTime 'HH:mm', breakMinutes?, active? } */
export function saveShift(id, payload) {
  return (id ? apiClient.put(`/hr/shifts/${id}`, payload) : apiClient.post('/hr/shifts', payload)).then((res) => res.data);
}

// ---- attendance
export function getAttendanceSheet({ date, search, scope, branchId } = {}) {
  return apiClient.get('/hr/attendance/sheet', { params: { date, search, scope, branchId } }).then((res) => res.data);
}
export function getAttendanceHistory(employeeId, { from, to } = {}) {
  return apiClient.get(`/hr/attendance/employee/${employeeId}`, { params: { from, to } }).then((res) => res.data);
}
/** payload: { employeeId, workDate, status?, shiftId?, checkIn? 'HH:mm', checkOut? 'HH:mm', note? } */
export function recordAttendance(payload) {
  return apiClient.post('/hr/attendance', payload).then((res) => res.data);
}

// ---- leave
export function listLeave({ status, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/hr/leave', { params: { status, page, size, scope, branchId } }).then((res) => res.data);
}
/** payload: { employeeId, leaveType, startDate, endDate, reason? } */
export function createLeave(payload) {
  return apiClient.post('/hr/leave', payload).then((res) => res.data);
}
export function approveLeave(id, note) {
  return apiClient.post(`/hr/leave/${id}/approve`, { note }).then((res) => res.data);
}
export function rejectLeave(id, note) {
  return apiClient.post(`/hr/leave/${id}/reject`, { note }).then((res) => res.data);
}
export function cancelLeave(id) {
  return apiClient.post(`/hr/leave/${id}/cancel`).then((res) => res.data);
}

// ---- payroll
export function getPayrollSettings() {
  return apiClient.get('/hr/payroll/settings').then((res) => res.data);
}
/** payload: { overtimeMultiplier, workingDaysPerMonth, hoursPerDay, employeePensionRate?, employerPensionRate?, taxBrackets?: [{ lowerBound, rate }] } */
export function savePayrollSettings(payload) {
  return apiClient.put('/hr/payroll/settings', payload).then((res) => res.data);
}
export function listPayrollRuns({ year, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/hr/payroll/runs', { params: { year, page, size, scope, branchId } }).then((res) => res.data);
}
export function getPayrollRun(id) {
  return apiClient.get(`/hr/payroll/runs/${id}`).then((res) => res.data);
}
/** payload: { branchId, year, month, note? } */
export function createPayrollRun(payload) {
  return apiClient.post('/hr/payroll/runs', payload).then((res) => res.data);
}
export function recalculatePayrollRun(id) {
  return apiClient.post(`/hr/payroll/runs/${id}/recalculate`).then((res) => res.data);
}
/** payload: { adjustment (+ or -), adjustmentNote? } */
export function adjustPayrollLine(runId, lineId, payload) {
  return apiClient.put(`/hr/payroll/runs/${runId}/lines/${lineId}`, payload).then((res) => res.data);
}
export function deletePayrollRun(id) {
  return apiClient.delete(`/hr/payroll/runs/${id}`).then((res) => res.data);
}
export function approvePayrollRun(id) {
  return apiClient.post(`/hr/payroll/runs/${id}/approve`).then((res) => res.data);
}
/** DRAFT > SUBMITTED */
export function submitPayrollRun(id) {
  return apiClient.post(`/hr/payroll/runs/${id}/submit`).then((res) => res.data);
}
/** SUBMITTED > DRAFT, with the reason */
export function rejectPayrollRun(id, note) {
  return apiClient.post(`/hr/payroll/runs/${id}/reject`, { note }).then((res) => res.data);
}
/** payload: { paidOn?, method? CASH|BANK_TRANSFER|MOBILE_MONEY|CHEQUE, reference? } */
export function payPayrollRun(id, payload = {}) {
  return apiClient.post(`/hr/payroll/runs/${id}/pay`, payload).then((res) => res.data);
}
/** Undo a paid payroll: the books are reversed and the run goes back to draft. payload: { reason } */
export function reversePayrollRun(id, payload) {
  return apiClient.post(`/hr/payroll/runs/${id}/reverse`, payload).then((res) => res.data);
}
/** Amounts withheld from pay (pension, income tax, other deductions) and employer pension that the company still has to hand over. */
export function listPayrollLiabilities({ status, kind, year, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/hr/payroll/liabilities', { params: { status, kind, year, page, size, scope, branchId } }).then((res) => res.data);
}
export function getPayrollLiabilitySummary({ scope, branchId } = {}) {
  return apiClient.get('/hr/payroll/liabilities/summary', { params: { scope, branchId } }).then((res) => res.data);
}
/** payload: { ids: [], paidOn?, reference? } */
export function settlePayrollLiabilities(payload) {
  return apiClient.post('/hr/payroll/liabilities/settle', payload).then((res) => res.data);
}
/** Payment history: who was paid what, when and how. */
export function listPayrollPayments({ employeeId, year, page = 0, size = 20, scope, branchId } = {}) {
  return apiClient.get('/hr/payroll/payments', { params: { employeeId, year, page, size, scope, branchId } }).then((res) => res.data);
}
export function getPayslip(lineId) {
  return apiClient.get(`/hr/payroll/lines/${lineId}/payslip`).then((res) => res.data);
}

// ---- self service (any logged-in user)
export function getMyEmployee() {
  return apiClient.get('/hr/me').then((res) => res.data);
}
export function listMyPayslips() {
  return apiClient.get('/hr/me/payslips').then((res) => res.data);
}

// ---- company hierarchy
export function listPositions() {
  return apiClient.get('/hr/positions').then((res) => res.data);
}
/** payload: { title, departmentId?, description?, active? } */
export function savePosition(id, payload) {
  return (id ? apiClient.put(`/hr/positions/${id}`, payload) : apiClient.post('/hr/positions', payload)).then((res) => res.data);
}
/** { departments: [tree], reportingTree: [tree], employees } */
export function getHierarchy({ scope, branchId } = {}) {
  return apiClient.get('/hr/hierarchy', { params: { scope, branchId } }).then((res) => res.data);
}

// ---- live attendance (real time)
export function getMyLiveStatus() {
  return apiClient.get('/hr/attendance/live/me').then((res) => res.data);
}
/** action: 'check-in' | 'check-out' | 'break/start' | 'break/end'; employeeId only for a manager acting for someone else */
export function liveAction(action, employeeId) {
  const url = employeeId ? `/hr/attendance/live/employee/${employeeId}/${action}` : `/hr/attendance/live/me/${action}`;
  return apiClient.post(url).then((res) => res.data);
}
export function getLiveBoard({ search, scope, branchId } = {}) {
  return apiClient.get('/hr/attendance/live/board', { params: { search, scope, branchId } }).then((res) => res.data);
}

/** Roles a new employee's login can be given: [{ id, name, description }] */
export function listLoginRoles() {
  return apiClient.get('/hr/login-roles').then((res) => res.data);
}

/** Who an employee of this department may report to (active people of the same department, never the employee or their own reports). */
export function listEligibleManagers(departmentId, employeeId, positionId) {
  return apiClient.get('/hr/eligible-managers', { params: { departmentId, employeeId, positionId } }).then((res) => res.data);
}
