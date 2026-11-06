import React, { useEffect, useState } from 'react';
import { downloadSalesImportTemplate, importSales } from '../../api/sales.js';
import { triggerDownload } from '../../api/products.js';
import { listBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import Modal from '../../components/Modal.jsx';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>
      {children}
    </label>
  );
}

/**
 * Loads sales that happened before the system was used. One row per product line; lines with the same Invoice No are one sale.
 * Each sale keeps its real date, takes its stock out of the branch, and becomes a customer loan for any unpaid part.
 * Sales are imported one by one, so the results table shows exactly which landed and which need a fix and a re-upload.
 */
export default function SalesImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [recordInLedger, setRecordInLedger] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => { listBranches().then(setBranches).catch(() => setBranches([])); }, []);

  const download = async () => {
    setDownloading(true);
    setError('');
    try { triggerDownload(await downloadSalesImportTemplate(), 'sales-import-template.xlsx'); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setDownloading(false); }
  };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) { setError('Choose the filled-in template file first.'); return; }
    setUploading(true);
    setError('');
    try {
      const result = await importSales(file, { defaultBranchId: branchId, recordInLedger });
      setSummary(result);
      if (result.salesImported > 0) onImported();
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setUploading(false); }
  };

  return (
    <Modal open title="Import previous sales" onClose={onClose} size="lg">
      <div className="space-y-3">
        <p className="text-sm text-ink-500">
          For sales made before you started using the system. Download the template and fill in one row per product line
          (rows with the same Invoice No are one sale). Each sale is recorded with its real date, <strong>takes its stock out of the branch</strong>
          {' '}(so the stock must already be entered), and the part the customer has not paid becomes a loan. An Invoice No that already
          exists is skipped, so uploading the same file twice does not duplicate sales.
        </p>
        <button type="button" onClick={download} disabled={downloading} className="btn btn-secondary btn-sm">
          {downloading ? 'Preparing template...' : 'Download Template (.xlsx)'}
        </button>

        <form onSubmit={upload} className="space-y-3 border-t border-cream-200 pt-3">
          <Field label="Branch for rows that have no Branch typed (optional)">
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">— none: every row names its branch —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" className="mt-0.5" checked={recordInLedger} onChange={(e) => setRecordInLedger(e.target.checked)} />
            <span>Also post these sales to the Finance ledger (revenue, cost and the cash received, on each sale&apos;s date).
              <span className="block text-xs text-ink-500">Leave this off if your opening cash and bank balances already include these sales.</span></span>
          </label>
          <Field label="Filled-in template">
            <input type="file" accept=".xlsx" className="input" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSummary(null); }} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
            <button type="submit" disabled={uploading || !file} className="btn btn-primary btn-sm">{uploading ? 'Importing...' : 'Upload & Import'}</button>
          </div>
        </form>

        {summary && (
          <div className="border-t border-cream-200 pt-3">
            <p className="mb-2 text-sm font-medium text-ink-900">
              {summary.salesImported} sale{summary.salesImported === 1 ? '' : 's'} imported
              {summary.salesFailed > 0 ? `, ${summary.salesFailed} failed` : ''} ({summary.totalRows} rows read).
            </p>
            <div className="max-h-64 overflow-y-auto rounded border border-cream-200">
              <table className="w-full text-xs">
                <thead className="bg-cream-50 text-left uppercase tracking-wide text-ink-400">
                  <tr><th className="px-2 py-1">Row</th><th className="px-2 py-1">Invoice</th><th className="px-2 py-1">Result</th></tr>
                </thead>
                <tbody>
                  {summary.results.map((r, i) => (
                    <tr key={`${r.rowNumber}-${i}`} className="border-t border-cream-100">
                      <td className="px-2 py-1 tabular-nums">{r.rowNumber}</td>
                      <td className="px-2 py-1">{r.invoice || <span className="text-slate-300">—</span>}</td>
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
