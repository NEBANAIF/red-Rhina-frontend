import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { searchProducts } from '../../api/products.js';
import { searchCustomers, createCustomer } from '../../api/customers.js';
import { checkout } from '../../api/pos.js';
import { getSettings } from '../../api/settings.js';
import { listAvailableBatches } from '../../api/batches.js';
import BankSelect from '../../components/BankSelect.jsx';
import { extractErrorMessage } from '../../api/client.js';
import Icon from '../../components/Icon.jsx';
import { formatMoney } from '../../utils/format.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

const PAYMENT_METHODS = ['CASH', 'BANK', 'CREDIT'];
const SALE_EXPENSE_CATEGORIES = ['LABOR', 'TRANSPORT', 'MAINTENANCE', 'OTHER'];

// Keep only digits and one decimal point (max 2 decimals). Amount boxes are plain text fields so a
// cashier can type freely - no spinner arrows, and nothing snaps back while typing.
function cleanDecimal(text) {
  let t = text.replace(/[^\d.]/g, '');
  const dot = t.indexOf('.');
  if (dot !== -1) {
    t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  }
  return t;
}

export default function PosPage() {
  const { user, hasPermission } = useAuth();

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Cart lines: { lineId, productId, name, sku, unitPrice, priceText, quantity, quantityText, batchId, editing }
  //  - a product has no stored price: the cashier types the selling price on every line.
  //    unitPrice is the number used for totals; priceText is the typed text ("12." must stay typeable).
  //  - batchId '' means take stock oldest-batch-first (default); otherwise sell from that one batch.
  //  - the same product can be on several lines (for example one per batch).
  const [cart, setCart] = useState([]);
  const nextLineId = useRef(1);

  // Costs of THIS sale (labour, delivery...) entered at checkout: [{ id, category, amountText, description }]
  const [saleExpenses, setSaleExpenses] = useState([]);
  const nextExpenseId = useRef(1);
  const [batchesByProduct, setBatchesByProduct] = useState({}); // productId -> [batches] | 'loading' | 'error'
  // What this cashier's role may do or see (set on the Roles & Permissions page).
  const canSeeCost = hasPermission('VIEW_COSTS');
  const canChooseBatch = hasPermission('POS_CHOOSE_BATCH');
  const canGiveDiscount = hasPermission('POS_DISCOUNT');

  // Whether an out-of-stock product should be left out of the search below - a system-wide switch
  // (Settings page), fetched once. Defaults to false (show everything, today's behavior) until it loads.
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  useEffect(() => {
    getSettings().then((s) => setHideOutOfStock(s.hideOutOfStockAtPos)).catch(() => {});
  }, []);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  // For a BANK payment: the registered bank picked from the dropdown, plus an optional reference
  // (the transfer or receipt number). Banks are registered on the Payments page.
  const [bankId, setBankId] = useState('');
  const [accountReference, setAccountReference] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = Number(discountAmount) || 0;
  const total = Math.max(subtotal - discount, 0);
  const paid = amountPaid === '' ? total : Number(amountPaid) || 0;
  const remaining = Math.max(total - paid, 0);
  const saleExpensesTotal = saleExpenses.reduce((sum, e) => sum + (Number(e.amountText) || 0), 0);

  async function handleProductSearch(query) {
    setProductQuery(query);
    if (query.trim().length < 2) {
      setProductResults([]);
      return;
    }
    setSearching(true);
    try {
      // Scoped to this cashier's own branch: whether a product is "in stock" only matters for
      // what can actually be sold from here, not what other branches happen to hold.
      const page = await searchProducts({
        search: query, size: 8, hideOutOfStock, scope: 'SPECIFIC', branchId: user.branchId,
        requireAtBranches: user.branchId,
      });
      setProductResults(page.content || []);
    } finally {
      setSearching(false);
    }
  }

  // Load (once per product) the batches that still have stock, for the optional batch picker.
  function ensureBatches(productId) {
    if (batchesByProduct[productId] !== undefined) return;
    setBatchesByProduct((prev) => ({ ...prev, [productId]: 'loading' }));
    listAvailableBatches({ productId, branchId: user.branchId })
      .then((rows) => setBatchesByProduct((prev) => ({ ...prev, [productId]: rows })))
      .catch(() => setBatchesByProduct((prev) => ({ ...prev, [productId]: 'error' })));
  }

  function addToCart(product) {
    setCart((prev) => {
      // Adding the same product again (on automatic batch selection) just raises its quantity.
      const existing = prev.find((line) => line.productId === product.id && line.batchId === '');
      if (existing) {
        return prev.map((line) => (line.lineId === existing.lineId
          ? { ...line, quantity: line.quantity + 1, quantityText: String(line.quantity + 1) }
          : line));
      }
      return [
        ...prev,
        {
          lineId: nextLineId.current++,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: 0,
          priceText: '',
          quantity: 1,
          quantityText: '1',
          batchId: '',
          editing: true, // new lines open in edit mode so the price gets typed straight away
        },
      ];
    });
    if (canChooseBatch) ensureBatches(product.id);
    setProductQuery('');
    setProductResults([]);
  }

  function updateLine(lineId, patch) {
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)));
  }

  function updatePrice(lineId, text) {
    const clean = cleanDecimal(text);
    updateLine(lineId, { unitPrice: Number(clean) || 0, priceText: clean });
  }

  // The box may be empty while typing; totals use at least 1 and the box resets to it on blur.
  function updateQuantity(lineId, text) {
    const digits = text.replace(/\D/g, '');
    updateLine(lineId, { quantity: Math.max(1, parseInt(digits, 10) || 1), quantityText: digits });
  }

  function addSaleExpense() {
    setSaleExpenses((prev) => [...prev, { id: nextExpenseId.current++, category: 'LABOR', amountText: '', description: '' }]);
  }
  function updateSaleExpense(id, patch) {
    setSaleExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function removeSaleExpense(id) {
    setSaleExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function removeLine(lineId) {
    setCart((prev) => prev.filter((line) => line.lineId !== lineId));
  }

  function batchLabel(b) {
    return `${b.batchNumber} · ${b.receivedDate} · ${b.remainingQuantity} left`
      + (canSeeCost ? ` · cost ${formatMoney(b.costPrice)}` : '');
  }

  async function handleCustomerSearch(query) {
    setCustomerQuery(query);
    if (query.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    const results = await searchCustomers(query);
    setCustomerResults(results);
  }

  async function handleCreateCustomer() {
    if (!newCustomerName.trim()) return;
    const created = await createCustomer({ name: newCustomerName, phone: newCustomerPhone });
    setCustomer(created);
    setShowNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setCustomerResults([]);
    setCustomerQuery('');
  }

  function requestCheckout() {
    setError(null);
    if (cart.length === 0) {
      setError('Add at least one item to the cart.');
      return;
    }
    const unpriced = cart.filter((line) => !(line.unitPrice > 0));
    if (unpriced.length > 0) {
      setCart((prev) => prev.map((line) => (line.unitPrice > 0 ? line : { ...line, editing: true })));
      setError(`Enter a selling price for "${unpriced[0].name}" before completing the sale.`);
      return;
    }
    for (const line of cart) {
      const batches = batchesByProduct[line.productId];
      const chosen = line.batchId && Array.isArray(batches) ? batches.find((b) => b.id === line.batchId) : null;
      if (chosen && line.quantity > chosen.remainingQuantity) {
        setError(`Batch ${chosen.batchNumber} of "${line.name}" has only ${chosen.remainingQuantity} left.`);
        return;
      }
    }
    if (paymentMethod === 'BANK' && paid > 0 && !bankId) {
      setError('Choose the bank the payment went to.');
      return;
    }
    if (remaining > 0 && !customer) {
      setError('A customer is required for a credit or partially paid sale.');
      return;
    }
    for (const e of saleExpenses) {
      if (!(Number(e.amountText) > 0) || !e.description.trim()) {
        setError('Each sale expense needs an amount and a description - fill it in or remove it.');
        return;
      }
    }
    setConfirmOpen(true);
  }

  async function submitCheckout() {
    setSubmitting(true);
    setError(null);
    try {
      const sale = await checkout({
        branchId: user.branchId,
        customerId: customer?.id || null,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          batchId: line.batchId || null,
        })),
        discountAmount: discount,
        paymentMethod,
        amountPaid: paid,
        bankId: paymentMethod === 'BANK' ? bankId : null,
        accountReference: paymentMethod !== 'CASH' ? accountReference : null,
        expenses: saleExpenses.map((e) => ({
          category: e.category,
          amount: Number(e.amountText),
          description: e.description.trim(),
          paymentMethod: 'CASH',
        })),
      });
      setReceipt(sale);
      resetForNextSale();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function resetForNextSale() {
    setCart([]);
    setBatchesByProduct({}); // stock just changed - reload batch lists when next needed
    setCustomer(null);
    setDiscountAmount('');
    setPaymentMethod('CASH');
    setAmountPaid('');
    setBankId('');
    setAccountReference('');
    setSaleExpenses([]);
  }

  if (!user?.branchId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Your account has no assigned branch, so POS checkout isn't available to you.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left: product search + cart */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card card-pad">
          <label className="text-sm font-medium text-ink-700">Search products</label>
          <input
            value={productQuery}
            onChange={(e) => handleProductSearch(e.target.value)}
            placeholder="Name or SKU..."
            className="input mt-1"
          />
          {searching && <p className="mt-2 text-xs text-ink-400">Searching...</p>}
          {productResults.length > 0 && (
            <ul className="mt-2 max-h-72 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300 shadow-xs">
              {productResults.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => addToCart(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-cream-100/50"
                  >
                    <span>
                      {p.name} <span className="text-ink-400">({p.sku})</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-cream-100 px-2 py-0.5 text-xs font-medium text-sage-700">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="section-title mb-3">Cart</h2>
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">Search for a product above to add it here.</p>
          ) : (
            <div className="space-y-2">
              {cart.map((line) => {
                const batches = batchesByProduct[line.productId];
                const chosen = line.batchId && Array.isArray(batches) ? batches.find((b) => b.id === line.batchId) : null;
                const priced = line.unitPrice > 0;
                return (
                  <div key={line.lineId} className={`rounded-lg px-3 py-2 ${priced ? 'bg-cream-50' : 'bg-amber-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{line.name}</p>
                        <p className="truncate text-xs text-ink-400">
                          {line.sku} · {chosen ? `Batch ${chosen.batchNumber}` : line.batchId ? 'Chosen batch' : 'Oldest batch first'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-800">{formatMoney(line.unitPrice * line.quantity)}</p>
                        <p className="text-xs text-ink-400">
                          {line.quantity} × {priced ? formatMoney(line.unitPrice) : 'no price yet'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateLine(line.lineId, { editing: !line.editing })}
                          className="btn btn-secondary btn-sm"
                        >
                          {line.editing ? 'Done' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.lineId)}
                          className="btn btn-sm border border-red-200 bg-cream-50 text-red-600 hover:border-red-300 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {line.editing && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-ink-500">Selling price</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={line.priceText}
                            placeholder="0.00"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updatePrice(line.lineId, e.target.value)}
                            className={`input ${priced ? '' : 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/15'}`}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-ink-500">Quantity</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={line.quantityText}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateQuantity(line.lineId, e.target.value)}
                            onBlur={() => updateLine(line.lineId, { quantityText: String(line.quantity) })}
                            className="input"
                          />
                        </label>
                        {canChooseBatch && (
                        <label className="col-span-2 block">
                          <span className="mb-1 block text-xs font-medium text-ink-500">Batch (optional)</span>
                          <select
                            value={line.batchId}
                            onChange={(e) => updateLine(line.lineId, { batchId: e.target.value })}
                            className="input"
                          >
                            <option value="">Automatic - oldest batch first</option>
                            {Array.isArray(batches) && batches.map((b) => (
                              <option key={b.id} value={b.id}>{batchLabel(b)}</option>
                            ))}
                          </select>
                          {batches === 'loading' && <span className="mt-1 block text-xs text-ink-400">Loading batches...</span>}
                          {batches === 'error' && <span className="mt-1 block text-xs text-ink-400">Could not load batches - automatic selection will be used.</span>}
                        </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: customer + payment + totals */}
      <div className="space-y-4">
        <div className="card card-pad">
          <h2 className="section-title mb-2">Customer</h2>
          {customer ? (
            <div className="flex items-center justify-between rounded-lg bg-cream-50 px-3 py-2 text-sm">
              <span>{customer.name}</span>
              <button onClick={() => setCustomer(null)} className="text-ink-400 hover:text-red-600">
                ✕
              </button>
            </div>
          ) : showNewCustomer ? (
            <div className="space-y-2">
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Full name"
                className="input"
              />
              <input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="input"
              />
              <div className="flex gap-2">
                <button onClick={handleCreateCustomer} className="btn btn-primary btn-sm flex-1">
                  Save
                </button>
                <button onClick={() => setShowNewCustomer(false)} className="input w-auto">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <input
                value={customerQuery}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                placeholder="Search customer (optional - walk-in)"
                className="input"
              />
              {customerResults.length > 0 && (
                <ul className="mt-2 max-h-72 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300 shadow-xs">
                  {customerResults.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setCustomer(c);
                          setCustomerResults([]);
                          setCustomerQuery('');
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-cream-50"
                      >
                        {c.name} {c.phone && <span className="text-ink-400">· {c.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setShowNewCustomer(true)} className="mt-2 text-xs font-medium text-sage-600 hover:underline">
                + New customer
              </button>
            </div>
          )}
        </div>

        <div className="card card-pad space-y-3">
          <h2 className="section-title">Payment</h2>

          {canGiveDiscount && (
          <div>
            <label className="text-xs text-ink-500">Discount</label>
            <input
              type="text"
              inputMode="decimal"
              value={discountAmount}
              placeholder="0"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDiscountAmount(cleanDecimal(e.target.value))}
              className="input mt-0.5"
            />
          </div>
          )}

          <div>
            <label className="text-xs text-ink-500">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input mt-0.5"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {paymentMethod === 'BANK' && (
            <div>
              <label className="text-xs text-ink-500">Bank</label>
              <BankSelect value={bankId} onChange={setBankId} className="input mt-0.5" />
            </div>
          )}
          {paymentMethod !== 'CASH' && (
            <input
              value={accountReference}
              onChange={(e) => setAccountReference(e.target.value)}
              placeholder={paymentMethod === 'BANK' ? 'Transfer / receipt reference (optional)' : 'Reference (optional)'}
              className="input"
            />
          )}

          <div>
            <label className="text-xs text-ink-500">Amount paid now</label>
            <input
              type="text"
              inputMode="decimal"
              value={amountPaid}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAmountPaid(cleanDecimal(e.target.value))}
              placeholder={total.toFixed(2)}
              className="input mt-0.5"
            />
            <p className="mt-1 text-xs text-ink-400">Leave blank to pay the full total.</p>
          </div>

          {hasPermission('EXPENSE_CREATE') && (
            <div className="rounded-lg border border-cream-300 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-700">Expenses for this sale</span>
                <button type="button" onClick={addSaleExpense} className="text-xs font-medium text-sage-600 hover:underline">
                  + Add expense
                </button>
              </div>
              {saleExpenses.length === 0 ? (
                <p className="mt-1 text-xs text-ink-400">Labour, delivery or other cost of this sale. Not charged to the customer.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {saleExpenses.map((ex) => (
                    <div key={ex.id} className="space-y-1.5 rounded-lg bg-cream-100 p-2">
                      <div className="flex gap-2">
                        <select value={ex.category} onChange={(e) => updateSaleExpense(ex.id, { category: e.target.value })} className="input flex-1">
                          {SALE_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                        </select>
                        <input
                          type="text" inputMode="decimal" placeholder="Amount" value={ex.amountText}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateSaleExpense(ex.id, { amountText: cleanDecimal(e.target.value) })}
                          className="input w-28"
                        />
                        <button type="button" onClick={() => removeSaleExpense(ex.id)} className="btn-icon" title="Remove expense" aria-label="Remove expense">
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                      <input
                        value={ex.description} maxLength={400} placeholder="Description (e.g. loading labour)"
                        onChange={(e) => updateSaleExpense(ex.id, { description: e.target.value })}
                        className="input"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <dl className="space-y-1 border-t border-cream-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Subtotal</dt>
              <dd>{formatMoney(subtotal)}</dd>
            </div>
            {canGiveDiscount && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Discount</dt>
                <dd>{discount > 0 ? '-' : ''}{formatMoney(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-ink-900">
              <dt>Total</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
            {saleExpensesTotal > 0 && (
              <div className="flex justify-between text-ink-500">
                <dt>Sale expenses (not charged)</dt>
                <dd>{formatMoney(saleExpensesTotal)}</dd>
              </div>
            )}
            {remaining > 0 && (
              <div className="flex justify-between text-amber-600">
                <dt>Remaining (credit)</dt>
                <dd>{formatMoney(remaining)}</dd>
              </div>
            )}
          </dl>

          {error && <p className="alert alert-error">{error}</p>}

          <button
            onClick={requestCheckout}
            disabled={submitting}
            className="btn btn-primary btn-lg w-full"
          >
            {submitting ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Complete this sale?"
        description={`Total ${formatMoney(total)}${remaining > 0 ? `, ${formatMoney(remaining)} on credit` : ''}. This cannot be undone from here.`}
        confirmLabel="Complete Sale"
        busy={submitting}
        onConfirm={submitCheckout}
        onCancel={() => setConfirmOpen(false)}
      />

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function ReceiptModal({ sale, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 p-4 backdrop-blur-[2px] animate-fade-in">
      <div className="w-full max-w-sm rounded-xl bg-cream-50 p-6 shadow-overlay animate-scale-in">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="check" size={20} strokeWidth={2.5} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-900">Sale complete</h2>
            <p className="text-sm text-ink-500">{sale.saleNumber}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1 border-t border-cream-200 pt-3 text-sm">
          {sale.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.quantity} × {item.productName}
              </span>
              <span>{formatMoney(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-cream-200 pt-3 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatMoney(sale.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Paid</span>
            <span>{formatMoney(sale.paidAmount)}</span>
          </div>
          {Number(sale.remainingAmount) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Remaining</span>
              <span>{formatMoney(sale.remainingAmount)}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="btn btn-primary btn-lg mt-6 w-full"
        >
          Start next sale
        </button>
      </div>
    </div>
  );
}
