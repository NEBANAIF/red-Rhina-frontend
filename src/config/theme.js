/**
 * The look of the app: which options an admin can change in Settings > Appearance, their built-in
 * defaults, and how a chosen theme becomes CSS variables. Kept free of React so it is easy to test.
 *
 * The server stores only the options the admin changed (a small JSON object); anything not set here
 * falls back to the built-in look, so an empty theme looks exactly like the app always has.
 */

export const COLOR_OPTIONS = [
  { key: 'pageBg', label: 'Page background', hint: 'Behind everything on screen', fallback: '#f5f5dc' },
  { key: 'cardBg', label: 'Cards & panels', hint: 'Boxes that hold tables and forms', fallback: '#faf9f0' },
  { key: 'textColor', label: 'Main text', hint: 'Titles, table text, labels', fallback: '#2c2a1c' },
  { key: 'mutedTextColor', label: 'Soft text', hint: 'Hints and small captions', fallback: '#6e674e' },
  { key: 'buttonColor', label: 'Buttons & highlights', hint: 'Main buttons and focus outline', fallback: '#7a7d55' },
  { key: 'sidebarBg', label: 'Sidebar background', hint: 'The menu on the left', fallback: '#707d54' },
  { key: 'sidebarText', label: 'Sidebar text', hint: 'Menu names and icons', fallback: '#f3f1e7' },
  { key: 'sidebarAccent', label: 'Sidebar highlight', hint: 'Active menu item and app name', fallback: '#d3b273' },
  { key: 'tableHeadBg', label: 'Table header', hint: 'The title row of every table', fallback: '#e9eadb' },
  { key: 'tableHeadText', label: 'Table header text', hint: '', fallback: '#6e674e' },
  { key: 'tableRowA', label: 'Table row', hint: 'Odd rows', fallback: '#faf8f2' },
  { key: 'tableRowB', label: 'Table row (alternate)', hint: 'Even rows - same as above for no stripes', fallback: '#f5f4e8' },
];

/**
 * Must match ThemeSettingsValidator on the server. `kind` decides the fallback when the font is missing.
 * `loaded` fonts are already in index.html, `system` fonts need no download; every other font is fetched from
 * Google Fonts only when someone picks it (see loadFont), so adding fonts here never slows the app down.
 */
export const FONTS = [
  { name: 'Inter', kind: 'sans', loaded: true },
  { name: 'Poppins', kind: 'sans', loaded: true },
  { name: 'Roboto', kind: 'sans', loaded: true },
  { name: 'Open Sans', kind: 'sans', loaded: true },
  { name: 'Montserrat', kind: 'sans', loaded: true },
  { name: 'Nunito', kind: 'sans', loaded: true },
  { name: 'Source Sans 3', kind: 'sans', loaded: true },
  { name: 'Lato', kind: 'sans', weights: '400;700' },
  { name: 'Raleway', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Work Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'DM Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Manrope', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Plus Jakarta Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Rubik', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Outfit', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Noto Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'IBM Plex Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Fira Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Quicksand', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Karla', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Mulish', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Josefin Sans', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Space Grotesk', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Figtree', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Ubuntu', kind: 'sans', weights: '400;500;700' },
  { name: 'Barlow', kind: 'sans', weights: '400;500;600;700' },
  { name: 'Arial', kind: 'sans', system: true },
  { name: 'Verdana', kind: 'sans', system: true },
  { name: 'Tahoma', kind: 'sans', system: true },
  { name: 'Trebuchet MS', kind: 'sans', system: true },
  { name: 'Lora', kind: 'serif', loaded: true },
  { name: 'Cormorant Garamond', kind: 'serif', loaded: true },
  { name: 'Playfair Display', kind: 'serif', loaded: true },
  { name: 'Merriweather', kind: 'serif', loaded: true },
  { name: 'Libre Baskerville', kind: 'serif', weights: '400;700' },
  { name: 'Crimson Text', kind: 'serif', weights: '400;600;700' },
  { name: 'EB Garamond', kind: 'serif', weights: '400;500;600;700' },
  { name: 'PT Serif', kind: 'serif', weights: '400;700' },
  { name: 'DM Serif Display', kind: 'serif', weights: '' },
  { name: 'Bitter', kind: 'serif', weights: '400;500;600;700' },
  { name: 'Noto Serif', kind: 'serif', weights: '400;500;600;700' },
  { name: 'Spectral', kind: 'serif', weights: '400;500;600;700' },
  { name: 'Cinzel', kind: 'serif', weights: '400;500;600;700' },
  { name: 'Georgia', kind: 'serif', system: true },
  { name: 'Times New Roman', kind: 'serif', system: true },
  { name: 'JetBrains Mono', kind: 'mono', weights: '400;500;600;700' },
  { name: 'IBM Plex Mono', kind: 'mono', weights: '400;500;600;700' },
  { name: 'Courier New', kind: 'mono', system: true },
];

