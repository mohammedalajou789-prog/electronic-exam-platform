-- supabase/sql/2026-10-10_cleanup_unused_functions.sql
--
-- Cleanup after the custom exam rebuild (10 Oct 2026). Paste in Supabase ->
-- SQL Editor -> New query -> Run. Undo with ..._cleanup_unused_functions_ROLLBACK.sql.
--
-- Removes two functions that nothing uses any more:
--   pick_custom_exam_questions - replaced by create_custom_exam
--   abandon_exam_attempt       - End Session now ends an exam exactly like Finish
-- Their definitions and permissions are saved first in migration_backup, so the
-- ROLLBACK file can recreate them exactly.

begin;

-- 0. Safety checks
do $$
begin
  if to_regprocedure('public.create_custom_exam(uuid, text, integer, boolean, uuid[], uuid[], uuid[], uuid[], boolean, boolean)') is null then
    raise exception 'The custom exam rebuild (phase 1) is missing. Nothing was changed.';
  end if;
  if to_regclass('migration_backup.dropped_functions_20261010') is not null then
    raise exception 'This file has already been applied (backup table exists). Nothing was changed.';
  end if;
  if to_regprocedure('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)') is null
     or to_regprocedure('public.abandon_exam_attempt(uuid, uuid)') is null then
    raise exception 'One of the two functions is already gone. Nothing was changed.';
  end if;
  -- No other function may call them
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not in ('pick_custom_exam_questions', 'abandon_exam_attempt')
      and (pg_get_functiondef(p.oid) ilike '%pick_custom_exam_questions%'
           or pg_get_functiondef(p.oid) ilike '%abandon_exam_attempt%')) then
    raise exception 'Another database function still uses one of them. Nothing was changed.';
  end if;
end $$;

-- 1. Backup of the definitions and permissions
create schema if not exists migration_backup;

create table migration_backup.dropped_functions_20261010 as
select p.oid::regprocedure::text as signature,
       pg_get_functiondef(p.oid)  as definition,
       p.proacl                   as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid in ('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)'::regprocedure,
                'public.abandon_exam_attempt(uuid, uuid)'::regprocedure);

-- 2. Remove them
drop function public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean);
drop function public.abandon_exam_attempt(uuid, uuid);

-- 3. Self-checks
do $$
begin
  if (select count(*) from migration_backup.dropped_functions_20261010) <> 2 then
    raise exception 'Self-check failed: backup';
  end if;
  if to_regprocedure('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)') is not null
     or to_regprocedure('public.abandon_exam_attempt(uuid, uuid)') is not null then
    raise exception 'Self-check failed: a function is still there';
  end if;
end $$;

commit;

-- 4. Summary (send this table back)
select 1 as n, 'functions saved in the backup' as item, (select count(*) from migration_backup.dropped_functions_20261010)::text as value
union all
select 2, 'pick_custom_exam_questions still exists', (to_regprocedure('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)') is not null)::text
union all
select 3, 'abandon_exam_attempt still exists', (to_regprocedure('public.abandon_exam_attempt(uuid, uuid)') is not null)::text
order by 1;
