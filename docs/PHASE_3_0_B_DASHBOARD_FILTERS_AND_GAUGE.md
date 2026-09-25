# GUVEL Operational — Phase 3.0.B
## Compact Dashboard filters, no period dates, animated Plan vs Actual needle

Base: Phase 3.0.A

### 1. Filters in a popover
- The always-visible "Dashboard Filters" panel is removed from the page.
- A **Filters** button sits next to the live badge ("Live operational view", "Production
  intelligence", etc.) on every Dashboard tab. It shows the number of active filters
  (customer, part number, shift, machine, and a period other than "This Month").
- The button opens a window with Period, Date From, Date To, Customer, Part Number, Shift and
  Machine, plus Clear filters, Refresh data and Done.
- Filters still apply as soon as a value changes; the window stays open while you adjust them.
- Closes with Done, ×, Escape or a click outside. On phones (≤720px) it opens as a bottom sheet.
- The "No Data" state also shows the Filters button, so a filter that returns nothing can be undone.
- The record summary line (captures, scrap and downtime events) now lives inside the window.

### 2. Period dates hidden
- Removed the line "YYYY-MM-DD → YYYY-MM-DD · Compared with …" from the overview header of
  General, Production, Quality and Downtime.
- The "Period … · Previous comparison …" hint is also hidden (element kept for compatibility).
- Comparison logic is unchanged; KPI deltas still read "vs Previous Month/Period".

### 3. Plan vs Actual needle
- The needle now sweeps from 0% to the result in 1.6 s (ease-out), and the percentage in the
  gauge counts up in sync. It replays each time the Production tab renders (tab change or filter change).
- With "reduce motion" enabled in the OS, the needle and value appear at the final position.
- Values above 100% keep the needle at the end of the scale while the figure shows the real value.

### Fix
- Chart panels in the same row are now aligned. The 3.0.A alignment rule lost on CSS specificity
  and did not take effect; it is corrected here.

### Files
`index.html` (cache keys `style.css?v=3.0.B`, `app.js?v=GUVEL-UI19`), `css/style.css`, `js/app.js`.
No SQL, no data or formula changes.

### Validation
- `node --check js/app.js` passes.
- Automated checks at 1440px and 390px: popover opens, stays open while changing Customer,
  badge shows "1", `aria-expanded` follows the state, Escape closes it; no "Compared with" text in
  the Dashboard; needle mid-sweep at ~350 ms and final angle after 1.8 s; "No Data" state
  shows the Filters button.
- Regression: 13 screens × 6 widths (1920–390px), navy theme: no JavaScript errors, no horizontal overflow.