export const FONT_KINDS = [
  { kind: 'sans', label: 'Sans-serif' },
  { kind: 'serif', label: 'Serif' },
  { kind: 'mono', label: 'Monospace' },
];

export const FONT_OPTIONS = [
  { key: 'bodyFont', label: 'Text font', hint: 'Menus, buttons, forms and general text', fallback: 'Inter' },
  { key: 'headingFont', label: 'Title font', hint: 'Page titles and big numbers', fallback: 'Cormorant Garamond' },
  { key: 'tableFont', label: 'Table font', hint: 'Everything inside tables', fallback: 'Inter' },
];

export const SCALE = { min: 0.85, max: 1.3, step: 0.05 };

const HEX = /^#[0-9a-fA-F]{6}$/;

export const PRESETS = [
  { name: 'Cream & Sage (default)', theme: {} },
  { name: 'Ocean', theme: {
    pageBg: '#eef4f8', cardBg: '#ffffff', textColor: '#14263a', mutedTextColor: '#5a6f84', buttonColor: '#1f6f9f',
    sidebarBg: '#16486b', sidebarText: '#eaf3fa', sidebarAccent: '#7fd0f5', tableHeadBg: '#d6e7f2',
    tableHeadText: '#27506f', tableRowA: '#ffffff', tableRowB: '#f3f8fb' } },
  { name: 'Slate', theme: {
    pageBg: '#f1f2f4', cardBg: '#ffffff', textColor: '#1c1f26', mutedTextColor: '#646b78', buttonColor: '#374151',
    sidebarBg: '#1f2937', sidebarText: '#e5e7eb', sidebarAccent: '#fbbf24', tableHeadBg: '#e5e7eb',
    tableHeadText: '#374151', tableRowA: '#ffffff', tableRowB: '#f7f7f9', bodyFont: 'Inter', headingFont: 'Inter' } },
  { name: 'Rose', theme: {
    pageBg: '#fbf1f2', cardBg: '#fffafa', textColor: '#3a1f26', mutedTextColor: '#86616b', buttonColor: '#a8415b',
    sidebarBg: '#7d2e44', sidebarText: '#fdeef1', sidebarAccent: '#f2c27b', tableHeadBg: '#f4dce1',
    tableHeadText: '#7d2e44', tableRowA: '#fffafa', tableRowB: '#fcf1f3' } },
  { name: 'Forest', theme: {
    pageBg: '#eef3ee', cardBg: '#fbfdfb', textColor: '#17261b', mutedTextColor: '#5d7263', buttonColor: '#2f6b3f',
    sidebarBg: '#1f4a2c', sidebarText: '#e8f3ea', sidebarAccent: '#d9c27a', tableHeadBg: '#d7e8da',
    tableHeadText: '#285335', tableRowA: '#fbfdfb', tableRowB: '#f0f6f1' } },
  { name: 'Teal', theme: {
    pageBg: '#eef6f5', cardBg: '#ffffff', textColor: '#11302e', mutedTextColor: '#547572', buttonColor: '#0f766e',
    sidebarBg: '#115e59', sidebarText: '#e6f6f4', sidebarAccent: '#fcd34d', tableHeadBg: '#d3ece9',
    tableHeadText: '#0f5753', tableRowA: '#ffffff', tableRowB: '#f2f9f8' } },
  { name: 'Sky', theme: {
    pageBg: '#f0f9ff', cardBg: '#ffffff', textColor: '#0c2a3d', mutedTextColor: '#5b7f95', buttonColor: '#0284c7',
    sidebarBg: '#0369a1', sidebarText: '#e8f6fe', sidebarAccent: '#fde68a', tableHeadBg: '#d9eefb',
    tableHeadText: '#075985', tableRowA: '#ffffff', tableRowB: '#f4fafe' } },
  { name: 'Midnight Navy', theme: {
    pageBg: '#f0f2f7', cardBg: '#ffffff', textColor: '#0f172a', mutedTextColor: '#5b6478', buttonColor: '#1e3a8a',
    sidebarBg: '#0f1b3d', sidebarText: '#e2e8f5', sidebarAccent: '#60a5fa', tableHeadBg: '#dfe5f2',
    tableHeadText: '#1e3a8a', tableRowA: '#ffffff', tableRowB: '#f5f7fb', bodyFont: 'Inter', headingFont: 'Inter' } },
  { name: 'Lavender', theme: {
    pageBg: '#f4f1fb', cardBg: '#ffffff', textColor: '#241c3a', mutedTextColor: '#6f6590', buttonColor: '#6d4fc2',
    sidebarBg: '#47347f', sidebarText: '#f0ebfb', sidebarAccent: '#f0c987', tableHeadBg: '#e4ddf6',
    tableHeadText: '#47347f', tableRowA: '#ffffff', tableRowB: '#f7f4fd', headingFont: 'DM Serif Display' } },
  { name: 'Sunset', theme: {
    pageBg: '#fdf3ea', cardBg: '#fffaf5', textColor: '#3b2214', mutedTextColor: '#8a6a55', buttonColor: '#d9622b',
    sidebarBg: '#a8431c', sidebarText: '#fff1e6', sidebarAccent: '#ffd08a', tableHeadBg: '#f9dfca',
    tableHeadText: '#8a3a17', tableRowA: '#fffaf5', tableRowB: '#fcf0e5' } },
  { name: 'Crimson', theme: {
    pageBg: '#fbf3f3', cardBg: '#ffffff', textColor: '#2b1315', mutedTextColor: '#7d5558', buttonColor: '#b91c1c',
    sidebarBg: '#7f1d1d', sidebarText: '#fdecec', sidebarAccent: '#fcd34d', tableHeadBg: '#f6dada',
    tableHeadText: '#7f1d1d', tableRowA: '#ffffff', tableRowB: '#fcf1f1' } },
  { name: 'Coffee', theme: {
    pageBg: '#f4ede6', cardBg: '#fbf7f3', textColor: '#2e1f16', mutedTextColor: '#7d6555', buttonColor: '#7a4a2b',
    sidebarBg: '#4e3222', sidebarText: '#f5ebe2', sidebarAccent: '#e0b97a', tableHeadBg: '#e8d9cb',
    tableHeadText: '#5e3a22', tableRowA: '#fbf7f3', tableRowB: '#f5ece3', headingFont: 'Lora' } },
  { name: 'Gold & Black', theme: {
    pageBg: '#faf6ec', cardBg: '#fffdf7', textColor: '#1c1a14', mutedTextColor: '#7a7258', buttonColor: '#b8860b',
    sidebarBg: '#1a1a1a', sidebarText: '#f3efe2', sidebarAccent: '#e6b94a', tableHeadBg: '#efe5c9',
    tableHeadText: '#6b5410', tableRowA: '#fffdf7', tableRowB: '#f8f2e1', headingFont: 'Playfair Display' } },
  { name: 'Graphite', theme: {
    pageBg: '#f4f4f5', cardBg: '#ffffff', textColor: '#18181b', mutedTextColor: '#71717a', buttonColor: '#18181b',
    sidebarBg: '#27272a', sidebarText: '#f4f4f5', sidebarAccent: '#d4d4d8', tableHeadBg: '#e4e4e7',
    tableHeadText: '#3f3f46', tableRowA: '#ffffff', tableRowB: '#fafafa', bodyFont: 'Inter', headingFont: 'Inter' } },
];

