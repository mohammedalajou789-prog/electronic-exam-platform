-- supabase/sql/2026-10-10_bookmarks_overview_and_completed.sql
--
-- Phase B of the cleanup (10 Oct 2026). Paste in Supabase -> SQL Editor ->
-- New query -> Run. Undo with ..._bookmarks_overview_and_completed_ROLLBACK.sql.
--
-- 1. New read-only function get_my_bookmark_overview(): the student's bookmark
--    counts (total, chapters, per subject) counted in the database, so the
--    dashboard and the bookmarks page no longer load every bookmark (1000-row limit).
-- 2. get_my_study_stats(): "Completed exams" keeps counting a custom exam the
--    student finished and later deleted (decided by the user). Nothing else changes.

begin;

-- 0. Safety checks
do $$
begin
  if to_regprocedure('public.get_my_study_stats()') is null then
    raise exception 'get_my_study_stats is missing. Nothing was changed.';
  end if;
  if to_regprocedure('public.get_my_bookmark_overview()') is not null
     or to_regclass('migration_backup.functions_before_20261010b') is not null then
    raise exception 'This file has already been applied. Nothing was changed.';
  end if;
end $$;

-- 1. Backup of the function that is replaced
create schema if not exists migration_backup;
create table migration_backup.functions_before_20261010b as
select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.oid = 'public.get_my_study_stats()'::regprocedure;

-- 2. Bookmark counts for the dashboard and the bookmarks page
create function public.get_my_bookmark_overview()
 returns jsonb
 language sql
 stable
 security invoker
 set search_path to 'public'
as $function$
  with mine as (
    -- This student's bookmarks on active questions
    select b.question_id, q.chapter_id, s.name as subject
    from bookmarks b
    join questions q on q.id = b.question_id and q.deleted_at is null
    join exams e     on e.id = q.exam_id and e.deleted_at is null
    join subjects s  on s.id = e.subject_id
    where b.user_id = auth.uid()
  )
  select jsonb_build_object(
    'total',      (select count(*) from mine),
    'chapters',   (select count(distinct chapter_id) from mine),
    'by_subject', coalesce((
                    select jsonb_agg(jsonb_build_object('subject', subject, 'count', n) order by n desc, subject)
                    from (select subject, count(*) as n from mine group by subject) x
                  ), '[]'::jsonb)
  );
$function$;

grant execute on function public.get_my_bookmark_overview() to authenticated;

-- 3. Completed exams: a deleted custom exam keeps counting
create or replace function public.get_my_study_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with mine as (
    -- This student's progress on active questions of published exams
    select p.status, p.first_is_correct, p.in_wrong_list, e.subject_id
    from user_question_progress p
    join questions q on q.id = p.question_id and q.deleted_at is null
    join exams e     on e.id = q.exam_id and e.deleted_at is null and e.status = 'published'
    where p.user_id = auth.uid()
  ),
  subject_totals as (
    -- All active questions of the subjects this student has worked in
    select e.subject_id, count(q.id) as total
    from exams e
    join questions q on q.exam_id = e.id and q.deleted_at is null
    where e.deleted_at is null
      and e.status = 'published'
      and e.subject_id in (select subject_id from mine)
    group by e.subject_id
  ),
  by_subject as (
    select
      s.id   as subject_id,
      s.name as subject_name,
      st.total,
      count(*) filter (where m.status = 'solved')                        as solved,
      count(*) filter (where m.status = 'solved' and m.first_is_correct) as correct,
      count(*) filter (where m.status = 'skipped')                       as skipped
    from mine m
    join subjects s        on s.id = m.subject_id
    join subject_totals st on st.subject_id = m.subject_id
    group by s.id, s.name, st.total
  )
  select jsonb_build_object(
    'questions_solved',      (select count(*) from mine where status = 'solved'),
    'first_attempt_correct', (select count(*) from mine where status = 'solved' and first_is_correct),
    'skipped',               (select count(*) from mine where status = 'skipped'),
    'wrong_list',            (select count(*) from mine where in_wrong_list),
    'study_seconds',         (select coalesce(sum(time_spent), 0)
                              from exam_attempts where user_id = auth.uid()),
    -- A custom exam the student deleted keeps counting (its attempts lose the link,
    -- so each such finished attempt is counted by its own id)
    'completed_exams',       (select count(distinct coalesce(exam_id, custom_exam_id, id))
                              from exam_attempts
                              where user_id = auth.uid() and status = 'completed'),
    'by_subject',            coalesce((
                               select jsonb_agg(jsonb_build_object(
                                 'subject_id', subject_id,
                                 'subject',    subject_name,
                                 'total',      total,
                                 'answered',   solved,
                                 'solved',     solved,
                                 'correct',    correct,
                                 'skipped',    skipped,
                                 'unsolved',   greatest(total - solved - skipped, 0)
                               ) order by subject_name)
                               from by_subject
                             ), '[]'::jsonb)
  );
$function$;

-- 4. Self-checks
do $$
begin
  if (select count(*) from migration_backup.functions_before_20261010b) <> 1 then
    raise exception 'Self-check failed: backup';
  end if;
  if to_regprocedure('public.get_my_bookmark_overview()') is null then
    raise exception 'Self-check failed: get_my_bookmark_overview';
  end if;
  if pg_get_functiondef('public.get_my_study_stats()'::regprocedure) not ilike '%coalesce(exam_id, custom_exam_id, id)%' then
    raise exception 'Self-check failed: get_my_study_stats';
  end if;
end $$;

commit;

-- 5. Summary (send this table back)
select 1 as n, 'get_my_bookmark_overview exists' as item, (to_regprocedure('public.get_my_bookmark_overview()') is not null)::text as value
union all
select 2, 'completed exams keep deleted custom exams',
       (pg_get_functiondef('public.get_my_study_stats()'::regprocedure) ilike '%coalesce(exam_id, custom_exam_id, id)%')::text
union all
select 3, 'backup of the old get_my_study_stats', (select count(*) from migration_backup.functions_before_20261010b)::text
order by 1;
