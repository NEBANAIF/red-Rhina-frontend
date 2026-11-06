import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import ProductSelect from './ProductSelect.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBranchScope } from '../branch/BranchContext.jsx';
import { useAppName } from '../config/BrandContext.jsx';
import { extractErrorMessage } from '../api/client.js';
import {
  filterRows, serverRange, describeFilters, safeFileName, toLocalDay,
  exportExcel, exportCsv, exportPdf,
} from '../utils/exporter.js';
import { DATE_PRESETS as PRESETS, presetRange } from '../utils/dateRange.js';

const FORMATS = [
  { value: 'xlsx', label: 'Excel template (.xlsx)', hint: 'Branded sheet with totals and filters' },
  { value: 'csv', label: 'CSV (.csv)', hint: 'Plain data, opens anywhere' },
  { value: 'pdf', label: 'PDF', hint: 'Print-ready report' },
];

/**
 * "Export" button for any table. Opens a small dialog where the person picks a date range,
 * a name/keyword filter and a format, then downloads every matching row (not just the page on screen).
 *
 * Props
 *  - title        report title, also used for the file name
 *  - columns      export columns - see utils/exporter.js ({ header, value, type, total })
 *  - fetchRows    async ({ from, to, serverFrom, serverTo, scopeParams, productId, product }) => rows[]  - fetch ALL rows (use fetchAllPages).
 *                 serverFrom/serverTo are the date range widened by a day, safe to send to the API.
 *  - dateField    key or (row) => date for the date-range filter; leave out for tables with no date
 *  - dateLabel    what the date means, e.g. "Sale date"
 *  - nameFields   keys / functions the name filter searches; leave out to hide the box
 *  - nameLabel    e.g. "Customer or sale number"
 *  - scoped       true for branch-scoped tables: adds a Branch filter (Administrator) and a "Branch: ..." line to the header
 *  - productFilter true to add a Product picker; fetchRows then receives productId / product
 *  - infoLines    extra lines printed in the template header (e.g. "Branch: All branches")
 *  - initialSearch / initialFrom / initialTo / initialProduct   prefill from what the page is already showing
 *  - extraFilters   page-specific filters shown in the dialog, so Export offers exactly the filters of the page:
 *                   [{ key, label, type: 'select' | 'text', options: [{ value, label }], list: datalistId }].
 *                   Their chosen values reach fetchRows as `extra` ({ key: value }) and are printed in the header.
 *  - initialExtra   the page's current values for those filters
 */
