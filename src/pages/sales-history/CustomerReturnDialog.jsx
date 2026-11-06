import React, { useState } from 'react';
import { createCustomerReturn } from '../../api/returns.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatMoney } from '../../utils/format.js';

/**
 * Spec section 21: select the sale, select returned items, validate,
 * restock if appropriate. Operates at the SaleBatchAllocation level (not
 * a bare product+quantity), since that's what the backend actually
 * validates against (see CustomerReturnItem's own extensive rationale) -
 * one row per allocation line the sale drew from, each independently
 * capped at what's still returnable on that exact line.
 */
export default function CustomerReturnDialog({ sale, onClose, onCompleted }) {
  const allocations = sale.items.flatMap((item) =>
    item.allocations.map((allocation) => ({ ...allocation, item })),
  );

  const [selections, setSelections] = useState(() =>
    Object.fromEntries(
      allocations.map((a) => [
        a.id,
        { quantity: 0, restock: true },
      ]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateSelection(key, patch) {
    setSelections((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const itemsToReturn = allocations
    .map((a) => {
      const key = a.id;
      const sel = selections[key];
      return sel.quantity > 0
        ? { saleBatchAllocationId: a.id, quantity: sel.quantity, restock: sel.restock, label: a }
        : null;
    })
    .filter(Boolean);

  const totalRefund = itemsToReturn.reduce(
    (sum, i) => sum + (i.label.unitPrice ?? i.label.item.unitPrice) * i.quantity,
    0,
  );

  async function handleSubmit() {
    if (itemsToReturn.length === 0) {
      setError('Enter a quantity for at least one item.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCustomerReturn({
        saleId: sale.id,
        items: itemsToReturn.map(({ saleBatchAllocationId, quantity, restock }) => ({
          saleBatchAllocationId,
          quantity,
          restock,
        })),
      });
      onCompleted(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink-900/55 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-cream-50 p-5 shadow-overlay animate-scale-in sm:max-w-lg sm:rounded-xl">
        <h2 className="text-base font-semibold text-ink-900">Process return - {sale.saleNumber}</h2>
        <p className="mt-1 text-sm text-ink-500">
          Enter how many units to return per line. Uncheck "Restock" for damaged or defective items.
        </p>

        <div className="mt-4 space-y-3">
          {allocations.map((a) => {
            const key = a.id;
            const sel = selections[key];
            const maxQty = a.quantityAllocated;
            return (
              <div key={key} className="rounded-lg border border-cream-300 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.item.productName}</p>
                    <p className="text-xs text-ink-400">
                      Batch {a.batchNumber} · sold {maxQty} @ {formatMoney(a.item.unitPrice)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={maxQty}
                    value={sel.quantity}
                    onChange={(e) =>
                      updateSelection(key, { quantity: Math.min(maxQty, Math.max(0, Number(e.target.value) || 0)) })
                    }
                    className="input w-20"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-ink-600">
                    <input
                      type="checkbox"
                      checked={sel.restock}
                      onChange={(e) => updateSelection(key, { restock: e.target.checked })}
                    />
                    Restock
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-3 text-sm font-medium">
          <span>Estimated refund</span>
          <span>{formatMoney(totalRefund)}</span>
        </div>

        {error && <p className="mt-3 alert alert-error">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="input w-auto">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary btn-sm"
          >
            {submitting ? 'Processing...' : 'Process Return'}
          </button>
        </div>
      </div>
    </div>
  );
}
