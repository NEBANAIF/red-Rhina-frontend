import React, { useState } from 'react';
import StockOverviewTab from './StockOverviewTab.jsx';
import ProductsTab from './ProductsTab.jsx';

const TABS = [
  { key: 'overview', label: 'Stock Overview' },
  { key: 'products', label: 'Products' },
];

/**
 * Spec section 10: ONE Inventory page with internal tabs, never separate
 * top-level sidebar entries for Products/Stock. Stock Overview
 * is the default/primary tab - "which branch has which product and how
 * much" is the question this page exists to answer first.
 */
export default function InventoryPage() {
  const [tab, setTab] = useState('overview');

  return (
    <div>
      <h1 className="page-title mb-4">Inventory</h1>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-cream-300">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-600 text-sage-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-pad">
        {tab === 'overview' && <StockOverviewTab />}
        {tab === 'products' && <ProductsTab />}
      </div>
    </div>
  );
}
