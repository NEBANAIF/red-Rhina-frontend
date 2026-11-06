import React, { useEffect, useState } from 'react';
import { searchProducts, getStockSummary, createProduct, updateProduct, deactivateProduct, downloadImportTemplate, triggerDownload, importProducts } from '../../api/products.js';
import { getProductCosts, correctProductCost } from '../../api/inventory.js';
import { submitStockChange } from '../../api/stockChanges.js';
import { listBranches } from '../../api/branches.js';
import { getSettings } from '../../api/settings.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { formatMoney } from '../../utils/format.js';
import Icon from '../../components/Icon.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StockStatusFilter from '../../components/StockStatusFilter.jsx';
import StockStatusBadge from '../../components/StockStatusBadge.jsx';
import { STOCK_STATUS } from '../../utils/stockStatus.js';
import ExportButton from '../../components/ExportButton.jsx';
import { fetchAllPages } from '../../utils/exporter.js';

/**
 * Products (global catalogue). Cost figures are NOT stored on the product -
 * the same product bought at 10 last week and 12 today is two batches with
 * two costs - so they come from GET /api/inventory/costs, which derives them
 * from the batches still in stock. That is the same source FIFO uses to cost a
 * sale, so the inventory value shown here matches the profit calculation.
 * Cost columns need FINANCE_VIEW; without it the table simply omits them.
 */
