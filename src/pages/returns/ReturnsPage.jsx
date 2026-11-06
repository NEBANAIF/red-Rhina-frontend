import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import CustomerReturnsTab from './CustomerReturnsTab.jsx';
import SupplierReturnsTab from './SupplierReturnsTab.jsx';

/**
 * Spec section 36: one "Returns" sidebar item covering both kinds (spec sections 21 and 22).
 * Each tab is shown only to people who hold its own switch: customer returns need RETURN_VIEW,
 * supplier returns need PURCHASE_RECEIVE or SUPPLIER_MANAGE.
 */
export default function ReturnsPage() {
  const { hasPermission } = useAuth();
  const tabs = [
    hasPermission('RETURN_VIEW') && { key: 'customer', label: 'Customer Returns' },
    (hasPermission('PURCHASE_RECEIVE') || hasPermission('SUPPLIER_MANAGE')) && { key: 'supplier', label: 'Supplier Returns' },
  ].filter(Boolean);
  const [picked, setPicked] = useState(null);
  const tab = tabs.some((t) => t.key === picked) ? picked : tabs[0]?.key;

  return (
    <div>
      <h1 className="page-title mb-4">Returns</h1>
      {tabs.length > 1 && (
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-cream-300">
          {tabs.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setPicked(t.key)}>{t.label}</TabButton>
          ))}
        </div>
      )}
      {tab === 'customer' && <CustomerReturnsTab />}
      {tab === 'supplier' && <SupplierReturnsTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${active ? 'border-brand-600 text-sage-700' : 'border-transparent text-ink-500 hover:text-ink-700'}`}
    >
      {children}
    </button>
  );
}
