# GUVEL Operational — Phase 3.1.B
## Shift-bound Real Time, session OEE dashboard, Single Entry, "Production" rename

Base: Phase 3.1.A

### 1. Real Time is bound to the session's shift
Real Time (and Finish Session's hour review) now only offers hours inside the session's shift
window — e.g. a shift of 07:00–16:30 offers exactly those hours, with a 30-minute final slot
instead of rounding up to a full hour. Windows are computed from the shift's `start_time` /
`end_time`; an overnight shift (end time earlier than start time, e.g. 22:00–06:00) is handled
by rolling the end into the next day. If a shift has no start/end time configured, Real Time
falls back to the previous behavior (calendar hours since session start) and says so in the panel.

### 2. Plant Now: a full session dashboard, not a summary card
Clicking a machine now opens:
- **Session OEE**, live: a color-coded ring plus Availability / Performance / Quality, each shown
  against its target from Plant Now → Targets.
- **Color scale** (documented in the panel itself): **On track** — at or above target. **Watch** —
  within 10 percentage points of target. **Attention** — more than 10 points below. The same rule
  now also explains why a hexagon in the honeycomb is cyan, amber, or grey.
- The same hour-by-hour Real Time log as before, and the panel still refreshes every 30 seconds.

**How Session OEE is computed** (deliberately different from the Production dashboard's OEE,
which measures a whole finished period): Planned Production Time is the time elapsed in the
shift so far — from session start (or shift start, if later) up to now (or shift end) — minus
the shift's break minutes, prorated to that same elapsed fraction. Operating Time subtracts
Unplanned downtime logged through Real Time. Performance compares pieces produced against the
part's configured cycle time over that Operating Time; Quality is good pieces over total pieces;
OEE is the product of the three, exactly like the Production dashboard.

Because Planned Time keeps growing with the clock, an hour where nothing was logged counts
against Performance the same way real idle time would — the dashboard cannot tell "no captures
yet" apart from "nothing was produced". A worked example: 3 hours logged (558 pieces, 9-second
cycle) but ~7.4 hours already elapsed in the shift → Performance ≈ (9 × 558) / (7.4 × 3600) ≈ 19%.
Logging each hour as it happens (that's what Real Time is for) keeps this number meaningful;
falling behind on capture makes Performance look worse than the line really is, on purpose,
as a nudge to keep entries current.

### 3. Single Entry
In Finish Session's hour review, next to **Substitute information** there is now
**Single Entry — replace with one capture**. It asks for confirmation, then opens the familiar
single-capture form (Production Quantity, Scrap, Downtime). Saving it deletes every hour already
logged for that session (and their scrap/downtime rows) and records the one entry instead, then
closes the session. A **Back to hour-by-hour** link returns to the hour review without changing
anything, in case it was opened by mistake.

### 4. "Status" renamed to "Production"
The nav item, the page title, and its error messages now read "Production". This is a display-only
change — internal routing, element ids and CSS classes still use "Status" so nothing else needed
to move. The Personnel table's own "Status" column (Active/Inactive) is unrelated and unchanged.

Note: the Dashboard already has its own "Production" tab (Production OEE, Plan vs Actual, etc.).
That tab and this renamed top-level section are different things that now share a name — worth a
look before it ships, in case a different label (e.g. "Floor" or "Operations") would read clearer
in your nav.

### Files
`js/app.js`, `css/style.css`, `index.html` (cache keys `style.css?v=3.1.B`, `app.js?v=GUVEL-UI23`).
No SQL changes beyond 3.1.A's migration; `shifts.start_time` / `end_time` were already columns used
elsewhere in the app, and `operation_machine_cycle_times` was already used by the Production dashboard.

### Validation
`node --check js/app.js` passes. Against the Supabase mock (extended with a shift-timed session and
a session on a 7:00–16:30 shift to exercise the partial final hour):
- Real Time / Finish Session hour lists match the shift window exactly (8 hours for a 14:00–22:00
  shift; 07:00–16:30 ends with a 30-minute slot).
- Plant Now's session dashboard renders the OEE ring and three color-coded pills with the expected
  colors and values.
- Single Entry deletes existing hourly rows and leaves exactly one capture for the session.
- Nav and page title read "Production"; the Personnel Status column is untouched.
- Regression: 14 screens × 6 widths (1920–360px), both themes: no JavaScript errors, no horizontal
  overflow.
