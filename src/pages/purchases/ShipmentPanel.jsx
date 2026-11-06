import React, { useState } from 'react';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import { updatePurchaseShipment } from '../../api/purchases.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatDate, formatMoney } from '../../utils/format.js';
import RouteEditor from './RouteEditor.jsx';
import { SHIPPING_METHODS, optionLabel, stageFromResponse, stageToRequest } from './shipment.js';

const Fact = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
    <p className="text-slate-800">{value || '—'}</p>
  </div>
);

/**
 * Everything about where a global purchase's goods are: the facts, the route with days at each stop, total transit time
 * and any delay. Updating it never changes stock - stock moves only when the quantity counted at the warehouse is
 * confirmed with "Receive Stock".
 */
export default function ShipmentPanel({ po, canEdit, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const days = (n) => (n == null ? '—' : `${n} day${n === 1 ? '' : 's'}`);

  return (
    <div className="space-y-3 rounded-xl border border-cream-300 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-900">Shipment</h3>
          <Badge status={po.shipmentStatus} />
          {po.delayed && <Badge status="DELAYED">{`Delayed ${po.delayDays} day${po.delayDays === 1 ? '' : 's'}`}</Badge>}
        </div>
        {canEdit && po.status !== 'CANCELLED' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Update shipment</button>
        )}
      </div>

      <p className="break-words text-sm text-ink-700">{po.route}</p>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Fact label="Current location" value={po.currentLocation || 'Not shipped yet'} />
        <Fact label="Origin → destination" value={`${po.originCountry} → ${po.destinationCountry}`} />
        <Fact label="Destination warehouse" value={po.destinationWarehouse} />
        <Fact label="Shipping method" value={optionLabel(SHIPPING_METHODS, po.shippingMethod)} />
        <Fact label="Shipping cost" value={po.shippingCost != null ? `${formatMoney(po.shippingCost)} ${po.currency || ''}` : null} />
        <Fact label="Currency" value={po.currency ? `${po.currency} (1 = ${po.exchangeRate} local)` : null} />
        <Fact label="Expected arrival" value={po.expectedArrivalDate ? formatDate(po.expectedArrivalDate) : null} />
        <Fact label="Arrived at destination" value={po.actualArrivalDate ? formatDate(po.actualArrivalDate) : 'Not yet'} />
        <Fact label="Total transit time" value={days(po.totalTransitDays)} />
        <Fact label="Delay vs expected" value={po.delayDays > 0 ? days(po.delayDays) : 'None'} />
        <Fact label="Receiving" value={<Badge status={po.receivingStatus} />} />
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase text-ink-400">
              <th className="py-1.5 pr-3 font-medium">#</th>
              <th className="py-1.5 pr-3 font-medium">Stop</th>
              <th className="py-1.5 pr-3 font-medium">Arrived</th>
              <th className="py-1.5 pr-3 font-medium">Departed</th>
              <th className="py-1.5 pr-3 text-right font-medium">Days there</th>
              <th className="py-1.5 pr-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {po.stages.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 align-top last:border-0">
                <td className="py-1.5 pr-3">{s.stageOrder}</td>
                <td className="py-1.5 pr-3">
                  <span className="font-medium text-slate-800">{s.location || s.country}</span>
                  {s.location && <span className="block text-xs text-ink-400">{s.country}</span>}
                  {s.notes && <span className="block text-xs text-ink-500">{s.notes}</span>}
                </td>
                <td className="py-1.5 pr-3">{s.arrivalDate ? formatDate(s.arrivalDate) : '—'}</td>
                <td className="py-1.5 pr-3">{s.departureDate ? formatDate(s.departureDate) : '—'}</td>
                <td className="py-1.5 pr-3 text-right">
                  {s.daysAtStage == null ? '—' : `${s.daysAtStage}${s.ongoing ? ' (so far)' : ''}`}
                </td>
                <td className="py-1.5 pr-3"><Badge status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-400">
        Moving the shipment along never changes your stock. Stock goes up only when the quantity counted at the
        warehouse is confirmed with “Receive Stock”.
      </p>

      {editing && (
        <ShipmentModal po={po} onClose={() => setEditing(false)} onSaved={(updated) => { setEditing(false); onUpdated(updated); }} />
      )}
    </div>
  );
}

function ShipmentModal({ po, onClose, onSaved }) {
  const [stages, setStages] = useState(() => po.stages.map(stageFromResponse));
  const [method, setMethod] = useState(po.shippingMethod || 'SEA');
  const [cost, setCost] = useState(po.shippingCost ?? '');
  const [expected, setExpected] = useState(po.expectedArrivalDate || '');
  const [currency, setCurrency] = useState(po.currency || '');
  const [rate, setRate] = useState(po.exchangeRate ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const costLocked = po.items.some((i) => i.receivedQuantity > 0);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await updatePurchaseShipment(po.id, {
        shippingMethod: method,
        shippingCost: cost === '' ? null : Number(cost),
        expectedArrivalDate: expected || null,
        currency: currency || null,
        exchangeRate: rate === '' ? null : Number(rate),
        stages: stages.map(stageToRequest),
      });
      onSaved(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Update shipment - ${po.orderNumber}`} onClose={() => !saving && onClose()} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Shipping method</span>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {SHIPPING_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Shipping cost ({po.currency})</span>
            <input type="number" min="0" step="0.01" className="input" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Expected arrival</span>
            <input required type="date" className="input" value={expected} min={po.orderDate} onChange={(e) => setExpected(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Currency</span>
            <input className="input uppercase" value={currency} maxLength={10} disabled={costLocked} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Exchange rate (1 {currency || 'unit'} = ? local)</span>
            <input type="number" min="0" step="0.000001" className="input" value={rate} disabled={costLocked} onChange={(e) => setRate(e.target.value)} />
          </label>
        </div>
        {costLocked && <p className="field-hint">The currency and exchange rate are locked: stock was already received and costed with them.</p>}

        <div>
          <p className="mb-1 text-xs font-medium text-ink-500">Route</p>
          <RouteEditor stages={stages} onChange={setStages} lockEnds />
        </div>

        {error && <p className="alert alert-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving...' : 'Save shipment'}</button>
        </div>
      </form>
    </Modal>
  );
}
