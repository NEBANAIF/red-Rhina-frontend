import React from 'react';

export const EMPLOYEE_TYPES = [
  { value: 'FACTORY_WORKER', label: 'Factory worker' },
  { value: 'SALESPERSON', label: 'Salesperson' },
  { value: 'WAREHOUSE_STAFF', label: 'Warehouse staff' },
  { value: 'SHOWROOM_STAFF', label: 'Showroom staff' },
  { value: 'OTHER', label: 'Other' },
];
export const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Annual leave' },
  { value: 'SICK', label: 'Sick leave' },
  { value: 'UNPAID', label: 'Unpaid leave' },
  { value: 'MATERNITY', label: 'Maternity leave' },
  { value: 'OTHER', label: 'Other' },
];
export const typeLabel = (v) => EMPLOYEE_TYPES.find((t) => t.value === v)?.label ?? v;
export const label = (v) => (v ? v.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : '—');
export const minutes = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
export const time = (t) => (t ? String(t).slice(0, 5) : '—');
export const newKey = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function Field({ text, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">{text}</span>{children}</label>;
}
