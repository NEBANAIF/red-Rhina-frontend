import React from 'react';
import Badge from './Badge.jsx';
import { STOCK_STATUS } from '../utils/stockStatus.js';

/** "In stock" (green), "Low stock" (amber) or "Out of stock" (red) for a StockStatus value. */
export default function StockStatusBadge({ status }) {
  const meta = STOCK_STATUS[status];
  if (!meta) return null;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
