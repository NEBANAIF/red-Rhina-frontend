import { COUNTRIES } from './countries.js';

export { COUNTRIES };

export const PURCHASE_TYPES = [
  { value: 'LOCAL', label: 'Local' },
  { value: 'GLOBAL', label: 'Global' },
];

export const SHIPPING_METHODS = [
  { value: 'SEA', label: 'Sea freight' },
  { value: 'AIR', label: 'Air freight' },
  { value: 'ROAD', label: 'Road' },
  { value: 'RAIL', label: 'Rail' },
  { value: 'MULTIMODAL', label: 'Multimodal' },
];

export const STAGE_STATUSES = [
  { value: 'PENDING', label: 'Pending (not yet there)' },
  { value: 'ARRIVED', label: 'Arrived (goods are here)' },
  { value: 'DEPARTED', label: 'Departed (goods left)' },
  { value: 'DELAYED', label: 'Delayed (held up here)' },
];

/** Values of the "shipment status" filter. DELAYED means late against the expected arrival date. */
export const SHIPMENT_STATUSES = [
  { value: 'NOT_SHIPPED', label: 'Not shipped' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'ARRIVED', label: 'Arrived at destination' },
  { value: 'DELAYED', label: 'Delayed' },
];

export const ORDER_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Years offered in the arrival-year filter: five back, two ahead. */
export function arrivalYears(now = new Date()) {
  const y = now.getFullYear();
  return Array.from({ length: 8 }, (_, i) => y + 2 - i);
}

export const optionLabel = (list, value) => list.find((o) => o.value === value)?.label || value || '';

export const shipmentStatusLabel = (v) => optionLabel(SHIPMENT_STATUSES, v) || '';

/** A fresh stop. Status PENDING until the goods actually get there. */
export function emptyStage(country = '', location = '') {
  return { country, location, arrivalDate: '', departureDate: '', status: 'PENDING', notes: '' };
}

/** The route a new global order starts with: where the goods start and where they end up. */
export function defaultRoute(origin = '', destination = '', warehouseName = '') {
  return [emptyStage(origin), emptyStage(destination, warehouseName)];
}

/** Whole days between two 'YYYY-MM-DD' strings (b - a), or null if either is missing. */
export function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.max(0, Math.round(ms / 86400000));
}

export const todayIso = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Days at a stop for the live preview in the route editor (same rule the server applies). */
export function previewDaysAtStage(stage, today = todayIso()) {
  if (!stage.status || stage.status === 'PENDING' || !stage.arrivalDate) return null;
  return daysBetween(stage.arrivalDate, stage.departureDate || today);
}

/**
 * Keeps a stop's status in step with the dates the person types: entering an arrival date on a pending stop marks it
 * arrived, entering a departure date marks it departed, clearing them again returns it to pending.
 */
export function withAutoStatus(stage, patch) {
  const next = { ...stage, ...patch };
  const touchedDates = 'arrivalDate' in patch || 'departureDate' in patch;
  if (!touchedDates || 'status' in patch) return next;
  if (next.departureDate) next.status = 'DEPARTED';
  else if (next.arrivalDate && (next.status === 'PENDING' || next.status === 'DEPARTED')) next.status = 'ARRIVED';
  else if (!next.arrivalDate && !next.departureDate) next.status = 'PENDING';
  return next;
}

export const stageToRequest = (s) => ({
  country: (s.country || '').trim(),
  location: (s.location || '').trim() || null,
  arrivalDate: s.arrivalDate || null,
  departureDate: s.departureDate || null,
  status: s.status || 'PENDING',
  notes: (s.notes || '').trim() || null,
});

export const stageFromResponse = (s) => ({
  country: s.country || '',
  location: s.location || '',
  arrivalDate: s.arrivalDate || '',
  departureDate: s.departureDate || '',
  status: s.status || 'PENDING',
  notes: s.notes || '',
});

/** Arrival month + year text for lists, e.g. "Mar 2026". */
export function arrivalLabel(po) {
  const d = po.actualArrivalDate || po.expectedArrivalDate;
  if (!d) return '';
  const [y, m] = d.split('-');
  return `${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`;
}

/** The filters of the Purchases page (and its export), in one place so both stay identical. */
export const EMPTY_PURCHASE_FILTERS = {
  purchaseType: '', originCountry: '', destinationCountry: '', currentCountry: '',
  warehouseId: '', shipmentStatus: '', arrivalMonth: '', arrivalYear: '',
};

/** Turns the filter state into API parameters (empty strings become undefined, so nothing is sent for them). */
export function purchaseFilterParams(f) {
  const clean = (v) => (v === '' || v == null ? undefined : v);
  return {
    purchaseType: clean(f.purchaseType),
    originCountry: clean(f.originCountry?.trim()),
    destinationCountry: clean(f.destinationCountry?.trim()),
    currentCountry: clean(f.currentCountry?.trim()),
    warehouseId: clean(f.warehouseId),
    shipmentStatus: clean(f.shipmentStatus),
    arrivalMonth: clean(f.arrivalMonth),
    arrivalYear: clean(f.arrivalYear),
  };
}

export const anyPurchaseFilter = (f) => Object.values(f).some((v) => v !== '' && v != null);
