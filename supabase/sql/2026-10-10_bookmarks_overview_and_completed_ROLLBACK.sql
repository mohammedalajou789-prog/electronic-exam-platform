-- supabase/sql/2026-10-10_bookmarks_overview_and_completed_ROLLBACK.sql
--
-- Undoes 2026-10-10_bookmarks_overview_and_completed.sql: removes
-- get_my_bookmark_overview() and puts back the previous get_my_study_stats().
-- Paste in Supabase -> SQL Editor -> New query -> Run.

begin;

do $$
begin
  if to_regclass('migration_backup.functions_before_20261010b') is null then
    raise exception 'The backup table is missing. Nothing was changed.';
  end if;
end $$;

drop function if exists public.get_my_bookmark_overview();

do $$
declare
  r record;
begin
  for r in select * from migration_backup.functions_before_20261010b loop
    execute r.definition;
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.get_my_bookmark_overview()') is not null
     or pg_get_functiondef('public.get_my_study_stats()'::regprocedure) ilike '%coalesce(exam_id, custom_exam_id, id)%' then
    raise exception 'Self-check failed: the old state was not restored';
  end if;
end $$;

drop table migration_backup.functions_before_20261010b;

commit;

select 'restored' as item, 'get_my_study_stats (old) / get_my_bookmark_overview removed' as value;
