import React from 'react';

/**
 * Tiny inline icon set. Deliberately NOT a new npm dependency: the project
 * ships with no icon library, and inline SVG keeps the bundle unchanged
 * while giving every icon the same 24px grid, stroke weight and joins.
 *
 * Usage:  <Icon name="eye" />            (1em, inherits text colour)
 *         <Icon name="plus" size={16} />
 *
 * Every icon inherits `currentColor`, so colour comes from the parent's
 * text colour like any other glyph.
 */

const P = (d, key) => <path key={key} d={d} />;

const ICONS = {
  /* ---- navigation ---- */
  dashboard: [P('M3 3h7v8H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 15h7v6H3z')],
  bell: [P('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'a'), P('M10.3 21a1.94 1.94 0 0 0 3.4 0', 'b')],
  branches: [P('M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h2a2 2 0 0 1 2 2v10M9 7h2M9 11h2M9 15h2')],
  pos: [P('M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM2 3h2.2a1 1 0 0 1 1 .8L6 8m0 0 1.6 7.6a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21.5 8z')],
  sales: [P('M4 3v18l2.5-1.6L9 21l2.5-1.6L14 21l2.5-1.6L19 21V3l-2.5 1.6L14 3l-2.5 1.6L9 3 6.5 4.6zM8 8h8M8 12h8M8 16h5')],
  customers: [P('M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 20v-1.5a4 4 0 0 0-3-3.85M16 4.15a4 4 0 0 1 0 7.7')],
  loans: [P('M20 8H5a2 2 0 0 1 0-4h13v4zM3 6v12a2 2 0 0 0 2 2h15v-4M3 10h17v4H3zM17 12h.01')],
  returns: [P('M3 8h11a5 5 0 0 1 0 10H8M3 8l4-4M3 8l4 4')],
  inventory: [P('m12 2 8.5 4.5v9L12 20l-8.5-4.5v-9zM3.7 6.8 12 11.3l8.3-4.5M12 11.3V20')],
  batches: [P('m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5')],
  transfers: [P('M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4')],
  history: [P('M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5M12 7v5l3.5 2')],
  suppliers: [P('M1 6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v10H1zM14 9h3.6a1 1 0 0 1 .82.42L21 13v3h-7zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z')],
  purchases: [P('M4 7h16l-1.2 12.1a2 2 0 0 1-2 1.9H7.2a2 2 0 0 1-2-1.9zM8.5 10V6a3.5 3.5 0 1 1 7 0v4')],
  finance: [P('M3 20h18M6 20V9M11 20V4M16 20v-7M21 20v-4')],
  expenses: [P('M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3l-2 1.4L15 3l-2 1.4L11 3 9 4.4 7 3zM9 8h6M9 12h6M9 16h3')],
  payments: [P('M2 6.5A1.5 1.5 0 0 1 3.5 5h17A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5zM2 10h20M6 15h3')],
  reports: [P('M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zM14 2v5h5M9 17v-3M12 17v-6M15 17v-4')],
  users: [P('M17 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM22 14.5a3.2 3.2 0 0 0-2.6-2')],
  roles: [P('M12 2.5 20 6v6c0 4.5-3.2 8.4-8 9.5-4.8-1.1-8-5-8-9.5V6zM9 12l2 2 4-4')],
  settings: [P('M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M19.3 14.3a1.5 1.5 0 0 0 .3 1.65l.06.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37V20a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.06.06A1.8 1.8 0 1 1 4.66 16.3l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H4a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.06A1.8 1.8 0 1 1 7.66 4.85l.06.06a1.5 1.5 0 0 0 1.65.3H9.5a1.5 1.5 0 0 0 .9-1.37V4a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0-.3 1.65v.04a1.5 1.5 0 0 0 1.37.9H20a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.37.9z')],

  /* ---- interface ---- */
  eye: [P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'), P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'b')],
  'eye-off': [P('M10.7 6.1A8.9 8.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.9 3.6M6.5 7.6A16.8 16.8 0 0 0 2.5 12S6 18 12 18a9.4 9.4 0 0 0 4-.85'), P('M9.9 10.1a3 3 0 0 0 4.2 4.2', 'b'), P('M3 3l18 18', 'c')],
  menu: [P('M3 6h18M3 12h18M3 18h18')],
  close: [P('M6 6l12 12M18 6L6 18')],
  chevronDown: [P('m6 9 6 6 6-6')],
  chevronLeft: [P('m15 18-6-6 6-6')],
  chevronRight: [P('m9 18 6-6-6-6')],
  search: [P('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3')],
  plus: [P('M12 5v14M5 12h14')],
  check: [P('m20 6-11 11-5-5')],
  warning: [P('M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01')],
  error: [P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v5M12 16h.01')],
  info: [P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01')],
  inbox: [P('M22 12h-6l-2 3h-4l-2-3H2M5.45 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.9A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.1z')],
  logout: [P('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9')],
  user: [P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z')],
  lock: [P('M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7.5 11V7a4.5 4.5 0 1 1 9 0v4')],
  mail: [P('M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM2.5 6.5l9.5 7 9.5-7')],
  refresh: [P('M21 12a9 9 0 1 1-2.6-6.4M21 3v5h-5')],
  trash: [P('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6')],
  edit: [P('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')],
  filter: [P('M3 5h18l-7 8v6l-4 2v-8z')],
  download: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')],
  calendar: [P('M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 10h18M8 3v4M16 3v4')],
  building: [P('M3 21h18M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 8h4a1 1 0 0 1 1 1v12M9 7h2M9 11h2M9 15h2')],
  trendUp: [P('M22 7 13.5 15.5 9 11l-7 7M16 7h6v6')],
  trendDown: [P('M22 17 13.5 8.5 9 13l-7-7M16 17h6v-6')],
};

export default function Icon({ name, size, className = '', strokeWidth = 1.75, ...rest }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size || '1em'}
      height={size || '1em'}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {paths}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(ICONS);