/** Keep only values the server would accept (so a stale or tampered cache can never reach the CSS). */
export function cleanTheme(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  COLOR_OPTIONS.forEach(({ key }) => { if (typeof raw[key] === 'string' && HEX.test(raw[key])) out[key] = raw[key].toLowerCase(); });
  FONT_OPTIONS.forEach(({ key }) => { if (FONTS.some((f) => f.name === raw[key])) out[key] = raw[key]; });
  const scale = Number(raw.fontScale);
  if (Number.isFinite(scale) && scale >= SCALE.min && scale <= SCALE.max) out.fontScale = Math.round(scale * 100) / 100;
  return out;
}

export function parseTheme(json) {
  if (!json) return {};
  try { return cleanTheme(JSON.parse(json)); } catch { return {}; }
}

/* --------------------------------------------------------------- colour maths */

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** Mix `a` toward `b` by t (0..1). */
export const mix = (a, b, t) => { const x = toRgb(a); const y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const rgba = (hex, alpha) => { const [r, g, b] = toRgb(hex); return `rgba(${r},${g},${b},${alpha})`; };

const toHsl = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2; const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
};
const fromHsl = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(((h % 360) + 360) % 360 / 60)];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
};

/**
 * The ten dashboard KPI card tints, all from the colour family of the chosen look (a red theme gives soft reds,
 * a blue theme soft blues). Each card moves a little in hue and lightness so a row of cards is not ten copies of
 * one colour. Meaning colours (green "good", red "warning") are set in KpiCard and are never themed.
 */
