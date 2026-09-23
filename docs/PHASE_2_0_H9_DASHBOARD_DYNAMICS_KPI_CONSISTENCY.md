# GUVEL Operational — Phase 2.0.H.9
## Dashboard Dynamics & KPI Consistency

Status: Implementation / Visual Validation Pending
Baseline: GUVEL-Operational-Phase-2.0.H.8-Configurable-Gauges

### Scope
1. Align Plan vs Actual needle to the 180° semicircular gauge, from 9 o'clock (0%) to 3 o'clock (100%).
2. Improve readability of Production Plan vs Real table without making typography oversized.
3. Add entrance/progress animation to Production OEE, Plan vs Actual and Model Mix when the dashboard module is rendered/switched.
4. Make Quality KPI cards use the same visual structure as General KPI cards.
5. Make Downtime KPI cards use the same visual structure as General KPI cards.

### Production gauge behavior
- Needle angle is mapped directly to `-90° + achievement * 180°`.
- 0% points left; 50% points up; 100% points right.
- Threshold zones remain driven by the configurable KPI rules.

### OEE behavior
- OEE ring colors remain independently configurable for Availability, Performance and Quality.
- Visual opacity/saturation is softened for a less aggressive appearance.
- Central percentage is reduced and the central decorative dot remains disabled.

### Animation
- OEE progress starts visually empty and transitions to its actual value.
- Plan vs Actual needle starts at 0% and transitions to the actual achievement position.
- Model Mix enters with a subtle scale/rotation animation.
- KPI cards enter with a staggered GUVEL-style motion.

### KPI consistency
Quality and Downtime now use the same label-pill, metric, connector, icon, spacing and hover structure as General. Existing formulas, data calculations, configuration gears and delta calculations are preserved.

### Deferred / unchanged
Invitations, tokens, links and onboarding remain intentionally excluded and are reserved for the final stage of the project.
