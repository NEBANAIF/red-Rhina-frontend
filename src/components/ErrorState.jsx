import React from 'react';
import Icon from './Icon.jsx';

export default function ErrorState({ message = 'Something went wrong.', onRetry, compact = false }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 text-center ${
        compact ? 'py-8' : 'h-full min-h-[200px] p-8'
      }`}
      role="alert"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-inset ring-red-100">
        <Icon name="warning" size={20} />
      </span>
      <p className="max-w-md text-sm font-medium text-ink-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm">
          <Icon name="refresh" size={14} />
          Try again
        </button>
      )}
    </div>
  );
}
