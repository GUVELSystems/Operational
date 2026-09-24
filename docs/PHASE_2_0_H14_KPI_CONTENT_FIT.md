# GUVEL Operational — Phase 2.0.H.14
## Quality & Downtime KPI Content Fit

Base: Phase 2.0.H.13

### Problem fixed
H.11–H.13 controlled the card with fixed heights. The real constraint was width:
between ~1150px and ~1440px the six-column layout left 54–98px for the value, so
values overlapped the connector/icon, and "No prior data / vs Previous Period"
wrapped and was clipped at the bottom of the card.

### Changes
- CSS: removed fixed card/body heights. Cards use `min-height:132px` and grow with
  their content; cards in the same row keep equal height (grid stretch).
- CSS: the KPI value scales with the card width (`clamp(17px, 12.5cqi, 25px)`,
  container query units) and has an ellipsis as a last-resort guard.
- CSS: Quality/Downtime switch to 3 columns below 1280px (was 1150px), 2 columns
  below 720px, 1 column below 460px.
- CSS: comparison text can wrap to a second line instead of being clipped.
- CSS: removed `overflow:hidden` from `.kpi-body` so the threshold LED pulse is not cut.
- CSS: LED pulse is disabled under `prefers-reduced-motion`.
- JS: `dashFit()` shows a compact value (e.g. `1.23M`, `123.46K`) only when the full
  value is longer than 9 characters. The full value is always in the `title` tooltip.
  Applies to Quality and Downtime KPI cards only. Null handling unchanged.
- index.html: cache-busting synced (`style.css?v=2.0.H.14`, `app.js?v=GUVEL-UI17`).
  Previously the CSS was still referenced as `v=2.0.H.7`.

### Explicitly unchanged
KPI formulas, thresholds, colors, gear configuration, delta calculation, General and
Production dashboards, SQL/RLS.

### Validation
- `node --check js/app.js` passes.
- Rendered in headless Chromium at 1920, 1440, 1280, 1279, 1160, 1024, 900, 800, 721,
  600, 461, 390 and 360px, with worst-case values and with the "No prior data" state:
  no value/icon overlap, no clipped comparison text, no ellipsis triggered.

Visual acceptance in the deployed portal is still pending.
