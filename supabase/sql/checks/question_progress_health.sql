-- supabase/sql/checks/question_progress_health.sql
--
-- Read-only health check of the question progress system (after phase 4 cleanup)
-- and of the custom exams (rows 24-30, added 10 Oct 2026).
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Every row: what is checked, the real value, the expected value, OK or FAIL.
-- Rows 9-16 compare user_question_progress with the answer log (attempt_answers),
-- which is the source of truth. Run it after any change to these tables or functions.
with
log_answers as (
  select ea.user_id, aa.question_id, aa.chosen_answer, aa.is_correct, aa.answered_at, aa.id
  from attempt_answers aa
  join exam_attempts ea on ea.id = aa.attempt_id
  where ea.user_id is not null and aa.chosen_answer is not null
),
log_first as (
  select distinct on (user_id, question_id) user_id, question_id, chosen_answer, is_correct
  from log_answers order by user_id, question_id, answered_at, id
),
log_last as (
  select distinct on (user_id, question_id) user_id, question_id, chosen_answer, is_correct
  from log_answers order by user_id, question_id, answered_at desc, id desc
),
log_counts as (
  select user_id, question_id, count(*) as n from log_answers group by 1, 2
),
checks(n, item, value, expected) as (
  -- -- Structure --
  select 1, 'table user_question_progress exists',
         (to_regclass('public.user_question_progress') is not null)::text, 'true'
  union all
  select 2, 'RLS enabled on user_question_progress',
         (select relrowsecurity::text from pg_class where oid = 'public.user_question_progress'::regclass), 'true'
  union all
  select 3, 'policies on user_question_progress (read own only)',
         (select count(*)::text from pg_policies where tablename = 'user_question_progress'), '1'
  union all
  select 4, 'new exam_attempts columns',
         (select count(*)::text from information_schema.columns
          where table_schema = 'public' and table_name = 'exam_attempts'
            and column_name in ('question_ids', 'current_index', 'viewed_ids', 'flagged_ids')), '4'
  union all
  select 5, 'functions with the expected signatures',
         (select count(*)::text from pg_proc
          where pronamespace = 'public'::regnamespace
            and oid::regprocedure::text in (
              'record_answer(uuid,text,integer,uuid)',
              'finish_exam_attempt(uuid,jsonb,integer)',
              'start_exam_attempt(uuid,uuid,boolean,uuid[])',
              'save_attempt_progress(uuid,integer,integer,uuid[],uuid[])',
              'get_my_study_stats()',
              'get_my_exam_progress(uuid)',
              'get_my_wrong_overview()',
              'remove_from_wrong_list(uuid)',
              'recalc_after_correct_answer_change()')), '9'
  union all
  select 6, 'old start_exam_attempt (3 arguments) removed',
         (to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean)') is null)::text, 'true'
  union all
  select 7, 'trigger for admin answer corrections',
         (select count(*)::text from pg_trigger where tgname = 'trigger_recalc_after_correct_answer_change'), '1'
  union all
  select 8, 'phase 1b applied (auto-save marks skipped)',
         (position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) > 0)::text, 'true'
  -- -- Solved questions vs the answer log --
  union all
  select 9, 'answered in the log but not "solved"',
         (select count(*)::text from log_counts c
          where not exists (select 1 from user_question_progress p
                            where p.user_id = c.user_id and p.question_id = c.question_id and p.status = 'solved')), '0'
  union all
  select 10, '"solved" without any answer in the log',
         (select count(*)::text from user_question_progress p
          where p.status = 'solved'
            and not exists (select 1 from log_counts c where c.user_id = p.user_id and c.question_id = p.question_id)), '0'
  union all
  select 11, 'first answer differs from the oldest answer in the log',
         (select count(*)::text from user_question_progress p
          join log_first f on f.user_id = p.user_id and f.question_id = p.question_id
          where p.first_answer is distinct from f.chosen_answer
             or p.first_is_correct is distinct from f.is_correct), '0'
  union all
  select 12, 'last answer differs from the newest answer in the log',
         (select count(*)::text from user_question_progress p
          join log_last l on l.user_id = p.user_id and l.question_id = p.question_id
          where p.last_answer is distinct from l.chosen_answer
             or p.last_is_correct is distinct from l.is_correct), '0'
  union all
  select 13, 'answer count differs from the log',
         (select count(*)::text from user_question_progress p
          join log_counts c on c.user_id = p.user_id and c.question_id = p.question_id
          where p.answer_count <> c.n), '0'
  -- -- Skipped questions --
  union all
  select 14, 'skipped but answered somewhere',
         (select count(*)::text from user_question_progress p
          where p.status = 'skipped'
            and exists (select 1 from log_counts c where c.user_id = p.user_id and c.question_id = p.question_id)), '0'
  union all
  select 15, 'skipped with no attempt where it was seen',
         (select count(*)::text from user_question_progress p
          where p.status = 'skipped'
            and not exists (
              select 1 from attempt_answers aa join exam_attempts ea on ea.id = aa.attempt_id
              where ea.user_id = p.user_id and aa.question_id = p.question_id
                and ea.status = 'completed' and aa.chosen_answer is null and aa.was_viewed)
            and not exists (
              select 1 from exam_attempts ea
              where ea.user_id = p.user_id and p.question_id = any(ea.viewed_ids))), '0'
  union all
  select 16, 'seen in an open attempt, unanswered, not yet skipped (0 after phase 1b)',
         (select count(*)::text from (
            select distinct ea.user_id, q.id
            from exam_attempts ea
            join questions q on q.id = any(ea.viewed_ids) and q.deleted_at is null
              and (q.exam_id = ea.exam_id or ea.custom_exam_id is not null)
            where ea.status = 'in_progress'
              and not exists (select 1 from log_counts c where c.user_id = ea.user_id and c.question_id = q.id)
              and not exists (select 1 from user_question_progress p where p.user_id = ea.user_id and p.question_id = q.id)
          ) x), '0'
  -- -- Wrong-questions list --
  union all
  select 17, 'in the wrong list but the last answer is right',
         (select count(*)::text from user_question_progress where in_wrong_list and last_is_correct), '0'
  union all
  select 18, 'old tables wrong_answers / study_progress removed',
         (to_regclass('public.wrong_answers') is null and to_regclass('public.study_progress') is null)::text, 'true'
  union all
  select 19, 'log answers graded against an older correct answer',
         (select count(*)::text from attempt_answers aa join questions q on q.id = aa.question_id
          where aa.chosen_answer is not null
            and aa.is_correct is distinct from (upper(trim(aa.chosen_answer)) = upper(trim(q.correct_answer)))), '0'
  union all
  select 20, 'attempt right/wrong totals that differ from the log',
         (select count(*)::text from exam_attempts ea
          where ea.correct_count <> (select count(*) from attempt_answers where attempt_id = ea.id and is_correct)
             or ea.incorrect_count <> (select count(*) from attempt_answers
                                       where attempt_id = ea.id and chosen_answer is not null and not is_correct)), '0'
  union all
  select 21, 'more than one open attempt for the same exam',
         (select count(*)::text from (
            select user_id, exam_id from exam_attempts
            where status = 'in_progress' and exam_id is not null
            group by 1, 2 having count(*) > 1) x), '0'
  -- -- Custom exams (10 Oct 2026) --
  union all
  select 24, 'custom exams: owner, name and link name do not go together',
         (select count(*)::text from custom_exams
          where not ((user_id is null and name is null and slug is null)
                  or (user_id is not null and name is not null and slug is not null))), '0'
  union all
  select 25, 'custom exams: students can write the table directly',
         (has_table_privilege('anon', 'public.custom_exams', 'insert, update, delete')
          or has_table_privilege('authenticated', 'public.custom_exams', 'insert, update, delete'))::text, 'false'
  union all
  select 26, 'custom exams: one student has two exams with the same link name',
         (select count(*)::text from (
            select user_id, slug from custom_exams where user_id is not null
            group by 1, 2 having count(*) > 1) x), '0'
  union all
  select 27, 'open attempts without an exam',
         (select count(*)::text from exam_attempts
          where status = 'in_progress' and exam_id is null and custom_exam_id is null), '0'
  union all
  select 28, 'more than one open attempt for the same custom exam',
         (select count(*)::text from (
            select user_id, custom_exam_id from exam_attempts
            where status = 'in_progress' and custom_exam_id is not null
            group by 1, 2 having count(*) > 1) x), '0'
  union all
  select 29, 'old functions pick_custom_exam_questions / abandon_exam_attempt removed',
         (to_regprocedure('public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean)') is null
          and to_regprocedure('public.abandon_exam_attempt(uuid, uuid)') is null)::text, 'true'
  union all
  select 30, 'info: custom exams of students / of guests',
         (select count(*) filter (where user_id is not null) || ' / ' || count(*) filter (where user_id is null)
          from custom_exams), '-'
  -- -- Information only --
  union all
  select 22, 'info: progress rows solved / skipped / in wrong list',
         (select count(*) filter (where status = 'solved') || ' / ' || count(*) filter (where status = 'skipped')
                 || ' / ' || count(*) filter (where in_wrong_list) from user_question_progress), '-'
  union all
  select 23, 'info: open attempts / students with progress',
         (select count(*) from exam_attempts where status = 'in_progress') || ' / '
         || (select count(distinct user_id) from user_question_progress), '-'
)
select n, item, value, expected,
       case when expected = '-' then 'info'
            when value = expected then 'OK'
            else 'FAIL' end as status
from checks
order by n;