export default function ProductsTab() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canCreate = hasPermission('PRODUCT_CREATE');
  const canEdit = hasPermission('PRODUCT_EDIT');
  const canDelete = hasPermission('PRODUCT_DELETE');
  // Cost prices and inventory value are separate switches (Roles & Permissions); the figures come
  // from one endpoint, which leaves out whichever the role may not see.
  const canSeeCosts = hasPermission('VIEW_COSTS');
  const canSeeValue = hasPermission('VIEW_INVENTORY_VALUE');
  const canSeeStock = canSeeCosts || canSeeValue;
  // Recording an initial stock batch at creation time is a stock write like
  // any other adjustment, so it needs the same permission as the Inventory
  // adjust-stock flow, not PRODUCT_CREATE.
  const canAdjustStock = hasPermission('STOCK_ADJUST');
  // The initial stock of a new product is entered as a held "add batch", so it needs that permission.
  const canAddStock = hasPermission('BATCH_CREATE');

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState(''); // '' = all, else IN_STOCK / LOW_STOCK / OUT_OF_STOCK
  const [summary, setSummary] = useState(null); // { total, inStock, lowStock, outOfStock }
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const [costs, setCosts] = useState(null); // { totalStockValue, byProduct: { [productId]: row } }
  const [costsError, setCostsError] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null); // product being edited, or null when creating
  const [deleting, setDeleting] = useState(null); // product awaiting delete confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Whether cost price is locked on the New Product form (Settings > Inventory).
  // Defaults to unlocked until the real value loads, matching prior behavior.
  const [costLocked, setCostLocked] = useState(false);

  useEffect(() => {
    getSettings().then((s) => setCostLocked(s.lockCostPrice)).catch(() => {});
  }, []);

  const load = () => {
    setStatus('loading');
    searchProducts({
      search: search || undefined, page, stockStatus: stockFilter || undefined, ...scopeParams,
      // Only meaningful for one branch at a time - "All branches" shows the full catalog.
      requireAtBranches: scopeParams.scope === 'SPECIFIC' ? scopeParams.branchId : undefined,
    })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  // The filter's counts follow the branch selector in the top bar, like the stock shown on each row.
  const loadSummary = () => {
    getStockSummary(scopeParams).then(setSummary).catch(() => setSummary(null));
  };

  const loadCosts = () => {
    if (!canSeeStock) return;
    setCostsError(false);
    getProductCosts(scopeParams)
      .then((res) => {
        const byProduct = {};
        res.rows.forEach((row) => { byProduct[row.productId] = row; });
        setCosts({ totalStockValue: res.totalStockValue, byProduct });
      })
      .catch(() => { setCosts(null); setCostsError(true); });
  };

  // One effect for page + search + stock filter + branch: search is debounced, the rest load straight away.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, stockFilter, scopeParams.scope, scopeParams.branchId]);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.scope, scopeParams.branchId]);

  // Cost figures follow the branch selector in the top bar.
  useEffect(() => {
    loadCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.scope, scopeParams.branchId, canSeeStock]);

  const openForm = (product) => {
    setEditing(product);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setActionError('');
    try {
      await deactivateProduct(deleting.id);
      setDeleting(null);
      load();
      loadCosts();
      loadSummary();
    } catch (err) {
      setActionError(extractErrorMessage(err));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const costOf = (row) => (costs ? costs.byProduct[row.id] : undefined);
  const dash = <span className="text-slate-300">—</span>;

  const columns = [
    { key: 'name', header: 'Product', render: (r) => (
        <div><p className="font-medium text-ink-900">{r.name}</p><p className="text-xs text-ink-400">{r.sku}</p></div>
      ) },
    { key: 'stockStatus', header: 'Status', render: (r) => (
        r.stockStatus ? (
          <div>
            <StockStatusBadge status={r.stockStatus} />
            <p className="mt-0.5 text-xs tabular-nums text-ink-400">{r.availableStock} {r.unit} available</p>
          </div>
        ) : dash
      ) },
    ...(canSeeStock ? [
      { key: 'inStock', header: 'On hand', className: 'text-right tabular-nums', render: (r) => {
          if (!costs) return dash;
          const c = costOf(r);
          return `${c ? c.quantityOnHand : 0} ${r.unit}`;
        } },
    ] : []),
    ...(canSeeCosts ? [
      { key: 'latestCost', header: 'Latest cost', className: 'text-right tabular-nums', render: (r) => {
          const c = costOf(r);
          return c ? formatMoney(c.latestCost) : dash;
        } },
      { key: 'oldestCost', header: 'Oldest cost', className: 'text-right tabular-nums', render: (r) => {
          const c = costOf(r);
          return c ? formatMoney(c.oldestCost) : dash;
        } },
    ] : []),
    ...(canSeeValue ? [
      { key: 'stockValue', header: 'Stock value', className: 'text-right font-medium tabular-nums', render: (r) => {
          const c = costOf(r);
          return c ? formatMoney(c.stockValue) : dash;
        } },
    ] : []),
    { key: 'reorderLevel', header: 'Reorder At' },
    ...(canEdit || canDelete ? [
      { key: 'actions', header: 'Actions', render: (r) => (
          <div className="flex justify-end gap-2">
            {canEdit && (
              <button onClick={() => openForm(r)} className="btn-icon" title="Edit product" aria-label="Edit product">
                <Icon name="edit" size={15} />
              </button>
            )}
            {canDelete && (
              <button onClick={() => setDeleting(r)} className="btn-icon-danger" title="Delete product" aria-label="Delete product">
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        ) },
    ] : []),
  ];

  const exportColumns = [
    { header: 'Product', value: (r) => r.name },
    { header: 'SKU', value: (r) => r.sku },
    { header: 'Unit', value: (r) => r.unit },
    { header: 'Stock status', value: (r) => (r.stockStatus || '').replace(/_/g, ' ') },
    { header: 'Available stock', value: (r) => r.availableStock, type: 'number' },
    { header: 'Reorder at', value: (r) => r.reorderLevel, type: 'number' },
    ...(canSeeCosts ? [
      { header: 'Latest cost', value: (r) => r._cost?.latestCost, type: 'money' },
      { header: 'Oldest cost', value: (r) => r._cost?.oldestCost, type: 'money' },
    ] : []),
    ...(canSeeValue ? [{ header: 'Stock value', value: (r) => r._cost?.stockValue, type: 'money', total: true }] : []),
    { header: 'Active', value: (r) => (r.active === false ? 'No' : 'Yes') },
  ];

  // Everything matching the current branch / stock filter, with fresh cost figures merged in.
  const fetchExportRows = async ({ scopeParams: sp = scopeParams } = {}) => {
    const [products, costRes] = await Promise.all([
      fetchAllPages(searchProducts, {
        stockStatus: stockFilter || undefined, ...sp,
        requireAtBranches: sp.scope === 'SPECIFIC' ? sp.branchId : undefined,
      }),
      canSeeStock ? getProductCosts(sp).catch(() => null) : Promise.resolve(null),
    ]);
    const byProduct = {};
    (costRes?.rows || []).forEach((c) => { byProduct[c.productId] = c; });
    return products.map((p) => ({ ...p, _cost: byProduct[p.id] }));
  };

  const deletingStock = deleting && costOf(deleting) ? costOf(deleting).quantityOnHand : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Search products…" />
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <ExportButton
            title="Products" columns={exportColumns} scoped
            nameFields={['name', 'sku']} nameLabel="Product name or SKU"
            initialSearch={search}
            infoLines={stockFilter ? [`Stock status: ${STOCK_STATUS[stockFilter].label}`] : []}
            fetchRows={fetchExportRows}
          />
          <StockStatusFilter value={stockFilter} counts={summary} onChange={(v) => { setPage(0); setStockFilter(v); }} />
          {canCreate && canAdjustStock && (
            <button onClick={() => setImportOpen(true)} className="btn btn-secondary btn-sm">
              Import Existing Data
            </button>
          )}
          {canCreate && (
            <button onClick={() => openForm(null)} className="btn btn-primary btn-sm">
              + New Product
            </button>
          )}
        </div>
      </div>

      {canSeeValue && costs && costs.totalStockValue != null && (
        <div className="mb-3 rounded-lg bg-cream-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-400">Inventory value (current branch selection)</p>
          <p className="text-xl font-semibold tabular-nums text-ink-900">{formatMoney(costs.totalStockValue)}</p>
          <p className="mt-1 text-xs text-ink-500">
            Each batch is valued at what it actually cost. Latest cost is the most recent purchase price;
            oldest cost is what the next sale is costed at (first in, first out).
          </p>
        </div>
      )}
      {canSeeStock && costsError && (
        <p className="mb-3 text-sm text-amber-700">Couldn&apos;t load cost figures. The product list is still accurate.</p>
      )}
      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
      {notice && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'ready' && (
        <>
          <DataTable columns={columns} rows={data.content} emptyMessage={stockFilter ? `No products are ${STOCK_STATUS[stockFilter].label.toLowerCase()}${search ? ' for this search' : ''}.` : 'No products found.'} />
          <div className="mt-3">
            <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
          </div>
        </>
      )}

      <ProductFormModal
        open={formOpen}
        product={editing}
        currentStock={editing ? costOf(editing)?.quantityOnHand : undefined}
        currentCost={editing ? costOf(editing)?.oldestCost : undefined}
        canAdjustStock={canAdjustStock}
        canAddStock={canAddStock}
        costLocked={costLocked}
        scopeParams={scopeParams}
        onClose={() => setFormOpen(false)}
        onSaved={(warning, info) => {
          setFormOpen(false);
          setActionError(warning || '');
          setNotice(info || '');
          load();
          loadCosts();
          loadSummary();
        }}
      />

      <ProductImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          load();
          loadCosts();
          loadSummary();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Delete product?"
        description={
          deleting
            ? `"${deleting.name}" will be hidden from the POS and from new purchases. Its sales, batches and stock history are kept.`
              + (deletingStock > 0 ? ` It still has ${deletingStock} ${deleting.unit} in stock in the selected branches.` : '')
            : ''
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/**
 * Create when `product` is null, edit otherwise. A product has no price and no
 * stock or cost of its own: cost and quantity live on batches (added when stock
 * is received), and the selling price is typed on each sale at the POS.
 *
 * "Initial Stock" is a convenience, not a new source of truth: picking a
 * quantity here just fires the same POST /api/inventory/adjust (INCREASE)
 * an admin would otherwise make by hand right after creating the product, so
 * it opens one starting batch at the cost price given. That's why it needs
 * STOCK_ADJUST, not just PRODUCT_CREATE, and why it only makes sense once -
 * once the product exists, further stock is a batch/adjustment/transfer, not
 * an edit to the product record, so the field is disabled from then on and
 * just reflects whatever is on hand.
 */
function ProductFormModal({
  open, product, currentStock, currentCost, canAdjustStock, canAddStock, costLocked, scopeParams,
  onClose, onSaved,
}) {
  const { user } = useAuth();
  const { isAdministrator, scope, specificBranchId } = useBranchScope();
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState([]);

  const showInitialStock = !product && canAddStock;
  // Editing the oldest batch's cost is the "ask around, then correct it"
  // flow for stock that was recorded at cost 0 - same STOCK_ADJUST gate as
  // the Initial Stock cost field, and same Settings toggle disables it: the
  // one switch covers both "don't ask for a cost at creation" and "don't let
  // it be changed afterwards either".
  const showCostCorrection = Boolean(product) && canAdjustStock && currentStock > 0;

  useEffect(() => {
    if (open) {
      setForm(product ? formFromProduct(product, currentCost) : blankForm(defaultBranchId()));
      setError('');
      if (!product && canAddStock && isAdministrator) {
        listBranches().then(setBranches).catch(() => setBranches([]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, currentCost]);

  function defaultBranchId() {
    if (scope === 'SPECIFIC' && specificBranchId) return specificBranchId;
    return user?.branchId ?? '';
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const qty = showInitialStock ? Number(form.initialStock || 0) : 0;
    const branchId = isAdministrator ? form.initialBranchId : (user?.branchId ?? specificBranchId);
    if (qty > 0 && !branchId) {
      setError('Select a branch to receive the initial stock.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        unit: form.unit,
        reorderLevel: form.reorderLevel === '' ? 0 : Number(form.reorderLevel),
        productType: form.productType,
        conductorMaterial: form.conductorMaterial.trim() || null,
        cores: form.cores === '' ? null : Number(form.cores),
        crossSectionMm2: form.crossSectionMm2 === '' ? null : Number(form.crossSectionMm2),
        voltageRating: form.voltageRating.trim() || null,
        standardRef: form.standardRef.trim() || null,
      };

      if (product) {
        await updateProduct(product.id, payload);

        if (showCostCorrection && !costLocked && form.costPrice !== '' && Number(form.costPrice) !== currentCost) {
          try {
            await correctProductCost(product.id, Number(form.costPrice), scopeParams);
          } catch (costErr) {
            // The name/SKU/etc. changes already saved - don't hide that behind
            // a form the user can't re-submit cleanly. Report the cost failure
            // separately and let the list refresh with everything else intact.
            onSaved(`"${product.name}" was updated, but correcting its cost failed: ${extractErrorMessage(costErr)}`);
            return;
          }
        }
        onSaved();
        return;
      }

      const created = await createProduct(payload);
      if (qty > 0) {
        try {
          await submitStockChange({
            changeType: 'ADD_BATCH',
            productId: created.id,
            branchId,
            quantity: qty,
            costPrice: costLocked || form.initialCostPrice === '' ? 0 : Number(form.initialCostPrice),
            note: 'Initial stock',
          });
        } catch (stockErr) {
          // The product itself was created fine - don't strand it behind a
          // form the user can't re-submit (the SKU is now taken). Close and
          // let the list refresh, but surface what didn't take.
          onSaved(`"${created.name}" was created, but its initial stock could not be submitted: ${extractErrorMessage(stockErr)}`);
          return;
        }
        onSaved(undefined, `"${created.name}" was created. Its initial stock of ${qty} is waiting for approval and will count once it is approved (Batches page).`);
        return;
      }
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={product ? 'Edit Product' : 'New Product'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input required autoFocus className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="SKU">
          <input required className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Unit">
            <input required placeholder="pcs, box..." className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </Field>
          <Field label="Reorder Level">
            <input type="number" min="0" className="input" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-lg border border-cream-300 p-3">
          <div className="mb-2 text-xs font-medium text-ink-500">Cable specification (optional)</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Conductor">
              <select className="input" value={form.conductorMaterial} onChange={(e) => setForm({ ...form, conductorMaterial: e.target.value })}>
                <option value="">-</option>
                {['COPPER', 'ALUMINIUM', 'CCA', 'FIBER'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Cores">
              <input type="number" min="1" className="input" value={form.cores} onChange={(e) => setForm({ ...form, cores: e.target.value })} />
            </Field>
            <Field label="Cross-section (mm²)">
              <input type="number" min="0" step="0.01" className="input" placeholder="2.5" value={form.crossSectionMm2} onChange={(e) => setForm({ ...form, crossSectionMm2: e.target.value })} />
            </Field>
            <Field label="Voltage rating">
              <input className="input" placeholder="450/750 V" value={form.voltageRating} onChange={(e) => setForm({ ...form, voltageRating: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Standard">
              <input className="input" placeholder="IEC 60227, IEC 60502-1..." value={form.standardRef} onChange={(e) => setForm({ ...form, standardRef: e.target.value })} />
            </Field>
          </div>
        </div>
        <Field label="Description">
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

        {(showInitialStock || product) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={product ? 'Stock on Hand' : 'Initial Stock'}>
              <input
                type="number"
                min="0"
                className="input disabled:bg-cream-100 disabled:text-ink-400"
                placeholder={product ? '' : '0'}
                disabled={Boolean(product)}
                value={product ? (currentStock ?? '') : form.initialStock}
                onChange={(e) => setForm({ ...form, initialStock: e.target.value })}
              />
            </Field>
            {showInitialStock && (
              <Field label={costLocked ? 'Cost Price (locked)' : 'Cost Price (optional)'}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input disabled:bg-cream-100 disabled:text-ink-400"
                  placeholder={costLocked ? 'Locked in Settings' : 'Per unit, defaults to 0'}
                  disabled={costLocked}
                  value={form.initialCostPrice}
                  onChange={(e) => setForm({ ...form, initialCostPrice: e.target.value })}
                />
              </Field>
            )}
            {showCostCorrection && (
              <Field label={costLocked ? 'Cost Price (locked)' : 'Cost Price'}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input disabled:bg-cream-100 disabled:text-ink-400"
                  placeholder={costLocked ? 'Locked in Settings' : 'Per unit'}
                  disabled={costLocked}
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
        {product && (
          <p className="text-xs text-ink-400">
            Stock is locked once a product is created - use Inventory to adjust, transfer, or receive more.
            {showCostCorrection && (
              costLocked
                ? ' Cost price is locked in Settings > Inventory - turn that off to correct it.'
                : ' Cost price is the oldest in-stock batch\u2019s cost - fixing it here corrects what FIFO will cost the next sale at.'
            )}
          </p>
        )}
        {showInitialStock && isAdministrator && Number(form.initialStock) > 0 && (
          <Field label="Branch">
            <select
              required
              className="input"
              value={form.initialBranchId}
              onChange={(e) => setForm({ ...form, initialBranchId: e.target.value })}
            >
              <option value="">Select branch...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : product ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>
      {children}
    </label>
  );
}

/**
 * Bulk-registers products that already exist somewhere else (a spreadsheet
 * of stock on hand, a paper ledger) - download the template, fill it in
 * with real quantities/costs, upload it back. Each row becomes a product
 * of its own POST, so partial success is normal: the results table shows
 * exactly which rows landed and which need a fix and a re-upload.
 */
function ProductImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setError('');
      setSummary(null);
    }
  }, [open]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadImportTemplate();
      triggerDownload(blob, 'product-import-template.xlsx');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose the filled-in template file first.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const result = await importProducts(file);
      setSummary(result);
      if (result.created > 0) {
        onImported();
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} title="Import Existing Data" onClose={onClose} size="lg">
      <div className="space-y-3">
        <p className="text-sm text-ink-500">
          For products you already have, outside this system. Download the template, fill in one row per
          product per branch (Branch must match a branch name or code that already exists here), then upload it.
          The same product in two branches? Repeat its Name and SKU on two rows, one per branch, each with its own
          stock and cost — don&apos;t give it a second SKU. Rows with no Initial Stock just register the product
          with no opening batch.
        </p>

        <button type="button" onClick={handleDownloadTemplate} disabled={downloading} className="btn btn-secondary btn-sm">
          {downloading ? 'Preparing template...' : 'Download Template (.xlsx)'}
        </button>

        <form onSubmit={handleUpload} className="space-y-3 border-t border-cream-200 pt-3">
          <Field label="Filled-in template">
            <input
              type="file"
              accept=".xlsx"
              className="input"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSummary(null); }}
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
            <button type="submit" disabled={uploading || !file} className="btn btn-primary btn-sm">
              {uploading ? 'Importing...' : 'Upload & Import'}
            </button>
          </div>
        </form>

        {summary && (
          <div className="border-t border-cream-200 pt-3">
            <p className="mb-2 text-sm font-medium text-ink-900">
              {summary.created} of {summary.totalRows} rows imported
              {summary.failed > 0 ? `, ${summary.failed} failed` : ''}.
            </p>
            <div className="max-h-64 overflow-y-auto rounded border border-cream-200">
              <table className="w-full text-xs">
                <thead className="bg-cream-50 text-left uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="px-2 py-1">Row</th>
                    <th className="px-2 py-1">SKU</th>
                    <th className="px-2 py-1">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-cream-100">
                      <td className="px-2 py-1 tabular-nums">{r.rowNumber}</td>
                      <td className="px-2 py-1">{r.sku || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-2 py-1 ${r.success ? 'text-green-700' : 'text-red-600'}`}>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function blankForm(defaultBranchId = '') {
  return {
    name: '', sku: '', description: '', unit: '', reorderLevel: '', productType: 'FINISHED_GOOD',
    conductorMaterial: '', cores: '', crossSectionMm2: '', voltageRating: '', standardRef: '',
    initialStock: '', initialCostPrice: '', initialBranchId: defaultBranchId, costPrice: '',
  };
}

function formFromProduct(p, currentCost) {
  return {
    name: p.name ?? '',
    sku: p.sku ?? '',
    description: p.description ?? '',
    unit: p.unit ?? '',
    reorderLevel: p.reorderLevel ?? '',
    productType: p.productType ?? 'FINISHED_GOOD',
    conductorMaterial: p.conductorMaterial ?? '', cores: p.cores ?? '', crossSectionMm2: p.crossSectionMm2 ?? '',
    voltageRating: p.voltageRating ?? '', standardRef: p.standardRef ?? '',
    initialStock: '',
    initialCostPrice: '',
    initialBranchId: '',
    costPrice: currentCost === undefined || currentCost === null ? '' : currentCost,
  };
}