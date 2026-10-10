-- supabase/sql/2026-10-10_cleanup_unused_functions_ROLLBACK.sql
--
-- Recreates the two functions removed by 2026-10-10_cleanup_unused_functions.sql,
-- exactly as they were (definitions and permissions come from the backup).
-- Paste in Supabase -> SQL Editor -> New query -> Run.

begin;

do $$
begin
  if to_regclass('migration_backup.dropped_functions_20261010') is null then
    raise exception 'The backup table is missing. Nothing was changed.';
  end if;
end $$;

do $$
declare
  r record;
  g record;
begin
  for r in select * from migration_backup.dropped_functions_20261010 loop
    execute r.definition;
    -- Same permissions as before
    execute format('revoke all on function %s from public', r.signature);
    for g in
      select case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end as role_name
      from aclexplode(r.acl) a
      where a.privilege_type = 'EXECUTE'
        and a.grantee <> (select proowner from pg_proc where oid = r.signature::regprocedure)
    loop
      execute format('grant execute on function %s to %s', r.signature, g.role_name);
    end loop;
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)') is null
     or to_regprocedure('public.abandon_exam_attempt(uuid, uuid)') is null then
    raise exception 'Self-check failed: a function was not recreated';
  end if;
end $$;

drop table migration_backup.dropped_functions_20261010;

commit;

select 'functions recreated' as item,
       (select count(*) from pg_proc where oid in (
          to_regprocedure('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)'),
          to_regprocedure('public.abandon_exam_attempt(uuid, uuid)')))::text as value;
