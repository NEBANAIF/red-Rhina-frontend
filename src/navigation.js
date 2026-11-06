// The single list of pages and what each one needs. Used by the router (App.jsx) to
// guard a route AND by the sidebar to hide links the user cannot open, so the two can
// never disagree. `permissions` is OR: holding any one of them opens the page. Which
// role holds which permission is set on the Roles & Permissions page. `icon` names an
// entry in components/Icon.jsx and is used by the sidebar only. `branchTypes` (optional) limits a page to
// the kinds of place that use it - STORE, WAREHOUSE, FACTORY - so a factory never sees the POS and a store never
// sees production; a page without it is shown everywhere.
export const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'dashboard', permissions: ['DASHBOARD_VIEW'] },
      { label: 'Branches', to: '/branches', icon: 'branches', permissions: ['BRANCH_MANAGE'] },
      { label: 'Branch Products', to: '/branch-products', icon: 'check', permissions: ['BRANCH_MANAGE'] },
      { label: 'Notifications', to: '/notifications', icon: 'bell', permissions: ['ACTIVITY_VIEW'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'POS', branchTypes: ['STORE'], to: '/pos', icon: 'pos', permissions: ['POS_ACCESS'] },
      { label: 'Sales History', branchTypes: ['STORE', 'FACTORY'], to: '/sales-history', icon: 'sales', permissions: ['SALES_VIEW'] },
      { label: 'Customers', branchTypes: ['STORE'], to: '/customers', icon: 'customers', permissions: ['CUSTOMER_VIEW', 'POS_ACCESS'] },
      { label: 'Loans', branchTypes: ['STORE'], to: '/loans', icon: 'loans', permissions: ['LOAN_VIEW'] },
      // Customer returns list needs RETURN_VIEW; supplier returns open for the purchasing switches.
      { label: 'Returns', to: '/returns', icon: 'returns', permissions: ['RETURN_VIEW', 'PURCHASE_RECEIVE', 'SUPPLIER_MANAGE'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Inventory', to: '/inventory', icon: 'inventory', permissions: ['INVENTORY_VIEW'] },
      { label: 'Batches', to: '/batches', icon: 'batches', permissions: ['BATCH_VIEW'] },
      { label: 'Transfers', to: '/transfers', icon: 'transfers', permissions: ['TRANSFER_CREATE', 'TRANSFER_APPROVE', 'TRANSFER_RECEIVE'] },
      { label: 'Stock History', to: '/stock-history', icon: 'history', permissions: ['STOCK_HISTORY_VIEW'] },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { label: 'Suppliers', branchTypes: ['WAREHOUSE', 'FACTORY'], to: '/suppliers', icon: 'suppliers', permissions: ['SUPPLIER_MANAGE', 'PURCHASE_CREATE'] },
      // One entry: the page combines creating orders with the full order list (history).
      { label: 'Purchases', branchTypes: ['WAREHOUSE', 'FACTORY'], to: '/purchases', icon: 'purchases', permissions: ['PURCHASE_CREATE', 'PURCHASE_RECEIVE'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Finance', to: '/finance', icon: 'finance', permissions: ['FINANCE_VIEW'] },
      { label: 'Expenses', to: '/expenses', icon: 'expenses', permissions: ['EXPENSE_CREATE', 'EXPENSE_VIEW'] },
      { label: 'Payments', to: '/payments', icon: 'payments', permissions: ['PAYMENT_VIEW'] },
      { label: 'My Credits & Loans', to: '/debts', icon: 'loans', permissions: ['DEBT_VIEW'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      // One entry: the page covers products, growth and branch comparison.
      { label: 'Reports', to: '/reports', icon: 'reports', permissions: ['REPORT_VIEW'] },
    ],
  },
  {
    label: 'Manufacturing',
    items: [
      { label: 'Manufacturing Dashboard', branchTypes: ['FACTORY'], to: '/manufacturing/dashboard', icon: 'dashboard', permissions: ['MFG_DASHBOARD'] },
      { label: 'Raw Material Management', branchTypes: ['FACTORY'], to: '/manufacturing/materials', icon: 'batches', permissions: ['MFG_MATERIALS'] },
      { label: 'Raw Material Purchases', branchTypes: ['FACTORY'], to: '/manufacturing/purchases', icon: 'batches', permissions: ['MFG_PURCHASES'] },
      { label: 'Reports', branchTypes: ['FACTORY'], to: '/manufacturing/reports', icon: 'reports', permissions: ['MFG_REPORTS'] },
      { label: 'Direct Sales', branchTypes: ['FACTORY'], to: '/manufacturing/direct-sales', icon: 'sales', permissions: ['MFG_DIRECT_SALES'] },
      { label: 'Bills of Materials', branchTypes: ['FACTORY'], to: '/manufacturing/boms', icon: 'batches', permissions: ['MFG_BOMS'] },
      { label: 'Production Orders', branchTypes: ['FACTORY'], to: '/manufacturing/production', icon: 'inventory', permissions: ['MFG_PRODUCTION'] },
      { label: 'Quality Control', branchTypes: ['FACTORY'], to: '/manufacturing/quality', icon: 'inbox', permissions: ['MFG_QUALITY'] },
      { label: 'Machines & Maintenance', branchTypes: ['FACTORY'], to: '/manufacturing/machines', icon: 'settings', permissions: ['MFG_MACHINES'] },
    ],
  },
  {
    label: 'Human Resources',
    items: [
      { label: 'HR Dashboard', to: '/hr/dashboard', icon: 'dashboard', permissions: ['HR_VIEW'] },
      { label: 'Employees', to: '/hr/employees', icon: 'users', permissions: ['HR_VIEW'] },
      { label: 'Live Attendance', to: '/hr/live-attendance', icon: 'calendar', permissions: [] },
      { label: 'Attendance Sheet', to: '/hr/attendance', icon: 'calendar', permissions: ['HR_VIEW'] },
      { label: 'Leave', to: '/hr/leave', icon: 'inbox', permissions: ['HR_VIEW'] },
      { label: 'Payroll', to: '/hr/payroll', icon: 'payments', permissions: ['PAYROLL_VIEW'] },
      { label: 'My Payslips', to: '/hr/my-payslips', icon: 'payments', permissions: [] },
      { label: 'Meetings', to: '/hr/meetings', icon: 'inbox', permissions: ['MEETING_VIEW', 'MEETING_MANAGE'] },
      { label: 'Company Hierarchy', to: '/hr/hierarchy', icon: 'branches', permissions: ['HR_VIEW'] },
      { label: 'Departments & Shifts', to: '/hr/setup', icon: 'building', permissions: ['HR_VIEW'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', to: '/users', icon: 'users', permissions: ['USER_MANAGE'] },
      { label: 'Roles & Permissions', to: '/roles', icon: 'roles', permissions: ['USER_MANAGE'] },
      { label: 'Settings', to: '/settings', icon: 'settings', permissions: ['SETTINGS_MANAGE'] },
    ],
  },
];

/** path -> permissions needed, derived from the list above. */
export const ROUTE_PERMISSIONS = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.to, item.permissions])),
);

function canOpen(item, hasPermission, branchType) {
  if (branchType && item.branchTypes && !item.branchTypes.includes(branchType)) return false;
  return item.permissions.length === 0 || item.permissions.some((p) => hasPermission(p));
}

/** The kind of place a role works at, from its base role name (STORE_MANAGER -> STORE); null for the Administrator. */
export function branchTypeOfRole(role) {
  if (!role || role === 'ADMINISTRATOR') return null;
  const prefix = String(role).split('_')[0];
  return ['STORE', 'WAREHOUSE', 'FACTORY'].includes(prefix) ? prefix : null;
}

export const MANUFACTURING_PATH = '/manufacturing';
export const MANUFACTURING_DASHBOARD_PATH = '/manufacturing/dashboard';

/**
 * Modules: a part of the app with its own menu. Inside a module only that module's pages are shown (plus a way back);
 * everywhere else the module is a single entry in the main menu that opens its first page.
 */
const MODULES = [
  { section: 'Manufacturing', path: '/manufacturing', entry: '/manufacturing/dashboard', icon: 'inventory', label: 'Manufacturing' },
  { section: 'Human Resources', path: '/hr', entry: '/hr/dashboard', icon: 'users', label: 'Human Resources' },
];

const inPath = (pathname, base) => pathname === base || pathname.startsWith(`${base}/`);

/** True for every Manufacturing page (they all live under /manufacturing). */
export function isManufacturingPath(pathname) {
  return inPath(pathname, MANUFACTURING_PATH);
}

/** The module a page belongs to ({ section, label, ... }) or null for the main menu. */
export function moduleForPath(pathname) {
  return MODULES.find((m) => inPath(pathname, m.path)) ?? null;
}

/**
 * The sections and links this user may see; a section with no links left is dropped. `activeModule` is the section name of the
 * module being used (see moduleForPath): only its pages are listed, with a "Back to main menu" link.
 */
export function visibleSections(hasPermission, branchType = null, activeModule = null) {
  const all = NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => canOpen(item, hasPermission, branchType)) }))
    .filter((section) => section.items.length > 0);
  const moduleNames = new Set(MODULES.map((m) => m.section));
  const others = all.filter((s) => !moduleNames.has(s.label));

  if (activeModule) {
    const section = all.find((s) => s.label === activeModule);
    if (section) {
      const back = others[0]?.items[0]?.to;
      const sections = [];
      if (back) sections.push({ label: 'Menu', items: [{ label: 'Back to main menu', to: back, icon: 'chevronLeft' }] });
      sections.push(section);
      return sections;
    }
  }
  return all.map((s) => {
    const m = MODULES.find((x) => x.section === s.label);
    if (!m) return s;
    const entry = s.items.find((i) => i.to === m.entry) ?? s.items[0];
    return { label: m.section, items: [{ label: m.label, to: entry.to, icon: m.icon, permissions: entry.permissions }] };
  });
}

/** Where to send someone who has just logged in: the first page they can open, or null if none. */
export function firstAllowedPath(hasPermission, branchType = null) {
  // someone who works at a factory starts in Manufacturing, on its dashboard
  if (branchType === 'FACTORY') {
    const dash = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.to === MANUFACTURING_DASHBOARD_PATH);
    if (dash && canOpen(dash, hasPermission, branchType)) return dash.to;
  }
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (canOpen(item, hasPermission, branchType)) return item.to;
    }
  }
  return null;
}
