-- =============================================================================
-- Batches restructure - Phase 3d (SWITCH)
-- Date: 2026-09-29
--
-- Turns batches into ONE shared list (one row per batch name) and makes the
-- database enforce the new structure. All app code already works with both
-- the old and the new data, so nothing else has to change when this runs.
--
--   0. Safety checks: Phase 1, 2 and 3c must be in place.
--   1. Backup of batches, exams.batch_id and subject_batches as they are now.
--   2. Pick ONE row per batch slug (the row subjects are linked to).
--   3. Make sure every exam's subject + batch pair is linked in subject_batches.
--   4. exams.batch_id -> ON DELETE RESTRICT (deleting a batch never deletes exams).
--   5. Point every exam to the shared row of its batch; delete the other rows.
--   6. Constraints:
--        - batches.subject_id removed (a batch no longer belongs to a subject)
--        - batches.slug unique and never empty
--        - batches.graduation_year unique (NULL allowed, e.g. Previous Batches)
--        - exams.subject_id and exams.batch_id required
--        - exams (subject_id, batch_id) must be a linked pair in subject_batches
--   7. Self-checks. Any failure raises an error and rolls EVERYTHING back.
--
-- Undo: 2026-09-29_batches_phase3d_switch_ROLLBACK.sql
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Safety checks
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'migration_backup') then
    raise exception 'Phase 1 backup schema (migration_backup) is missing';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'batches' and column_name = 'subject_id') then
    raise exception 'batches.subject_id is already gone: this switch has already run';
  end if;
  if position('fb.slug' in (select pg_get_functiondef('public.search_questions(text[],uuid,uuid,uuid,uuid,uuid)'::regprocedure))) = 0 then
    raise exception 'Phase 3c (search_questions batch filter by slug) has not been applied';
  end if;
  if exists (select 1 from public.batches where slug is null or slug = '') then
    raise exception 'A batch has an empty slug (its name has no English letters or digits)';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Backup of the current state (private schema, not exposed by the API)
-- -----------------------------------------------------------------------------
create table migration_backup.batches_before_switch as
  select * from public.batches;

create table migration_backup.exams_batch_before_switch as
  select id, subject_id, batch_id from public.exams;

create table migration_backup.subject_batches_before_switch as
  select * from public.subject_batches;

-- Fill any exam that has no subject yet from its batch row (normally none)
update public.exams e
set subject_id = b.subject_id
from public.batches b
where b.id = e.batch_id and e.subject_id is null;

-- -----------------------------------------------------------------------------
-- 2) One shared row per slug
--    Prefer the row that subjects are linked to; otherwise the oldest row.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.subject_batches sb
    join public.batches b on b.id = sb.batch_id
    group by b.slug
    having count(distinct b.id) > 1
  ) then
    raise exception 'Subjects are linked to more than one row of the same batch name';
  end if;
end $$;

create temporary table batch_map on commit drop as
with ranked as (
  select b.id, b.slug,
         row_number() over (
           partition by b.slug
           order by (exists (select 1 from public.subject_batches sb where sb.batch_id = b.id)) desc,
                    b.created_at, b.id
         ) as rn
  from public.batches b
)
select r.id as old_id, k.id as shared_id
from ranked r
join ranked k on k.slug = r.slug and k.rn = 1;

-- -----------------------------------------------------------------------------
-- 3) Every exam's subject + batch pair must be linked
-- -----------------------------------------------------------------------------
insert into public.subject_batches (subject_id, batch_id)
select distinct e.subject_id, m.shared_id
from public.exams e
join batch_map m on m.old_id = e.batch_id
where e.subject_id is not null
on conflict (subject_id, batch_id) do nothing;

-- -----------------------------------------------------------------------------
-- 4) Deleting a batch must never delete exams
-- -----------------------------------------------------------------------------
alter table public.exams drop constraint exams_batch_id_fkey;
alter table public.exams
  add constraint exams_batch_id_fkey
  foreign key (batch_id) references public.batches(id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 5) Point exams to the shared rows, then remove the other rows
