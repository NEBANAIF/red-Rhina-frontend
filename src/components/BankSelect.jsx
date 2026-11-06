import React, { useEffect, useState } from 'react';
import { listBankOptions } from '../api/banks.js';

/**
 * A dropdown of the registered, active banks - used wherever a bank payment is taken (the POS,
 * loan repayments) so the bank is always picked from the list an administrator registered rather
 * than typed in. `value` is the bank id ('' for none). If no bank is registered yet it says so
 * instead of showing an empty list.
 */
export default function BankSelect({ value, onChange, required = false, className = 'input', id }) {
  const [banks, setBanks] = useState(null); // null while loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBankOptions()
      .then((rows) => { if (!cancelled) setBanks(rows); })
      .catch(() => { if (!cancelled) { setFailed(true); setBanks([]); } });
    return () => { cancelled = true; };
  }, []);

  if (banks && banks.length === 0) {
    return (
      <p className="field-hint">
        {failed
          ? 'The list of banks could not be loaded.'
          : 'No bank is registered yet. Ask an administrator to register one on the Payments page.'}
      </p>
    );
  }

  return (
    <select
      id={id}
      required={required}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={banks === null}
    >
      <option value="">{banks === null ? 'Loading banks...' : 'Select bank...'}</option>
      {(banks || []).map((b) => (
        <option key={b.id} value={b.id}>
          {b.accountEnding ? `${b.name} - ending ${b.accountEnding}` : b.name}
        </option>
      ))}
    </select>
  );
}
