import React from 'react';

export default function LoadingState({ label = 'Loading...', compact = false }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 text-ink-500 ${
        compact ? 'py-8' : 'h-full min-h-[200px] p-8'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-8 w-8">
        <span className="absolute inset-0 rounded-full border-2 border-cream-300" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-sage-600" />
      </span>
      <p className="text-sm">{label}</p>
    </div>
  );
}