-- -----------------------------------------------------------------------------
update public.exams e
set batch_id = m.shared_id
from batch_map m
where m.old_id = e.batch_id and m.old_id <> m.shared_id;

delete from public.batches b
using batch_map m
where m.old_id = b.id and m.old_id <> m.shared_id;

-- -----------------------------------------------------------------------------
-- 6) Constraints for the new structure
-- -----------------------------------------------------------------------------
drop index public.batches_subject_slug_uniq;
alter table public.batches drop column subject_id;

create unique index batches_slug_key on public.batches (slug);
create unique index batches_graduation_year_key on public.batches (graduation_year);
alter table public.batches
  add constraint batches_slug_not_empty check (slug <> '');

alter table public.exams alter column subject_id set not null;
alter table public.exams alter column batch_id set not null;

alter table public.exams
  add constraint exams_subject_batch_fkey
  foreign key (subject_id, batch_id)
  references public.subject_batches (subject_id, batch_id)
  on delete restrict;

-- -----------------------------------------------------------------------------
-- 7) Self-checks. Any failure raises an error and rolls everything back.
-- -----------------------------------------------------------------------------
do $$
declare
  v_slugs_before  int;
  v_batches_now   int;
  v_exams_before  int;
  v_exams_now     int;
  v_wrong_batch   int;
  v_wrong_subject int;
  v_links_lost    int;
begin
  select count(distinct slug) into v_slugs_before from migration_backup.batches_before_switch;
  select count(*)             into v_batches_now  from public.batches;
  select count(*)             into v_exams_before from migration_backup.exams_batch_before_switch;
  select count(*)             into v_exams_now    from public.exams;

  -- Every exam still has a batch with the SAME name (slug) as before
  select count(*) into v_wrong_batch
  from migration_backup.exams_batch_before_switch x
  join migration_backup.batches_before_switch ob on ob.id = x.batch_id
  join public.exams e    on e.id = x.id
  join public.batches nb on nb.id = e.batch_id
  where nb.slug <> ob.slug;

  -- ... and the same subject
  select count(*) into v_wrong_subject
  from migration_backup.exams_batch_before_switch x
  join public.exams e on e.id = x.id
  where x.subject_id is not null and e.subject_id <> x.subject_id;

  -- No subject link that existed before is lost
  select count(*) into v_links_lost
  from migration_backup.subject_batches_before_switch sb
  where not exists (select 1 from public.subject_batches n
                    where n.subject_id = sb.subject_id and n.batch_id = sb.batch_id);

  if v_batches_now <> v_slugs_before then
    raise exception 'Expected % batches (one per name), found %', v_slugs_before, v_batches_now;
  end if;
  if v_exams_now <> v_exams_before then
    raise exception 'Exam count changed: % before, % now', v_exams_before, v_exams_now;
  end if;
  if v_wrong_batch > 0 then
    raise exception '% exam(s) ended up in a different batch', v_wrong_batch;
  end if;
  if v_wrong_subject > 0 then
    raise exception '% exam(s) ended up in a different subject', v_wrong_subject;
  end if;
  if v_links_lost > 0 then
    raise exception '% subject link(s) were lost', v_links_lost;
  end if;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- Summary (read-only)
-- -----------------------------------------------------------------------------
select 1 as ord, 'count' as section, 'batches before' as item, count(*)::text as detail
from migration_backup.batches_before_switch
union all
select 1, 'count', 'batches now', count(*)::text from public.batches
union all
select 1, 'count', 'exams', count(*)::text from public.exams
union all
select 1, 'count', 'subject_batches links', count(*)::text from public.subject_batches
union all
select 2, 'batch', coalesce(b.graduation_year::text, '(none)') || '  ' || b.name,
       'subjects=' || (select count(*) from public.subject_batches sb where sb.batch_id = b.id)
       || ' exams=' || (select count(*) from public.exams e where e.batch_id = b.id)
from public.batches b
order by ord, item desc;
