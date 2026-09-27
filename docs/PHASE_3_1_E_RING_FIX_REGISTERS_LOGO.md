# GUVEL Operational — Phase 3.1.E
## OEE ring spacing, Registers machine fix, smaller logo

Base: Phase 3.1.D

### 1. OEE ring: the percentage no longer overlaps the rings
The core circle was too small for its own content. It's now sized generously (96px, up from
68px) with a clear gap to the innermost ring, and the percentage, "OEE" and the state chip
("On track" / "Watch" / "Attention") are constrained to an 88px box centered inside it — matching
the reference image, with no crowding. The three rings themselves are also a bit larger and more
clearly separated from each other. Ring colors are unchanged from 3.1.D (Production dashboard's
chart-1/2/3).

### 2. Registers: Production rows were never showing their Machine (or Operation)
Root cause found: the Production register's rows read `r.machine` and `r.operation` (singular),
but the query embeds them under `machines` and `operations` (the actual table names) — those two
fields were reading `undefined` on every single row, always falling back to "—". This was a
pre-existing bug, not something introduced by Real Time or session consolidation; it's very
likely been showing "—" in the Machine and Operation columns of every Production register entry
for a while. Fixed by normalizing the embedded fields the same way the Scrap and Downtime
registers already did. Confirmed: after Finish Session, the Production register now shows
"PRS-01 — Press 400T" instead of "—", and the Operation column is populated too.

### 3. Top-left logo resized to match the wordmark
The mark now matches the height of the "GUVEL / Operational System" text next to it (34px) instead
of towering over it at 64px. The top bar is correspondingly shorter (56px). Proportions of the
mark itself (aspect ratio) are unchanged — it's simply smaller.

### Files
`js/app.js`, `css/style.css`, `index.html` (cache keys `style.css?v=3.1.E`, `app.js?v=GUVEL-UI26`).
No SQL changes.

### Validation
`node --check js/app.js` passes.
- Ring: the center content box (88px) fits inside the core circle (96px) with room to spare, in
  both themes.
- Registers: Finish Session on a 3-hour Real Time session (then consolidated per 3.1.C) shows
  "PRS-01 — Press 400T" in the Production register's Machine column.
- Logo: measured at 34px, exactly matching the wordmark block's height.
- Regression: 12 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow.
