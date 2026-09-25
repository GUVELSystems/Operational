# GUVEL Operational — Phase 3.0.A
## Design Foundation (new visual identity)

Base: Phase 2.0.H.14

### Identity
- Brand colors: Navy `#0F1B2D`, Cyan `#0CC0DF`, Ice `#EAF2F8`.
- Red is no longer a brand color. It only means stopped / over limit.
- Type: Old Standard TT (wordmark, page and section titles), Barlow (interface),
  Barlow Semi Condensed (figures, tabular digits).
- Panels use a 30° cut corner derived from the logo strokes. No gradients, no drop shadows on cards.
- Top bar and login are always navy.

### Themes
- Light (ice background) and Navy (dark). Default follows the operating system.
- Theme button in the top bar cycles System → Navy → Light; stored per browser (`guvel-theme`).
- Charts read the active theme tokens and are redrawn when the theme changes.

### CSS
- `css/style.css` rewritten from scratch (≈660 lines, 5 `!important` for chart canvas sizing,
  reduced motion and print). Replaces all stacked patch layers from 1.x through 2.0.H.14.
- Covers every class rendered by `app.js` (333 selectors inventoried).
- KPI rows render as a single instrument strip; H.14 content-fit behavior is kept
  (value scales with card width, compact values, no overlap).
- Legacy entrance animations removed. OEE ring and gauge needle keep their value transition.
  `prefers-reduced-motion` disables all motion.

### JS (no data, formula, or Supabase changes)
- Theme bridge in `chartCreate()`: legacy hard-coded chart colors are mapped to theme tokens;
  axis, grid, legend and tooltip colors come from the theme. User-configured KPI/chart colors still win.
- Round charts (doughnut/pie) no longer show empty cartesian axes.
- OEE ring and Plan vs Actual zones use theme colors by default.
- Theme selector (see above).
- Fix: on the first visit to Dashboard the active tab now renders without clicking a tab
  (previously it stayed on "Syncing operational data…" until a tab was clicked).

### Assets
- `assets/guvel-mark-dark.png`: mark for navy backgrounds (top bar, login).
- `assets/guvel-mark-light.png`: mark for light backgrounds (lower strokes in navy instead of ice).
- `assets/favicon.png`, `assets/apple-touch-icon.png` from the navy logo.
- Originals kept: `assets/guvel-logo-navy-2000.png`, `assets/guvel-logo-light-2000.png`.
- Removed: previous red/cyan `assets/guvel-logo.png`.

### Unchanged on purpose
- Custom cursor behavior (now cyan).
- Upper-case labels that come from JS copy (e.g. "GUVEL OPERATIONAL", "PROFILE"): deferred to Phase 3.0.B.
- Markup of each module. Structural changes come in 3.0.B (shell) and 3.0.C (dashboard).

### Validation
- `node --check js/app.js` passes.
- Rendered against a local Supabase mock with demo data (8 machines, 3 shifts, ~600 captures):
  13 screens × 6 widths (1920, 1440, 1280, 1024, 820, 390) in light theme, plus navy at 1440/820/390.
  No JavaScript errors, no horizontal page overflow.
- Checked interactive states: KPI configuration dialog, Status machine modal, Part Number and
  Machine profiles, runtime theme switch.

Deploy: static files only, no SQL. Hard-refresh once (cache keys: `style.css?v=3.0.A`, `app.js?v=GUVEL-UI18`).
Visual acceptance in the deployed portal is pending.
