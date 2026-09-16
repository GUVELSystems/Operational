-- GUVEL Operational — Phase 2.0.E compatibility
-- part_number_machines is a relationship table and, in this installation,
-- does not contain company_id. Tenant filtering is applied through the
-- related part_numbers/machines tables where needed.

-- No schema change is required.
-- This file documents the compatibility decision for installations where
-- part_number_machines.company_id does not exist.
