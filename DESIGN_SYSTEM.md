# Frontend design system

One visual language for the whole ERP. Everything below is defined in
`tailwind.config.js` (tokens) and `src/index.css` (component classes). Use these
instead of writing long utility strings in page files — a change here lands on
every page at once.

## Tokens

| Token | Use |
| --- | --- |
| `brand-50…950` | primary actions, active nav, links, focus rings |
| `ink-50…950` | sidebar, modal backdrops, dark surfaces |
| `slate-*` | text, borders, backgrounds (unchanged) |
| `shadow-xs / card / raised / overlay` | the only four elevations |
| `animate-fade-in / scale-in / shimmer` | overlay + skeleton motion |

Type is Inter (loaded in `index.html`, with a system fallback stack). Numbers use
`font-variant-numeric: tabular-nums` in tables and on `.tabular`, so columns align.

## Component classes

**Buttons** — `btn` plus one variant: `btn-primary`, `btn-secondary`,
`btn-danger`, `btn-success`, `btn-neutral`, `btn-ghost`. Sizes: `btn-sm`,
`btn-lg`. Icon-only: `btn-icon` (always add an `aria-label`). Hover, active,
focus-visible and disabled states are built in.

**Forms** — `input` on every input/select/textarea, `label` on labels,
`field-hint` / `field-error` for helper and error text, `input-error` to mark an
invalid field.

**Surfaces** — `card`, `card-pad`, `card-header`, `card-title`.

**Typography** — `page-title`, `page-subtitle`, `section-title`, `eyebrow`.

**Alerts** — `alert` plus `alert-error` / `alert-success` / `alert-warning` /
`alert-info`.

**Tables** — `th` / `td` for hand-rolled tables; prefer `<DataTable>`.

## Shared components (`src/components`)

`Icon` (inline SVG set — no icon dependency), `DataTable` (sticky headers on
desktop, card list on mobile), `Modal`, `ConfirmDialog`, `Badge`, `KpiCard`,
`Pagination`, `EmptyState`, `ErrorState`, `LoadingState`.

`DataTable` columns accept `align: 'right' | 'center'`, `primary: true` (the
field that titles the mobile card) and `hideOnMobile: true`. Right-aligned money
columns already work via the existing `className: 'text-right'`.

## Rules of thumb

- Compact over spacious: this is a data product, not a marketing page.
- Subtle borders and tight shadows; no large gradients or glows.
- Every interactive element needs hover, focus-visible and disabled states.
- Anything wide (tables, code, chip rows) scrolls inside its own container so the
  page body never scrolls sideways.
