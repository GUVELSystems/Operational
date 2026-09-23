# GUVEL Operational — Phase 2.0.H.10

## Dashboard Refinement

Base: Phase 2.0.H.9

### Scope
1. Production OEE ring animation: Availability, Performance and Quality now animate independently from zero to their real values using stroke-dashoffset.
2. Production Plan vs Actual needle animation: needle starts at the 0% position (9 o'clock) and animates to the actual achievement position on the 180° gauge.
3. Quality KPI cards reduced substantially in height, spacing, metric size and icon size while preserving the General visual structure.
4. Downtime KPI cards receive the same scale reduction.
5. Quality and Downtime threshold status uses the configured color for both metric and KPI icon LED, with a continuous pulse animation when an active threshold applies.
6. Production Plan vs Real table typography increased for readability; the % Cumplimiento value is emphasized without changing the table layout.

### Threshold behavior
Existing Greater Than / Less Than / Between storage and evaluation are preserved. The active threshold color is applied through `kpiStatusStyle()` to the KPI metric and icon. The icon receives a visual pulse when a threshold is active.

### Validation
- JavaScript syntax checked with Node.js `--check`.
- ZIP contents verified after packaging.

This phase is not considered accepted until visual validation in the deployed portal is completed.
