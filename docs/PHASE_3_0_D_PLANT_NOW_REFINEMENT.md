# GUVEL Operational — Phase 3.0.D
## Plant Now refinement and lockup text

Base: Phase 3.0.C

### 1. No page shift when opening Plant Now
- Cause: Plant Now is shorter than the other tabs, so on desktops with classic scrollbars
  (Windows) the vertical scrollbar disappeared and the whole page moved ~15 px sideways.
- Fix: `scrollbar-gutter: stable` on the page (and on the fullscreen Dashboard container), so the
  scrollbar space is always reserved.
- The Dashboard area also keeps its height while a tab renders, so the page does not collapse
  and jump during the swap.
- Verified with classic scrollbars: the Filters and Full Screen buttons keep the same position on
  General, Production and Plant Now.

### 2. Part number and operation in the hexagons
- Running machines show: machine code, OEE, part number, operation number ("Op 10") and
  operation name, taken from the active session.
- Idle machines keep code and "Idle".
- Hexagons are larger (104–140 px desktop, 2 per row on phones) so the five lines fit without
  truncation; long names end with an ellipsis as a last resort. Tooltip unchanged.

### 3. Lockup text
- Top-left lockup now reads **GUVEL / Operational System**.
- Same geometry as 3.0.C: the lockup block measures the same 133.5 × 38.5 px; the tagline is
  tracked so its width matches the previous one, and "GUVEL" stays letter-justified to it.
- The login screen keeps the brand tagline "Smarter Industrial Systems".

Cache keys: `style.css?v=3.0.D`, `app.js?v=GUVEL-UI21`. No SQL.

### Validation
- `node --check js/app.js` passes.
- Hexagon content fits (no wrapped code, no truncated line) at 1440, 1024 and 390 px.
- Regression: 14 screens × 7 widths (1920–360 px): no JavaScript errors, no horizontal overflow.