const KPI_HUE_SHIFT = [0, -8, 7, -14, 12, -4, 10, -10, 4, 14];
const KPI_LIGHT = [0.955, 0.967, 0.961, 0.972, 0.964, 0.958, 0.970, 0.962, 0.968, 0.959];
export function kpiVars(base) {
  const [h, s] = toHsl(base);
  const neutral = s < 0.08; // greys stay grey instead of picking up a random hue
  const v = {};
  KPI_HUE_SHIFT.forEach((shift, i) => {
    const hue = neutral ? h : h + shift;
    v[`--kpi-${i}`] = fromHsl(hue, neutral ? 0.03 : Math.min(0.55, Math.max(0.22, s * 0.6)), KPI_LIGHT[i]);
    v[`--kpi-b-${i}`] = rgba(fromHsl(hue, neutral ? 0.03 : Math.min(0.6, Math.max(0.25, s * 0.7)), 0.55), 0.3);
  });
  v['--kpi-accent'] = base;
  v['--kpi-accent-soft'] = rgba(base, 0.14);
  return v;
}

/** Perceived brightness 0..255 - used to pick readable text on a colour. */
export const brightness = (hex) => { const [r, g, b] = toRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000; };

const fontStack = (name) => {
  const f = FONTS.find((x) => x.name === name);
  const quoted = name.includes(' ') ? `"${name}"` : name;
  if (f?.kind === 'serif') return `${quoted}, Georgia, ui-serif, serif`;
  if (f?.kind === 'mono') return `${quoted}, ui-monospace, SFMono-Regular, Menlo, monospace`;
  return `${quoted}, ui-sans-serif, system-ui, sans-serif`;
};

/** Fetch a Google font the first time it is needed (fonts already in index.html and system fonts are skipped). */
export function loadFont(name, doc = typeof document !== 'undefined' ? document : null) {
  const f = FONTS.find((x) => x.name === name);
  if (!doc || !f || f.loaded || f.system) return;
  const id = `gf-${f.name.replace(/\s+/g, '-').toLowerCase()}`;
  if (doc.getElementById(id)) return;
  const family = f.name.replace(/ /g, '+') + (f.weights ? `:wght@${f.weights}` : '');
  const link = doc.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  doc.head.appendChild(link);
}

const pick = (theme, key) => theme[key] || COLOR_OPTIONS.find((o) => o.key === key).fallback;

