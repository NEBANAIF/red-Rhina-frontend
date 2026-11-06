import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import PaymentsTab from './PaymentsTab.jsx';
import BanksTab from './BanksTab.jsx';

/**
 * One page, two tabs: the table of every payment received, and (for roles that may see bank
 * accounts) the list of registered banks - where banks are registered and edited. Who sees what
 * is set per role on the Roles & Permissions page (Payments group).
 */
export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const tabs = [
    { key: 'payments', label: 'Payments' },
    ...(hasPermission('BANK_VIEW') ? [{ key: 'banks', label: 'Banks' }] : []),
  ];
  const [tab, setTab] = useState('payments');

  return (
    <div>
      <h1 className="page-title mb-1">Payments</h1>
      <p className="mb-4 text-sm text-ink-500">
        Every payment received against sales and loans{tabs.length > 1 ? ', and the banks payments are paid into.' : '.'}
      </p>

      {tabs.length > 1 && (
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-cream-300">
          {tabs.map((t) => (
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
      )}

      <div className="card card-pad">
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'banks' && <BanksTab />}
      </div>
    </div>
  );
}
