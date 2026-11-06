import React, { useEffect, useState } from 'react';
import { listMyPayslips, getMyEmployee } from '../../api/hr.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAppName } from '../../config/BrandContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Badge from '../../components/Badge.jsx';
import { formatMoney } from '../../utils/format.js';
import { PayslipModal, payslipPeriod } from './Payslip.jsx';

/** The logged-in user's own payslips (approved or paid months only): open any month, print it or save it as a PDF. */
export default function MyPayslipsPage() {
  const { appName } = useAppName();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = () => {
    setError('');
    Promise.all([getMyEmployee(), listMyPayslips()])
      .then(([m, list]) => { setMe(m); setRows(list); })
      .catch((e) => setError(extractErrorMessage(e)));
  };
  useEffect(load, []);

  const columns = [
    { key: 'period', header: 'Month', render: (r) => <span className="font-medium text-ink-900">{payslipPeriod(r)}</span> },
    { key: 'totalEarnings', header: 'Earnings', render: (r) => formatMoney(r.totalEarnings), className: 'text-right' },
    { key: 'totalDeductions', header: 'Deductions', render: (r) => formatMoney(r.totalDeductions), className: 'text-right' },
    { key: 'netPay', header: 'Net pay', render: (r) => <span className="font-semibold">{formatMoney(r.netPay)}</span>, className: 'text-right' },
    { key: 'runStatus', header: 'Status', render: (r) => <Badge status={r.runStatus} /> },
    { key: 'paidOn', header: 'Paid on', render: (r) => r.paidOn ?? '—' },
  ];

  return (
    <div>
      <h1 className="page-title">My Payslips</h1>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        {me ? `${me.fullName} (${me.employeeNumber}) · ${me.jobTitle || 'No position'} · ${me.branchName}` : ''}
        {' '}A payslip appears here once your payroll has been approved.
      </p>
      <div className="card card-pad">
        {!rows && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={load} />}
        {rows && <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpen(r)} emptyMessage="No approved payslips yet." />}
      </div>
      {open && <PayslipModal payslip={open} appName={appName} onClose={() => setOpen(null)} />}
    </div>
  );
}
