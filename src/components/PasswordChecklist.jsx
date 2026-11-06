import React from 'react';
import { PASSWORD_RULES } from '../utils/passwordPolicy.js';

/** Live checklist under a "new password" box: each rule turns green as it is met. */
export default function PasswordChecklist({ password }) {
  const p = password || '';
  return (
    <ul className="mt-2 space-y-0.5 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(p);
        return (
          <li key={r.key} className={ok ? 'text-emerald-700' : 'text-ink-500'}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span> {r.label}
          </li>
        );
      })}
    </ul>
  );
}
