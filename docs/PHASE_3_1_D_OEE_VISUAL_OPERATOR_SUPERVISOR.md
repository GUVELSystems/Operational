# GUVEL Operational — Phase 3.1.D
## Session OEE ring redesigned, Operator/Supervisor shown and saved

Base: Phase 3.1.C

### 1. Session OEE ring
The percentage no longer overlaps the rings. The three rings (Availability, Performance,
Quality) now use the same three colors as the Production dashboard's own OEE ring
(`--chart-1`, `--chart-2`, `--chart-3`) instead of on-track/watch/attention colors, so the two
OEE rings in the app read the same way. A small legend below the ring (dot + label + value, same
style as Production's) makes each ring identifiable. The on-track/watch/attention color scale
still lives on the three metric pills and on a small state chip under the OEE number itself
("On track" / "Watch" / "Attention") — so the color that means "which metric" and the color that
means "how are we doing" are never the same color system fighting for attention. The ring's
center circle is bigger, so the percentage, "OEE" and the state chip sit inside it without
crowding the rings.

### 2. Operator and Supervisor: shown, and actually saved
Start Production already asked for Operator and Supervisor, but that information stopped there:
every capture — Real Time hourly saves, Finish Session, and Finish Session's Single Entry —
was recording `operator_name` and `supervisor_name` as blank. Both are now:
- **Shown** in the session recap everywhere it appears: the machine profile, Real Time, Finish
  Session's review, and Plant Now's live dashboard.
- **Saved** on every capture tied to the session — each Real Time hour, the classic single Finish
  Session capture, and the one consolidated record Finish Session leaves behind (Phase 3.1.C) —
  resolved from the Operator/Supervisor chosen when the machine was started.

### Files
`js/app.js`, `css/style.css`, `index.html` (cache keys `style.css?v=3.1.D`, `app.js?v=GUVEL-UI25`).
No SQL changes — `operator_id`/`supervisor_id` on the session and `operator_name`/`supervisor_name`
on captures already existed; this phase only makes sure the second is filled in from the first.

### Validation
`node --check js/app.js` passes. Against the Supabase mock:
- The session recap shows "Operator: José Treviño" and "Supervisor: María Garza" in Plant Now's
  live dashboard, the machine profile, Real Time, and Finish Session.
- After Finish Session (with hours consolidated per 3.1.C), the single resulting record carries
  both names.
- Ring colors confirmed as `--chart-1`/`--chart-2`/`--chart-3` in both themes; no visual overlap
  between the percentage and the rings.
- Regression: 12 screens across widths (1920–360px) in both themes: no JavaScript errors, no
  horizontal overflow.
