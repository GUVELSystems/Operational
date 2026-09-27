-- GUVEL Operational — Phase 3.1.C
-- Allow a scrap_catalog entry to apply to every Part Number ("General"), current and future,
-- instead of one specific Part Number + Operation. A General defect has part_number_id and
-- operation_id both null; every other row keeps them required, so nothing about existing
-- part-specific defects changes.

alter table public.scrap_catalog
  alter column part_number_id drop not null,
  alter column operation_id drop not null;

-- The old unique(company_id,part_number_id,operation_id,code) still exists and still protects
-- part-specific codes (Postgres treats NULLs as distinct, so it does not cover General rows).
-- Add a matching guard for General rows so the same code cannot be added twice as General.
create unique index if not exists ux_scrap_catalog_general_code
  on public.scrap_catalog(company_id, code)
  where part_number_id is null and operation_id is null;

comment on column public.scrap_catalog.part_number_id is 'Part Number this defect applies to. Null means General: applies to every Part Number, including ones added later.';
comment on column public.scrap_catalog.operation_id is 'Operation this defect applies to. Null when part_number_id is also null (General).';
