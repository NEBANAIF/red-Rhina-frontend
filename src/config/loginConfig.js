/**
 * What an admin can change on the sign-in page (Settings > Login page), the built-in wording, and how a saved
 * choice is cleaned before use. Kept free of React. Must match LoginSettingsValidator on the server.
 *
 * The server stores only what the admin changed; anything not set falls back to LOGIN_DEFAULTS, so an empty
 * configuration looks like the sign-in page always did.
 */
import { brightness } from './theme.js';

export const LOGIN_DEFAULTS = {
  title: 'Sign in',
  subtitle: 'Welcome back. Enter your details to continue.',
  tagline: 'Store & Warehouse',
  headline: 'Every branch,\nevery number,\nin one place.',
  description: 'Stock, sales, purchasing and finance stay in sync across your stores and warehouses — in real time.',
  bullets: ['Live multi-branch stock and transfers', 'Point of sale with instant costing', 'Expenses and profit in one ledger'],
  footer: 'Multi-Branch Store & Warehouse ERP',
  buttonLabel: 'Sign in',
  helpText: 'Trouble signing in? Contact your system administrator.',
  layout: 'left',
  pattern: 'grid',
};

export const TEXT_FIELDS = [
  { key: 'title', label: 'Page title', max: 60 },
  { key: 'subtitle', label: 'Text under the title', max: 160 },
  { key: 'buttonLabel', label: 'Button text', max: 30 },
  { key: 'helpText', label: 'Help line at the bottom', max: 120 },
  { key: 'tagline', label: 'Small line under the app name', max: 40 },
  { key: 'headline', label: 'Big message on the side panel', max: 120, multiline: true },
  { key: 'description', label: 'Text under the big message', max: 240, multiline: true },
  { key: 'footer', label: 'Panel footer', max: 80 },
];

export const LAYOUTS = [
  { value: 'left', label: 'Panel on the left' },
  { value: 'right', label: 'Panel on the right' },
  { value: 'center', label: 'Form only, centered' },
];

export const PATTERNS = [
  { value: 'grid', label: 'Fine grid' },
  { value: 'dots', label: 'Dots' },
  { value: 'none', label: 'Plain' },
];

export const MAX_BULLETS = 4;
export const MAX_BULLET_LENGTH = 80;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Keep only values the server would accept (a stale or tampered cache can never reach the page). */
export function cleanLogin(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  TEXT_FIELDS.forEach(({ key, max, multiline }) => {
    if (typeof raw[key] !== 'string') return;
    const text = raw[key].replace(multiline && key === 'headline' ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, ' ').trim();
    if (text && text.length <= max) out[key] = text;
  });
  ['panelColor', 'panelColor2', 'buttonColor'].forEach((key) => {
    if (typeof raw[key] === 'string' && HEX.test(raw[key])) out[key] = raw[key].toLowerCase();
  });
  if (LAYOUTS.some((l) => l.value === raw.layout)) out.layout = raw.layout;
  if (PATTERNS.some((p) => p.value === raw.pattern)) out.pattern = raw.pattern;
  if (Array.isArray(raw.bullets)) {
    out.bullets = raw.bullets
      .filter((b) => typeof b === 'string')
      .map((b) => b.replace(/[\u0000-\u001f\u007f]/g, ' ').trim())
      .filter((b) => b && b.length <= MAX_BULLET_LENGTH)
      .slice(0, MAX_BULLETS);
  }
  return out;
}

export function parseLogin(json) {
  if (!json) return {};
  try { return cleanLogin(JSON.parse(json)); } catch { return {}; }
}

/** The settings to actually draw: what was set, otherwise the built-in wording. */
export function resolveLogin(config) {
  const c = cleanLogin(config);
  return { ...LOGIN_DEFAULTS, ...c, bullets: c.bullets ?? LOGIN_DEFAULTS.bullets };
}

/**
 * Colours of the side panel. With no colour chosen the panel follows the app's look (the sidebar colours from
 * Settings > Appearance), so changing the theme changes the sign-in page too.
 */
export function panelStyle(config) {
  const { panelColor, panelColor2 } = cleanLogin(config);
  if (!panelColor) {
    return {
      background: 'var(--sidebar-bg)', text: 'var(--sidebar-text)', muted: 'var(--sidebar-text-muted)',
      line: 'var(--sidebar-border)', chip: 'var(--sidebar-hover)', light: false,
    };
  }
  const light = brightness(panelColor) > 170;
  const text = light ? '#1f2937' : '#ffffff';
  const rgb = light ? '31,41,55' : '255,255,255';
  return {
    background: panelColor2 ? `linear-gradient(160deg, ${panelColor} 0%, ${panelColor2} 100%)` : panelColor,
    text,
    muted: `rgba(${rgb},0.72)`,
    line: `rgba(${rgb},0.16)`,
    chip: `rgba(${rgb},0.18)`,
    light,
  };
}

export function patternStyle(pattern, light) {
  const c = light ? '#000' : '#fff';
  if (pattern === 'dots') {
    return { opacity: 0.12, backgroundImage: `radial-gradient(${c} 1.5px, transparent 1.5px)`, backgroundSize: '24px 24px' };
  }
  if (pattern === 'none') return null;
  return {
    opacity: 0.07,
    backgroundImage: `linear-gradient(to right,${c} 1px,transparent 1px),linear-gradient(to bottom,${c} 1px,transparent 1px)`,
    backgroundSize: '42px 42px',
  };
}
