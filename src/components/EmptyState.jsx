import React from 'react';
import Icon from './Icon.jsx';

export default function EmptyState({ title = 'Nothing here yet', description, action, icon = 'inbox', compact = false }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 text-center ${
        compact ? 'py-8' : 'h-full min-h-[200px] p-8'
      }`}
    >
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50 text-slate-300 ring-1 ring-inset ring-slate-100">
        <Icon name={icon} size={20} />
      </span>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
