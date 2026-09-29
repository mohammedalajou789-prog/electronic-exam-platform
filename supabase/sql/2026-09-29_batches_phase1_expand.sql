-- =============================================================================
-- Batches restructure - Phase 1 (EXPAND)
-- Date: 2026-09-29
--
-- Additive only. Nothing is deleted or renamed, so the current code keeps
-- working exactly as before.
--
--   1. Back up batches and exams.batch_id into a private schema.
--   2. Add exams.subject_id and fill it from the current batch -> subject link.
--   3. Add batches.graduation_year and fill it.
--   4. Create subject_batches (subject <-> batch link table) and fill it,
--      pointing every subject to ONE canonical row per batch name
--      (the oldest row of that name).
--   5. Self-checks: if any number is wrong, the whole script is rolled back.
--
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Backups (private schema: not exposed through the Supabase API)
--    These statements fail if the objects already exist, which stops the script.
-- -----------------------------------------------------------------------------
create schema migration_backup;
revoke all on schema migration_backup from public;

create table migration_backup.batches_20260929 as
  select * from public.batches;

create table migration_backup.exams_batch_20260929 as
  select id, batch_id from public.exams;

-- -----------------------------------------------------------------------------
-- 2) exams.subject_id
--    Nullable for now: the admin screens do not send it yet (Phase 2).
--    It becomes NOT NULL in Phase 3.
-- -----------------------------------------------------------------------------
alter table public.exams
  add column subject_id uuid references public.subjects(id) on delete restrict;

update public.exams e
set subject_id = b.subject_id
from public.batches b
where b.id = e.batch_id;

create index idx_exams_subject_id on public.exams (subject_id);

-- -----------------------------------------------------------------------------
-- 3) batches.graduation_year
--    Matched by slug. "previous-batches" has no year on purpose (listed last).
--    "Passion" (2029) does not exist yet; it is added in Phase 3.
--    Uniqueness is added in Phase 3, after duplicate rows are merged.
-- -----------------------------------------------------------------------------
alter table public.batches
  add column graduation_year integer
  check (graduation_year between 2000 and 2100);

update public.batches b
set graduation_year = v.graduation_year
from (values
  ('shefaa',  2031),
  ('yusr',    2030),
  ('hayat',   2028),
  ('vein',    2027),
  ('athar',   2026),
  ('yaqeen',  2025),
  ('hope',    2024),
  ('wateen',  2023),
  ('harmony', 2022),
  ('soul',    2021)
) as v(slug, graduation_year)
where b.slug = v.slug;

-- -----------------------------------------------------------------------------
-- 4) subject_batches: which batches a subject is shown to
--    The primary key is a plain uuid (not the two foreign keys) so the
--    Supabase API does not treat this table as an automatic many-to-many
--    link; that keeps the current queries unambiguous.
-- -----------------------------------------------------------------------------
create table public.subject_batches (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  batch_id   uuid not null references public.batches(id)  on delete restrict,
  created_at timestamptz not null default now(),
  constraint subject_batches_subject_batch_key unique (subject_id, batch_id)
);

create index idx_subject_batches_batch_id on public.subject_batches (batch_id);

alter table public.subject_batches enable row level security;

-- Same access rules as the batches table
create policy "public can read subject_batches"
  on public.subject_batches for select
  using (true);

create policy "admins can manage subject_batches"
  on public.subject_batches for all
  using (auth.uid() in (select admins.id from public.admins));

-- One canonical row per batch name: the oldest one (ties broken by id)
with canonical as (
  select distinct on (lower(trim(name)))
         lower(trim(name)) as name_key,
         id                as canonical_id
  from public.batches
  order by lower(trim(name)), created_at, id
)
insert into public.subject_batches (subject_id, batch_id)
select distinct b.subject_id, c.canonical_id
from public.batches b
join canonical c on c.name_key = lower(trim(b.name))
where b.subject_id is not null;

-- -----------------------------------------------------------------------------
-- 5) Self-checks. Any failure raises an error and rolls everything back.
-- -----------------------------------------------------------------------------
do $$
declare
  v_batches         int;
  v_backup_batches  int;
  v_exams           int;
  v_backup_exams    int;
  v_exams_no_subj   int;
  v_links           int;
  v_expected_links  int;
  v_missing_years   int;
begin
  select count(*) into v_batches        from public.batches;
  select count(*) into v_backup_batches from migration_backup.batches_20260929;
  select count(*) into v_exams          from public.exams;
  select count(*) into v_backup_exams   from migration_backup.exams_batch_20260929;
  select count(*) into v_exams_no_subj  from public.exams where subject_id is null;
  select count(*) into v_links          from public.subject_batches;

  select count(distinct (subject_id, lower(trim(name)))) into v_expected_links
  from public.batches where subject_id is not null;

  select count(*) into v_missing_years
  from public.batches
  where graduation_year is null and slug <> 'previous-batches';

  if v_backup_batches <> v_batches then
    raise exception 'Backup of batches is incomplete (% of %)', v_backup_batches, v_batches;
  end if;
  if v_backup_exams <> v_exams then
    raise exception 'Backup of exams is incomplete (% of %)', v_backup_exams, v_exams;
  end if;
  if v_exams_no_subj > 0 then
    raise exception '% exam(s) have no subject_id', v_exams_no_subj;
  end if;
  if v_links <> v_expected_links then
    raise exception 'subject_batches has % rows, expected %', v_links, v_expected_links;
  end if;
  if v_missing_years > 0 then
    raise exception '% batch row(s) have no graduation_year', v_missing_years;
  end if;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- Summary (read-only)
-- -----------------------------------------------------------------------------
select 1 as ord, 'count' as section, 'batches rows' as item, count(*)::text as detail
from public.batches
union all
select 1, 'count', 'backup batches rows', count(*)::text
from migration_backup.batches_20260929
union all
select 1, 'count', 'exams rows', count(*)::text
from public.exams
union all
select 1, 'count', 'backup exams rows', count(*)::text
from migration_backup.exams_batch_20260929
union all
select 1, 'count', 'exams without subject_id', count(*)::text
from public.exams where subject_id is null
union all
select 1, 'count', 'subject_batches rows', count(*)::text
from public.subject_batches
union all
select 2, 'year', b.name,
       coalesce(b.graduation_year::text, '(none)') || '  rows=' || count(*)
from public.batches b
group by b.name, b.graduation_year
order by ord, item;