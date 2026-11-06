import React from 'react';
import Icon from '../components/Icon.jsx';
import { cleanLogin, panelStyle, patternStyle, resolveLogin } from '../config/loginConfig.js';

/**
 * The look of the sign-in page, drawn from a configuration (Settings > Login page). Used twice: by LoginPage
 * with the real form, and by the settings screen with a static form so changes can be previewed.
 * `preview` makes it fit a box instead of the whole window and always shows the side panel.
 */
export default function LoginScreen({ config, appName, preview = false, children }) {
  const c = resolveLogin(config);
  const panel = panelStyle(config);
  const pattern = patternStyle(c.pattern, panel.light);
  const showPanel = c.layout !== 'center';
  const panelFirst = c.layout !== 'right';

  const aside = showPanel && (
    <aside
      className={`relative w-[46%] max-w-xl shrink-0 overflow-hidden ${preview ? 'flex' : 'hidden lg:flex'} flex-col justify-between`}
      style={{ background: panel.background }}
    >
      {pattern && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={pattern} />}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 50% at 15% 0%,rgba(255,255,210,0.14) 0%,transparent 65%)' }} />

      <div className="relative px-10 pt-10">
        <Brandmark appName={appName} tagline={c.tagline} color={panel.text} mutedColor={panel.muted} chip={panel.chip} />
      </div>

      <div className="relative px-10 pb-14">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, color: panel.text, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {c.headline.split('\n').map((line, i, all) => (
            <React.Fragment key={i}>{line}{i < all.length - 1 && <br />}</React.Fragment>
          ))}
        </h2>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: panel.muted, fontFamily: 'var(--font-ui)', maxWidth: 340 }}>
          {c.description}
        </p>
        {c.bullets.length > 0 && (
          <ul className="mt-8 space-y-3">
            {c.bullets.map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm" style={{ color: panel.text, fontFamily: 'var(--font-ui)' }}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: panel.chip }}>
                  <Icon name="check" size={11} strokeWidth={2.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative px-10 py-5 text-xs" style={{ borderTop: `1px solid ${panel.line}`, color: panel.muted, fontFamily: 'var(--font-ui)' }}>
        {c.footer}
      </div>
    </aside>
  );

  return (
    <div
      className={`flex ${preview ? 'min-h-[620px]' : 'min-h-screen'} ${panelFirst ? '' : 'flex-row-reverse'}`}
      style={{ background: 'var(--bg)' }}
    >
      {aside}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className={`w-full max-w-[390px] ${c.layout === 'center' ? 'card card-pad' : ''}`}>
          <div className={`mb-8 ${c.layout === 'center' ? '' : preview ? 'hidden' : 'lg:hidden'}`}>
            <Brandmark appName={appName} tagline={c.tagline} color="var(--text)" mutedColor="var(--text-muted)" solid />
          </div>

          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {c.title}
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {c.subtitle}
          </p>

          {children}

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {c.helpText}
          </p>
        </div>
      </main>
    </div>
  );
}

/** Colour of the sign-in button: the one chosen for the page, otherwise the app's main button colour. */
export function loginButtonColor(config) {
  return cleanLogin(config).buttonColor || 'var(--sidebar)';
}

/** A form that only looks like the real one - for the preview in Settings. */
export function PreviewForm({ config }) {
  const c = resolveLogin(config);
  return (
    <div className="mt-8 space-y-5" aria-hidden="true">
      {[['Email', 'mail', 'you@company.com'], ['Password', 'lock', '••••••••']].map(([label, icon, placeholder]) => (
        <div key={label}>
          <span className="label">{label}</span>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center" style={{ color: 'var(--kpi-accent, #a3a676)' }}>
              <Icon name={icon} size={16} />
            </span>
            <input className="input pl-10" disabled placeholder={placeholder} tabIndex={-1} />
          </div>
        </div>
      ))}
      <div className="btn btn-lg w-full" style={{ background: loginButtonColor(config), color: '#fff', fontFamily: 'var(--font-ui)' }}>
        {c.buttonLabel}
      </div>
    </div>
  );
}

function Brandmark({ appName, tagline, color, mutedColor, chip, solid = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-xs"
        style={{ background: solid ? 'var(--sidebar)' : chip, color: solid ? '#fff' : color }}>
        <Icon name="inventory" size={20} strokeWidth={2} />
      </span>
      <div>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600, color, letterSpacing: '-0.01em' }}>{appName}</p>
        {tagline && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: mutedColor }}>{tagline}</p>}
      </div>
    </div>
  );
}