/** The CSS variables for a theme. Only what was customised is overridden; the rest keeps the stylesheet defaults. */
export function themeToCssVars(themeIn) {
  const theme = cleanTheme(themeIn);
  const v = {};
  if (theme.pageBg) { v['--bg'] = theme.pageBg; v['--bg-translucent'] = rgba(theme.pageBg, 0.92); }
  if (theme.cardBg) {
    v['--card-bg'] = theme.cardBg;
    v['--input-bg'] = rgba(theme.cardBg, 0.85);
    v['--input-bg-focus'] = mix(theme.cardBg, '#ffffff', 0.5);
  }
  if (theme.textColor) v['--text'] = theme.textColor;
  if (theme.mutedTextColor) v['--text-muted'] = theme.mutedTextColor;
  if (theme.buttonColor) { v['--sidebar'] = theme.buttonColor; v['--ring'] = rgba(theme.buttonColor, 0.35); v['--card-border'] = rgba(theme.buttonColor, 0.2); }

  if (theme.sidebarBg) {
    const c = theme.sidebarBg;
    v['--sidebar-bg'] = `linear-gradient(180deg, ${mix(c, '#000000', 0.22)} 0%, ${c} 55%, ${mix(c, '#000000', 0.28)} 100%)`;
  }
  if (theme.sidebarText || theme.sidebarAccent) {
    const text = pick(theme, 'sidebarText');
    const accent = pick(theme, 'sidebarAccent');
    v['--sidebar-text'] = text;
    v['--sidebar-text-muted'] = rgba(text, 0.62);
    v['--sidebar-accent'] = accent;
    v['--sidebar-accent-soft'] = rgba(accent, 0.18);
    v['--sidebar-border'] = rgba(accent, 0.2);
    v['--sidebar-active-bg'] = `linear-gradient(90deg, ${rgba(accent, 0.24)} 0%, ${rgba(accent, 0.07)} 100%)`;
    v['--sidebar-hover'] = rgba(text, 0.08);
  }

  if (theme.tableHeadBg) { v['--th-bg'] = theme.tableHeadBg; }
  if (theme.tableHeadText) v['--th-text'] = theme.tableHeadText;
  if (theme.tableRowA) v['--row-a'] = theme.tableRowA;
  if (theme.tableRowB) v['--row-b'] = theme.tableRowB;
  if (theme.tableHeadBg || theme.tableRowA) {
    // hover colour: the header colour at low strength, so it always suits the chosen table colours
    v['--row-hover'] = rgba(pick(theme, 'tableHeadBg'), 0.55);
  }

  const kpiBase = theme.buttonColor || theme.sidebarBg;
  if (kpiBase) Object.assign(v, kpiVars(kpiBase));

  if (theme.bodyFont) { v['--font-ui'] = fontStack(theme.bodyFont); v['--font-body'] = fontStack(theme.bodyFont); }
  if (theme.headingFont) v['--font-heading'] = fontStack(theme.headingFont);
  if (theme.tableFont) v['--font-table'] = fontStack(theme.tableFont);
  if (theme.fontScale) v['--font-scale'] = String(theme.fontScale);
  return v;
}

/** Every variable this file can set - so switching back to default can remove them all. */
export const ALL_VARS = [
  '--bg', '--card-bg', '--card-border', '--text', '--text-muted', '--sidebar', '--ring', '--sidebar-bg', '--sidebar-text',
  '--sidebar-text-muted', '--sidebar-accent', '--sidebar-accent-soft', '--sidebar-border', '--sidebar-active-bg',
  '--sidebar-hover', '--th-bg', '--th-text', '--row-a', '--row-b', '--row-hover', '--font-ui', '--font-body',
  '--font-heading', '--font-table', '--font-scale', '--bg-translucent', '--input-bg', '--input-bg-focus',
  ...Array.from({ length: 10 }, (_, i) => `--kpi-${i}`), ...Array.from({ length: 10 }, (_, i) => `--kpi-b-${i}`),
  '--kpi-accent', '--kpi-accent-soft',
];

export function applyTheme(theme, root = document.documentElement) {
  ALL_VARS.forEach((name) => root.style.removeProperty(name));
  const vars = themeToCssVars(theme);
  ['bodyFont', 'headingFont', 'tableFont'].forEach((k) => { if (theme[k]) loadFont(theme[k]); });
  Object.entries(vars).forEach(([k, val]) => root.style.setProperty(k, val));
  const bg = vars['--bg'] || '#f5f5dc';
  root.style.setProperty('background-color', bg);
  try { document.body.style.background = bg; } catch { /* body not ready yet */ }
}
