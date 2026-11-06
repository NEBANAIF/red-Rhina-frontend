import React from 'react';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import { formatMoney } from '../../utils/format.js';
import { label, minutes } from './hrCommon.jsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const payslipPeriod = (p) => `${MONTHS[p.month - 1]} ${p.year}`;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Opens the browser's print dialog for one payslip (choose "Save as PDF" there to keep a PDF). */
export function printPayslip(p, appName = '') {
  const rows = (list) => list.map((e) => `<tr><td>${esc(e.label)}<div class="d">${esc(e.detail)}</div></td><td class="r">${esc(formatMoney(e.amount))}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(p.employeeName)} ${esc(payslipPeriod(p))}</title>
<style>body{font-family:Arial,sans-serif;color:#222;margin:32px;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#555}
table{width:100%;border-collapse:collapse}td{padding:5px 0;border-bottom:1px solid #e5e5e5;vertical-align:top}.r{text-align:right;white-space:nowrap}.d{font-size:11px;color:#777}
.tot td{font-weight:bold;border-top:2px solid #999}.net{margin-top:16px;padding:12px;background:#f2f6f2;font-size:16px;font-weight:bold;display:flex;justify-content:space-between}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:12px}.meta span{color:#777}.foot{margin-top:24px;font-size:11px;color:#777}</style></head><body>
<h1>${esc(appName)} — Payslip</h1><div>${esc(payslipPeriod(p))} · ${esc(p.branchName)}</div>
<div class="meta"><div><span>Employee</span> ${esc(p.employeeName)} (${esc(p.employeeNumber)})</div><div><span>Position</span> ${esc(p.jobTitle || '—')}</div>
<div><span>Department</span> ${esc(p.departmentName || '—')}</div><div><span>Hired</span> ${esc(p.hireDate)}</div>
<div><span>Overtime</span> ${esc(minutes(p.overtimeMinutes))}</div><div><span>Absent days</span> ${esc(Number(p.absentDays) + p.unpaidLeaveDays)}</div></div>
<h2>Earnings</h2><table>${rows(p.earnings)}<tr class="tot"><td>Total earnings</td><td class="r">${esc(formatMoney(p.totalEarnings))}</td></tr></table>
<h2>Deductions</h2><table>${p.deductions.length ? rows(p.deductions) : '<tr><td>None</td><td class="r">—</td></tr>'}<tr class="tot"><td>Total deductions</td><td class="r">${esc(formatMoney(p.totalDeductions))}</td></tr></table>
<div class="net"><span>Net pay</span><span>${esc(formatMoney(p.netPay))}</span></div>
<div class="foot">Status: ${esc(label(p.runStatus))}${p.paidOn ? ` · Paid ${esc(p.paidOn)} by ${esc(label(p.paymentMethod))}${p.paymentReference ? ` (${esc(p.paymentReference)})` : ''}` : ''}
<br>Prepared by ${esc(p.preparedBy)}${p.approvedBy ? ` · Approved by ${esc(p.approvedBy)}` : ''}</div>
<script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function Lines({ title, list, total, tone }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {list.length === 0 && <tr><td className="py-1 text-ink-400">None</td><td /></tr>}
          {list.map((e, i) => (
            <tr key={`${e.label}-${i}`} className="border-b border-cream-200 align-top">
              <td className="py-1.5 pr-2 text-ink-900">{e.label}{e.detail && <span className="block text-[11px] text-ink-400">{e.detail}</span>}</td>
              <td className={`py-1.5 text-right ${tone}`}>{formatMoney(e.amount)}</td>
            </tr>
          ))}
          <tr className="font-semibold"><td className="py-1.5">Total {title.toLowerCase()}</td><td className="py-1.5 text-right">{formatMoney(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** One payslip: every earning and deduction, so earnings − deductions = net pay can be checked at a glance. */
export function PayslipModal({ payslip, appName, onClose }) {
  return (
    <Modal open title={payslip ? `Payslip – ${payslip.employeeName} – ${payslipPeriod(payslip)}` : 'Payslip'} onClose={onClose} wide>
      {!payslip && <LoadingState />}
      {payslip && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={payslip.runStatus} />
            <span className="text-xs text-ink-500">
              {payslip.employeeNumber} · {payslip.jobTitle || '—'} · {payslip.departmentName || 'No department'} · {payslip.branchName}
            </span>
          </div>
          {payslip.warning && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">⚠ {payslip.warning}</p>}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Lines title="Earnings" list={payslip.earnings} total={payslip.totalEarnings} tone="text-emerald-700" />
            <Lines title="Deductions" list={payslip.deductions} total={payslip.totalDeductions} tone="text-red-700" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-cream-100 px-4 py-3 text-base font-semibold">
            <span>Net pay</span><span>{formatMoney(payslip.netPay)}</span>
          </div>
          <p className="text-xs text-ink-500">
            Taxable income {formatMoney(payslip.taxableIncome)} · employer pension (company cost) {formatMoney(payslip.employerPension)}
            {payslip.paidOn ? ` · paid ${payslip.paidOn} by ${label(payslip.paymentMethod)}${payslip.paymentReference ? ` (${payslip.paymentReference})` : ''}` : ''}
            <br />Prepared by {payslip.preparedBy}{payslip.submittedBy ? ` · submitted by ${payslip.submittedBy}` : ''}{payslip.approvedBy ? ` · approved by ${payslip.approvedBy}` : ''}
          </p>
          <div className="flex justify-end gap-2 border-t border-cream-200 pt-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => printPayslip(payslip, appName)}>Print / Save as PDF</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