export default function ExportButton({
  title, columns, fetchRows, dateField, dateLabel = 'Date', nameFields, nameLabel = 'Name / keyword',
  infoLines = [], scoped = false, productFilter = false, initialSearch = '', initialFrom = '', initialTo = '', initialProduct = null, extraFilters = [], initialExtra = {}, className = '', disabled = false,
}) {
  const { user } = useAuth();
  const { appName } = useAppName();
  const { scope, specificBranchId, branches, isAdministrator, scopeParams: pageScope } = useBranchScope();
  // '' = whatever the top-bar branch selector says; otherwise ALL / STORES / WAREHOUSES / a branch id.
  const [branchChoice, setBranchChoice] = useState('');
  const [product, setProduct] = useState(null);
  const [extra, setExtra] = useState({});
  const canPickBranch = scoped && isAdministrator && (branches?.length ?? 0) > 0;
  const effectiveScope = (() => {
    if (!canPickBranch || !branchChoice) return pageScope;
    if (['ALL', 'STORES', 'WAREHOUSES'].includes(branchChoice)) return { scope: branchChoice, branchId: undefined };
    return { scope: 'SPECIFIC', branchId: branchChoice };
  })();
  const branchLine = !scoped ? null : (() => {
    if (effectiveScope.scope === 'SPECIFIC') {
      const id = effectiveScope.branchId ?? specificBranchId;
      const name = branches?.find((b) => b.id === id)?.name || user?.branchName;
      return `Branch: ${name || 'selected branch'}`;
    }
    return `Branch: ${{ ALL: 'All branches', STORES: 'All stores', WAREHOUSES: 'All warehouses' }[effectiveScope.scope || scope] || scope}`;
  })();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState('xlsx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const openDialog = () => {
    setFrom(initialFrom || '');
    setTo(initialTo || '');
    setSearch(initialSearch || '');
    setBranchChoice('');
    setProduct(initialProduct || null);
    setExtra({ ...initialExtra });
    setError('');
    setNotice('');
    setOpen(true);
  };

  const rangeInvalid = from && to && from > to;

  const run = async (e) => {
    e.preventDefault();
    if (rangeInvalid) { setError('“From” must be on or before “To”.'); return; }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const wide = serverRange(dateField ? from : '', dateField ? to : '');
      const fetched = await fetchRows({
        from, to, serverFrom: wide.from, serverTo: wide.to,
        scopeParams: effectiveScope, productId: product?.id, product, extra,
      });
      const filters = { from: dateField ? from : '', to: dateField ? to : '', search: nameFields ? search : '' };
      const rows = filterRows(fetched, filters, { dateField, nameFields });
      if (rows.length === 0) {
        setNotice('Nothing matches these filters, so there is nothing to export. Widen the date range or clear the name.');
        return;
      }
      const info = [
        ...(branchLine ? [branchLine] : []),
        ...(productFilter && product ? [`Product: ${product.name}${product.sku ? ` (${product.sku})` : ''}`] : []),
        ...extraFilters.flatMap((f) => {
          const v = extra[f.key];
          if (v === '' || v == null) return [];
          const shown = f.options ? (f.options.find((o) => String(o.value) === String(v))?.label ?? v) : v;
          return [`${f.label}: ${shown}`];
        }),
        ...infoLines,
        ...describeFilters(filters).filter((l) => (dateField || !l.startsWith('Date')) && (nameFields || !l.startsWith('Name'))),
      ];
      const common = {
        title, appName, columns, rows, infoLines: info, generatedBy: user?.name,
        filename: safeFileName(title),
      };
      if (format === 'xlsx') await exportExcel(common);
      else if (format === 'csv') exportCsv(common);
      else exportPdf(common);
      setOpen(false);
    } catch (err) {
      setError(err?.response ? extractErrorMessage(err) : (err?.message || 'Export failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={openDialog} disabled={disabled} className={`btn btn-secondary btn-sm ml-auto ${className}`} title={`Export ${title}`}>
        <Icon name="download" size={14} /> Export
      </button>

      <Modal open={open} title={`Export ${title}`} description="Downloads every matching record, not just the page you are looking at." onClose={() => !busy && setOpen(false)}>
        <form onSubmit={run} className="space-y-4">
          {dateField && (
            <div>
              <span className="label">{dateLabel} range</span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PRESETS.map(([key, label]) => (
                  <button
                    key={key} type="button" className="btn btn-ghost btn-sm !px-2 !py-1 text-xs"
                    onClick={() => { const r = presetRange(key); setFrom(r.from); setTo(r.to); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">From</span>
                  <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">To</span>
                  <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                </label>
              </div>
              <p className="field-hint">Leave both empty to include every date.</p>
            </div>
          )}

          {canPickBranch && (
            <label className="block">
              <span className="label">Branch</span>
              <select className="input" value={branchChoice} onChange={(e) => setBranchChoice(e.target.value)}>
                <option value="">Same as the branch selector at the top</option>
                <option value="ALL">All branches</option>
                <option value="STORES">All stores</option>
                <option value="WAREHOUSES">All warehouses</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}

          {extraFilters.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {extraFilters.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">{f.label}</span>
                  {f.type === 'select' ? (
                    <select className="input" value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}>
                      {(f.options || []).map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      className="input" list={f.list} value={extra[f.key] ?? ''} placeholder={f.placeholder || 'Any'}
                      onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          {productFilter && (
            <div>
              <span className="label">Product</span>
              <ProductSelect value={product} onChange={setProduct} placeholder="All products — type to pick one…" />
            </div>
          )}

          {nameFields && (
            <label className="block">
              <span className="label">{nameLabel}</span>
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Leave empty to include everyone" />
            </label>
          )}

          <fieldset>
            <legend className="label">Format</legend>
            <div className="space-y-1.5">
              {FORMATS.map((f) => (
                <label key={f.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${format === f.value ? 'border-ink-500 bg-cream-100' : 'border-cream-300'}`}>
                  <input type="radio" name="export-format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} />
                  <span className="font-medium text-ink-800">{f.label}</span>
                  <span className="ml-auto text-xs text-ink-400">{f.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={busy || rangeInvalid} className="btn btn-primary btn-sm">
              <Icon name="download" size={14} /> {busy ? 'Preparing…' : 'Export'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
