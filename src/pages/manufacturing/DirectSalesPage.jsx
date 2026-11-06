import React, { useEffect, useState } from 'react';
import { listDirectSales, recordDirectSalePayment, markDirectSaleDelivered } from '../../api/manufacturing.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import KpiCard from '../../components/KpiCard.jsx';
import Modal from '../../components/Modal.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import { formatMoney } from '../../utils/format.js';

const fmt = (n) => Number(n ?? 0).toLocaleString();
const newKey = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>{children}</label>;
}

const COLUMNS = [
  { key: 'orderNumber', header: 'Order', render: (r) => <span className="font-medium text-ink-900">{r.orderNumber}</span> },
  { key: 'customerName', header: 'Customer' },
  { key: 'productName', header: 'Product', render: (r) => `${r.productName} × ${fmt(r.quantity)}` },
  { key: 'totalAmount', header: 'Sale total', render: (r) => formatMoney(r.totalAmount), className: 'text-right' },
  { key: 'costAmount', header: 'Production cost', render: (r) => formatMoney(r.costAmount), className: 'text-right' },
  {
    key: 'profit', header: 'Profit',
    render: (r) => <span className={Number(r.profit) < 0 ? 'font-medium text-red-600' : 'font-medium text-green-700'}>{formatMoney(r.profit)}</span>,
    className: 'text-right',
  },
  { key: 'balance', header: 'Balance due', render: (r) => (Number(r.balance) > 0 ? formatMoney(r.balance) : '—'), className: 'text-right' },
  { key: 'paymentStatus', header: 'Payment', render: (r) => <Badge status={r.paymentStatus} /> },
  { key: 'deliveryStatus', header: 'Delivery', render: (r) => <Badge status={r.deliveryStatus} /> },
];

/** Finished goods sold straight from a factory to a customer: what was sold, the profit, payments and delivery. */
export default function DirectSalesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canManage = hasPermission('PRODUCTION_MANAGE');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [paying, setPaying] = useState(false);

  const load = () => {
    setState('loading');
    listDirectSales({ page, ...scopeParams }).then((d) => { setData(d); setState('ready'); })
      .catch((e) => { setError(extractErrorMessage(e)); setState('error'); });
  };
  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => { setPage(0); }, [scopeParams.scope, scopeParams.branchId]);

  const selected = data?.content.find((s) => s.id === selectedId) ?? null;
  const rows = data?.content ?? [];
  const revenue = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
  const profit = rows.reduce((s, r) => s + Number(r.profit), 0);
  const due = rows.reduce((s, r) => s + Number(r.balance), 0);

  const deliver = async () => {
    try { await markDirectSaleDelivered(selected.id); setNotice(`${selected.orderNumber} marked as delivered.`); load(); }
    catch (e) { setError(extractErrorMessage(e)); setState('error'); }
  };

  return (
    <div>
      <h1 className="page-title mb-4">Direct Sales</h1>
      <p className="-mt-2 mb-4 text-sm text-ink-500">
        Finished goods that went from a factory straight to a customer. They never enter a warehouse, showroom or branch inventory, so each sale is
        recorded once here: profit = actual selling price − production cost.
      </p>
      {notice && <p className="alert alert-success mb-3">{notice}</p>}

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} label="Direct sales" value={fmt(data.totalElements)} />
          <KpiCard index={1} label="Revenue (this page)" value={formatMoney(revenue)} emphasize />
          <KpiCard index={2} label="Profit (this page)" value={formatMoney(profit)} warn={profit < 0} />
          <KpiCard index={3} label="Still to collect" value={formatMoney(due)} warn={due > 0} />
        </div>
      )}

      <div className="card card-pad">
        {state === 'loading' && !data && <LoadingState />}
        {state === 'error' && <ErrorState message={error} onRetry={load} />}
        {data && state !== 'error' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={(r) => setSelectedId(r.id)}
              emptyMessage="No direct sales yet. Complete a production order and choose 'Directly to a customer'." />
            <div className="mt-3"><Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected ? `${selected.orderNumber} – ${selected.customerName}` : ''} onClose={() => { setSelectedId(null); setPaying(false); }}>
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2"><Badge status={selected.paymentStatus} /><Badge status={selected.deliveryStatus} /></div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><dt className="text-ink-400">Product</dt><dd className="font-medium">{selected.productName} × {fmt(selected.quantity)}</dd></div>
              <div><dt className="text-ink-400">Factory</dt><dd className="font-medium">{selected.factoryName}</dd></div>
              <div><dt className="text-ink-400">Selling price</dt><dd className="font-medium">{formatMoney(selected.unitPrice)} each = {formatMoney(selected.totalAmount)}</dd></div>
              <div><dt className="text-ink-400">Production cost</dt><dd className="font-medium">{formatMoney(selected.costAmount)}</dd></div>
              <div><dt className="text-ink-400">Profit</dt><dd className="font-medium">{formatMoney(selected.profit)} ({selected.marginPercent}%)</dd></div>
              <div><dt className="text-ink-400">Paid / balance</dt><dd className="font-medium">{formatMoney(selected.amountPaid)} / {formatMoney(selected.balance)}</dd></div>
              <div><dt className="text-ink-400">Delivery address</dt><dd className="font-medium">{selected.deliveryAddress ?? '—'}</dd></div>
              <div><dt className="text-ink-400">Contact · planned date</dt><dd className="font-medium">{selected.deliveryContact ?? '—'} · {selected.deliveryDate ?? '—'}</dd></div>
              {selected.deliveredOn && <div><dt className="text-ink-400">Delivered on</dt><dd className="font-medium">{selected.deliveredOn}</dd></div>}
            </dl>
            {selected.notes && <p className="text-ink-500">{selected.notes}</p>}
            {selected.payments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Payments</p>
                <ul className="space-y-1 text-xs text-ink-600">
                  {selected.payments.map((p) => <li key={p.id}>{p.paidOn} – {formatMoney(p.amount)} (by {p.createdByName}){p.note ? ` – ${p.note}` : ''}</li>)}
                </ul>
              </div>
            )}
            {canManage && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                {selected.deliveryStatus === 'PENDING' && <button type="button" className="btn btn-secondary btn-sm" onClick={deliver}>Mark delivered</button>}
                {Number(selected.balance) > 0 && <button type="button" className="btn btn-primary btn-sm" onClick={() => setPaying(true)}>Record payment</button>}
              </div>
            )}
          </div>
        )}
      </Modal>

      {selected && paying && (
        <PaymentModal sale={selected} onClose={() => setPaying(false)}
          onDone={() => { setPaying(false); setNotice('Payment recorded.'); load(); }} />
      )}
    </div>
  );
}

function PaymentModal({ sale, onClose, onDone }) {
  const [amount, setAmount] = useState(String(sale.balance));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [key] = useState(newKey); // one key per dialog: a double click records the payment once
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await recordDirectSalePayment(sale.id, { amount: Number(amount), paidOn: date || undefined, note: note.trim() || undefined, requestKey: key });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Record payment – ${sale.orderNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-ink-500">Balance due: {formatMoney(sale.balance)}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount received"><input required type="number" min="0.01" max={sale.balance} step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Note (optional)"><input maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Record payment'}</button>
        </div>
      </form>
    </Modal>
  );
}
