# GUVEL Operational — Phase 2.0.A

## Scope
- Renames the visible navigation module from **Capture** to **Status**.
- Adds a non-destructive machine status foundation.
- Shows all machines as `IDLE` or `RUNNING`.
- Allows starting and finishing one production session per machine.
- Preserves the legacy Capture module/function and legacy production tables.

## Database
Run `sql/017_phase_2_0_A_status_foundation.sql` in Supabase after validating that the existing `personnel` table and `public.current_company_id()` helper exist.

New table: `public.machine_production_sessions`.

Important relationships:
- `company_id → companies.id`
- `machine_id → machines.id`
- `shift_id → shifts.id`
- `customer_id → customers.id`
- `part_number_id → part_numbers.id`
- `operation_id → operations.id`
- `operator_id / supervisor_id → personnel.id`

The partial unique index prevents more than one active session on the same machine inside a company.

## Deployment order
1. Backup Supabase database.
2. Run SQL migration 017.
3. Deploy the static application files.
4. Test with one machine before using the module across the plant.
5. Do not delete or rename legacy `production_captures`, `scrap_events`, or `downtime_events`.

## Known Phase 2.0.A limitation
The optional Operation field is intentionally not persisted from free text in this foundation. Operation linkage will be completed in the next subphase using the existing operation selector and cycle-time architecture.

## Phase 2.0.B — Status UX & Dynamic Operations

- Compact responsive machine-status cards.
- Separate Machine Status and Start Production Session sections.
- Operation selector loads operations by Part Number.
- When machine-specific mappings exist in `operation_machine_cycle_times`, operations are filtered by Part Number + Machine.
- Operation becomes required when operations are configured for the selected Part Number.
- Session insert now persists `operation_id`.
- Existing machine names and legacy Capture behavior remain unchanged.


## Phase 2.0.B compatibility fix
- The frontend no longer sends `created_by` when starting a session, so existing databases without that optional column can start production.
- Optional migration `018_phase_2_0_B_created_by_compatibility.sql` adds the column for installations that want to retain it.
