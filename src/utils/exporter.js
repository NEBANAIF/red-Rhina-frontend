/**
 * Table export engine (no React in here).
 *
 *  - fetchAllPages()   walks a paged backend endpoint and returns every row.
 *  - filterRows()      applies the date-range + name filters on the client, so the
 *                      export is correct for every table, even where the endpoint
 *                      has no date/name filter of its own.
 *  - exportExcel()     branded .xlsx template (title block, filter summary, styled
 *                      header, number formats, totals row, frozen header, auto-filter).
 *  - exportCsv()       plain UTF-8 CSV (BOM so Excel opens non-English text properly).
 *  - exportPdf()       opens a print-ready template; choose "Save as PDF" in the print dialog.
 *
 * Column spec used everywhere:
 *   { header: 'Total', value: (row) => row.totalAmount, type: 'money', total: true, width: 14 }
 *   type: 'text' (default) | 'money' | 'number' | 'date' | 'datetime'
 *   total: true  -> a TOTAL row is added at the bottom for this numeric column
 */

/* ------------------------------------------------------------------ dates */

const pad = (n) => String(n).padStart(2, '0');

/** Any date / datetime value -> the user's own calendar day as 'YYYY-MM-DD' ('' if not a date). */
export function toLocalDay(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDay(day, delta) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/**
 * Date range to send to the server. Widened by a day on each side because the server
 * compares in UTC while the person picks days in their own time zone; filterRows() then
 * trims to the exact local days, so nothing is missed and nothing extra is exported.
 */
export function serverRange(from, to) {
  return {
    from: from ? shiftDay(from, -1) : undefined,
    to: to ? shiftDay(to, 1) : undefined,
  };
}

/* ---------------------------------------------------------------- fetching */

/** Walks every page of a Spring-style page endpoint: fn({ ...params, page, size }) -> { content, last/totalPages }. */
export async function fetchAllPages(fn, params = {}, { size = 200, maxPages = 500 } = {}) {
  const out = [];
  for (let page = 0; page < maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fn({ ...params, page, size });
    const rows = Array.isArray(res) ? res : (res?.content ?? []);
    out.push(...rows);
    if (Array.isArray(res) || res?.last || page + 1 >= (res?.totalPages ?? 1) || rows.length === 0) break;
  }
  return out;
}

/* --------------------------------------------------------------- filtering */

const read = (row, accessor) => (typeof accessor === 'function' ? accessor(row) : row?.[accessor]);

/** Client-side date-range + name filter. `dateField`/`nameFields` are keys or (row) => value functions. */
export function filterRows(rows, { from, to, search }, { dateField, nameFields } = {}) {
  const needle = (search || '').trim().toLowerCase();
  return rows.filter((row) => {
    if (dateField && (from || to)) {
      const day = toLocalDay(read(row, dateField));
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    if (needle && nameFields?.length) {
      const hit = nameFields.some((f) => String(read(row, f) ?? '').toLowerCase().includes(needle));
      if (!hit) return false;
    }
    return true;
  });
}

/* ---------------------------------------------------------------- helpers */

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function cellValue(col, row) {
  const v = col.value(row);
  if (v === null || v === undefined || v === '') return '';
  return v;
}

function displayText(col, row) {
  const v = cellValue(col, row);
  if (v === '') return '';
  switch (col.type) {
    case 'money': return toNumber(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'number': return toNumber(v).toLocaleString();
    case 'date': return toLocalDay(v);
    case 'datetime': {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : `${toLocalDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    default: return String(v);
  }
}

function totalsFor(columns, rows) {
  return columns.map((c) => (c.total ? rows.reduce((s, r) => s + toNumber(c.value(r)), 0) : null));
}

export function describeFilters({ from, to, search }) {
  const parts = [];
  if (from || to) parts.push(`Date: ${from || 'start'} to ${to || 'today'}`);
  else parts.push('Date: all dates');
  if (search && search.trim()) parts.push(`Name/keyword: "${search.trim()}"`);
  return parts;
}

export function safeFileName(base) {
  const stamp = toLocalDay(new Date());
  return `${String(base).trim().replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'export'}_${stamp}`;
}

export function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

/* -------------------------------------------------------------------- CSV */

const csvCell = (v) => {
  const s = String(v ?? '');
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of free text).
  const safe = /^[=+@]/.test(s) || (/^-/.test(s) && Number.isNaN(Number(s))) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function exportCsv({ filename, columns, rows }) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  rows.forEach((r) => {
    lines.push(columns.map((c) => {
      const v = cellValue(c, r);
      if (v === '') return '';
      if (c.type === 'money' || c.type === 'number') return String(toNumber(v));
      return csvCell(displayText(c, r));
    }).join(','));
  });
  const totals = totalsFor(columns, rows);
  if (totals.some((t) => t !== null)) {
    lines.push(columns.map((c, i) => (i === 0 ? 'TOTAL' : totals[i] !== null ? String(totals[i]) : '')).join(','));
  }
  saveBlob(new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

/* ------------------------------------------------------------------ Excel */

const BRAND = { dark: 'FF4A4D2E', sage: 'FFA3A676', cream: 'FFF5F4E8', ink: 'FF2B2A20' };

export async function exportExcel({ filename, title, appName, columns, rows, infoLines = [], generatedBy }) {
  // Loaded on demand so the (large) Excel library never weighs down the normal app bundle.
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = appName || 'ERP';
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), {
    views: [{ state: 'frozen', ySplit: 0 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  const lastCol = Math.max(columns.length, 2);
  const merge = (r) => { if (lastCol > 1) ws.mergeCells(r, 1, r, lastCol); };

  // ---- template header block
  ws.getRow(1).height = 26;
  ws.getCell(1, 1).value = appName || 'ERP';
  ws.getCell(1, 1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell(1, 1).alignment = { vertical: 'middle', indent: 1 };
  merge(1);
  for (let c = 1; c <= lastCol; c += 1) ws.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.dark } };

  ws.getCell(2, 1).value = title;
  ws.getCell(2, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: BRAND.ink } };
  ws.getCell(2, 1).alignment = { indent: 1 };
  merge(2);

  const meta = [
    ...infoLines,
    `Generated: ${toLocalDay(new Date())} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}${generatedBy ? ` by ${generatedBy}` : ''}`,
    `Rows: ${rows.length}`,
  ];
  meta.forEach((line, i) => {
    const r = 3 + i;
    ws.getCell(r, 1).value = line;
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B6A5A' } };
    ws.getCell(r, 1).alignment = { indent: 1 };
    merge(r);
  });

  const headerRowNo = 3 + meta.length + 1;
  const headerRow = ws.getRow(headerRowNo);
  headerRow.height = 22;
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.sage } };
    cell.alignment = { vertical: 'middle', horizontal: c.type === 'money' || c.type === 'number' ? 'right' : 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BRAND.dark } } };
  });

  // ---- data
  rows.forEach((r, ri) => {
    const row = ws.getRow(headerRowNo + 1 + ri);
    columns.forEach((c, i) => {
      const v = cellValue(c, r);
      const cell = row.getCell(i + 1);
      if (v === '') { cell.value = null; } else if (c.type === 'money' || c.type === 'number') {
        cell.value = toNumber(v);
        cell.numFmt = c.type === 'money' ? '#,##0.00' : '#,##0.##';
        cell.alignment = { horizontal: 'right' };
      } else if (c.type === 'date' || c.type === 'datetime') {
        const d = new Date(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
        if (Number.isNaN(d.getTime())) { cell.value = String(v); } else {
          // Excel has no time zones: store the person's local wall-clock time so the sheet matches the screen.
          cell.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
          cell.numFmt = c.type === 'date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm';
          cell.alignment = { horizontal: 'left' };
        }
      } else {
        const s = String(v);
        // Stored as text, so a value like "=SUM(A1)" typed in a note can never run as a formula.
        cell.value = s;
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
      cell.font = { name: 'Calibri', size: 11 };
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.cream } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD9D6B8' } } };
    });
  });

  // ---- totals
  const totals = totalsFor(columns, rows);
  let lastRowNo = headerRowNo + rows.length;
  if (totals.some((t) => t !== null) && rows.length > 0) {
    lastRowNo += 1;
    const tr = ws.getRow(lastRowNo);
    columns.forEach((c, i) => {
      const cell = tr.getCell(i + 1);
      if (i === 0) cell.value = 'TOTAL';
      else if (totals[i] !== null) { cell.value = totals[i]; cell.numFmt = c.type === 'money' ? '#,##0.00' : '#,##0.##'; cell.alignment = { horizontal: 'right' }; }
      cell.font = { name: 'Calibri', bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E6C8' } };
      cell.border = { top: { style: 'thin', color: { argb: BRAND.dark } } };
    });
  }

  // ---- widths, freeze header, filter buttons
  columns.forEach((c, i) => {
    const longest = Math.max(
      String(c.header).length,
      ...rows.slice(0, 300).map((r) => displayText(c, r).length),
    );
    ws.getColumn(i + 1).width = c.width || Math.min(48, Math.max(11, longest + 3));
  });
  ws.views = [{ state: 'frozen', ySplit: headerRowNo, xSplit: 0 }];
  if (rows.length > 0) ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo + rows.length, column: columns.length } };
  ws.headerFooter = { oddFooter: `&L${appName || 'ERP'}&CPage &P of &N&R&D` };

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}

/* -------------------------------------------------------------------- PDF */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function exportPdf({ title, appName, columns, rows, infoLines = [], generatedBy }) {
  const totals = totalsFor(columns, rows);
  const hasTotals = totals.some((t) => t !== null) && rows.length > 0;
  const right = (c) => (c.type === 'money' || c.type === 'number' ? ' class="r"' : '');
  const fmt = (c, v) => (c.type === 'money' ? toNumber(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : toNumber(v).toLocaleString());

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Calibri, Arial, sans-serif; color: #2b2a20; font-size: 11px; margin: 0; }
  .brand { background: #4a4d2e; color: #fff; padding: 12px 16px; font-size: 20px; font-weight: 700; letter-spacing: .02em; }
  h1 { font-size: 16px; margin: 12px 0 4px; }
  .meta { color: #6b6a5a; font-size: 10px; line-height: 1.5; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #a3a676; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  td { padding: 5px 8px; border-bottom: 1px solid #e3e0c2; vertical-align: top; }
  tr:nth-child(even) td { background: #f8f7ee; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; background: #e8e6c8 !important; border-top: 2px solid #4a4d2e; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
  .hint { margin: 10px 0 0; color: #8a8870; font-size: 10px; }
  @media print { .hint { display: none; } }
</style></head><body>
<div class="brand">${esc(appName || 'ERP')}</div>
<h1>${esc(title)}</h1>
<div class="meta">${[...infoLines, `Generated: ${toLocalDay(new Date())} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}${generatedBy ? ` by ${esc(generatedBy)}` : ''}`, `Rows: ${rows.length}`].map((l) => esc(l)).join('<br>')}</div>
<table><thead><tr>${columns.map((c) => `<th${right(c)}>${esc(c.header)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td${right(c)}>${esc(displayText(c, r))}</td>`).join('')}</tr>`).join('')}</tbody>
${hasTotals ? `<tfoot><tr>${columns.map((c, i) => `<td${right(c)}>${i === 0 ? 'TOTAL' : totals[i] !== null ? fmt(c, totals[i]) : ''}</td>`).join('')}</tr></tfoot>` : ''}
</table>
<p class="hint">In the print window choose “Save as PDF” as the destination.</p>
<script>window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 250); };</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) throw new Error('The browser blocked the PDF window. Allow pop-ups for this site and try again.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}
