-- supabase/sql/2026-10-09_question_progress_phase1_ROLLBACK.sql
--
-- Undoes 2026-10-09_question_progress_phase1.sql and restores the exact
-- previous functions. Use it only BEFORE the new app code (phase 2) is installed.
-- Run in: Supabase -> SQL Editor -> New query -> Run
--
-- Nothing important is lost:
--   - every answer stays in attempt_answers (the answer log),
--   - wrong_answers was kept in sync by the phase 1 functions.
-- What is removed: the table user_question_progress, the new exam_attempts
-- columns, the new functions and the trigger. Open attempts that cover only
-- part of an exam are closed ("abandoned") first; their answers still count.
-- Corrections already made by the trigger (an admin changed a correct answer)
-- are kept: they are true corrections of the log.

begin;

-- 0. Safety checks
do $$
begin
  if to_regclass('public.user_question_progress') is null
     or to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean,uuid[])') is null then
    raise exception 'Phase 1 is not applied (or was already undone). Nothing was changed.';
  end if;
end $$;

-- 1. Close open attempts over part of an exam (the old functions cannot handle them)
create temporary table rollback_closed_attempts on commit drop as
with closed as (
  update public.exam_attempts
  set status = 'abandoned'
  where status = 'in_progress' and question_ids is not null
  returning id
)
select count(*) as n from closed;

-- 2. Trigger and new functions
drop trigger trigger_recalc_after_correct_answer_change on public.questions;
drop function public.recalc_after_correct_answer_change();
drop function public.save_attempt_progress(uuid, integer, integer, uuid[], uuid[]);
drop function public.get_my_exam_progress(uuid);
drop function public.get_my_wrong_overview();
drop function public.remove_from_wrong_list(uuid);

-- 3. Previous versions of the changed functions (exact copies)
drop function public.start_exam_attempt(uuid, uuid, boolean, uuid[]);

CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_exam_id uuid DEFAULT NULL::uuid, p_custom_exam_id uuid DEFAULT NULL::uuid, p_resume boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id    uuid := auth.uid();
  v_total      integer;
  v_attempt_id uuid;
begin
  if (p_exam_id is null) = (p_custom_exam_id is null) then
    raise exception 'Provide exactly one of exam_id or custom_exam_id' using errcode = '22023';
  end if;

  -- Guests have no personal history
  if v_user_id is null then
    return null;
  end if;

  if not exists (select 1 from users where id = v_user_id) then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if p_exam_id is not null then
    if not exists (select 1 from exams where id = p_exam_id and deleted_at is null) then
      raise exception 'Exam not found' using errcode = 'P0002';
    end if;
    select count(*) into v_total
    from questions where exam_id = p_exam_id and deleted_at is null;
  else
    if not exists (select 1 from custom_exams where id = p_custom_exam_id) then
      raise exception 'Custom exam not found' using errcode = 'P0002';
    end if;
    select count(*) into v_total
    from custom_exams ce
    join questions q on q.id = any(ce.question_ids) and q.deleted_at is null
    where ce.id = p_custom_exam_id;
  end if;

  -- Resume: reuse the open attempt if there is one
  if p_resume then
    select id into v_attempt_id
    from exam_attempts
    where user_id = v_user_id
      and status = 'in_progress'
      and exam_id        is not distinct from p_exam_id
      and custom_exam_id is not distinct from p_custom_exam_id;

    if v_attempt_id is not null then
      return v_attempt_id;
    end if;
  end if;

  -- Fresh start: close any open attempt (its answers still count)
  update exam_attempts
  set status = 'abandoned'
  where user_id = v_user_id
    and status = 'in_progress'
    and exam_id        is not distinct from p_exam_id
    and custom_exam_id is not distinct from p_custom_exam_id;

  insert into exam_attempts (
    user_id, exam_id, custom_exam_id, status, total_questions, started_at, completed_at
  )
  values (
    v_user_id, p_exam_id, p_custom_exam_id, 'in_progress', v_total, now(), null
  )
  returning id into v_attempt_id;

  return v_attempt_id;

exception
  -- Two tabs started the same exam at the same moment: return the open attempt
  when unique_violation then
    select id into v_attempt_id
    from exam_attempts
    where user_id = v_user_id
      and status = 'in_progress'
      and exam_id        is not distinct from p_exam_id
      and custom_exam_id is not distinct from p_custom_exam_id;
    return v_attempt_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_answer(p_question_id uuid, p_chosen_answer text, p_time_seconds integer DEFAULT 0, p_attempt_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id        uuid    := auth.uid();
  v_chosen         text    := nullif(trim(p_chosen_answer), '');
  v_time           integer := least(greatest(coalesce(p_time_seconds, 0), 0), 3600);
  v_correct_answer text;
  v_question_exam  uuid;
  v_is_correct     boolean;
  v_attempt        exam_attempts%rowtype;
  v_inserted_id    uuid;
begin
  if v_chosen is null then
    raise exception 'Answer is required' using errcode = '22023';
  end if;

  select correct_answer, exam_id into v_correct_answer, v_question_exam
  from questions
  where id = p_question_id and deleted_at is null;

  if not found then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  v_is_correct := upper(v_chosen) = upper(trim(v_correct_answer));

  if p_attempt_id is null then
    -- Only guests may answer outside an attempt
    if v_user_id is not null then
      raise exception 'Signed-in students must answer inside an attempt' using errcode = '22023';
    end if;
  else
    select * into v_attempt from exam_attempts where id = p_attempt_id for update;

    if not found or v_attempt.user_id is distinct from v_user_id then
      raise exception 'Attempt not found' using errcode = 'P0002';
    end if;

    if v_attempt.status <> 'in_progress' then
      raise exception 'Attempt is closed' using errcode = '22023';
    end if;

    -- The question must belong to this attempt's exam
    if v_attempt.exam_id is not null then
      if v_question_exam <> v_attempt.exam_id then
        raise exception 'Question is not part of this exam' using errcode = '22023';
      end if;
    elsif not exists (
      select 1 from custom_exams
      where id = v_attempt.custom_exam_id and p_question_id = any(question_ids)
    ) then
      raise exception 'Question is not part of this exam' using errcode = '22023';
    end if;

    insert into attempt_answers (attempt_id, question_id, chosen_answer, is_correct, time_seconds, answered_at)
    values (p_attempt_id, p_question_id, v_chosen, v_is_correct, v_time, now())
    on conflict (attempt_id, question_id) do nothing
    returning id into v_inserted_id;

    -- Already saved (a retry): report the stored result and change nothing
    if v_inserted_id is null then
      select is_correct into v_is_correct
      from attempt_answers
      where attempt_id = p_attempt_id and question_id = p_question_id;
      return jsonb_build_object('is_correct', v_is_correct, 'recorded', false);
    end if;

    update exam_attempts
    set correct_count   = correct_count   + case when v_is_correct then 1 else 0 end,
        incorrect_count = incorrect_count + case when v_is_correct then 0 else 1 end
    where id = p_attempt_id;

    -- Wrong questions list
    if v_is_correct then
      delete from wrong_answers where user_id = v_user_id and question_id = p_question_id;
    else
      insert into wrong_answers (user_id, question_id, exam_id)
      values (v_user_id, p_question_id, v_question_exam)
      on conflict (user_id, question_id) do nothing;
    end if;
  end if;

  -- Community statistics (guests and students)
  insert into question_statistics (question_id, attempts, correct_answers, average_time, last_updated)
  values (p_question_id, 1, case when v_is_correct then 1 else 0 end, v_time, now())
  on conflict (question_id) do update set
    attempts        = coalesce(question_statistics.attempts, 0) + 1,
    correct_answers = coalesce(question_statistics.correct_answers, 0) + excluded.correct_answers,
    average_time    = (coalesce(question_statistics.average_time, 0) * coalesce(question_statistics.attempts, 0)
                       + excluded.average_time) / (coalesce(question_statistics.attempts, 0) + 1),
    last_updated    = now();

  return jsonb_build_object('is_correct', v_is_correct, 'recorded', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_exam_attempt(p_attempt_id uuid, p_answers jsonb DEFAULT '[]'::jsonb, p_total_time_seconds integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id      uuid := auth.uid();
  v_attempt      exam_attempts%rowtype;
  v_item         record;
  v_question_ids uuid[];
  v_total        integer;
  v_correct      integer;
  v_incorrect    integer;
  v_skipped      integer;
begin
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 1000 then
    raise exception 'Invalid answers payload' using errcode = '22023';
  end if;

  select * into v_attempt from exam_attempts where id = p_attempt_id for update;

  if not found or v_attempt.user_id is distinct from v_user_id then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status = 'abandoned' then
    raise exception 'Attempt is closed' using errcode = '22023';
  end if;

  -- Already finished (a retry): just return the stored summary below
  if v_attempt.status = 'in_progress' then

    -- a. Safety net: save any answer that did not reach the server earlier
    for v_item in
      select * from jsonb_to_recordset(p_answers) as x(
        question_id uuid, chosen_answer text, time_seconds integer
      )
    loop
      if nullif(trim(v_item.chosen_answer), '') is not null then
        begin
          perform record_answer(v_item.question_id, v_item.chosen_answer, v_item.time_seconds, p_attempt_id);
        exception when others then
          null; -- invalid items are ignored
        end;
      end if;
    end loop;

    -- b. Official question list
    if v_attempt.exam_id is not null then
      select array_agg(id) into v_question_ids
      from questions where exam_id = v_attempt.exam_id and deleted_at is null;
    else
      select array_agg(q.id) into v_question_ids
      from custom_exams ce
      join questions q on q.id = any(ce.question_ids) and q.deleted_at is null
      where ce.id = v_attempt.custom_exam_id;
    end if;

    -- c. Every unanswered question is recorded, remembering if it was viewed
    insert into attempt_answers (attempt_id, question_id, chosen_answer, is_correct, time_seconds, was_viewed)
    select p_attempt_id, ids.question_id, null, false, 0, coalesce(v.was_viewed, false)
    from unnest(coalesce(v_question_ids, '{}'::uuid[])) as ids(question_id)
    left join (
      select distinct on (x.question_id) x.question_id, x.was_viewed
      from jsonb_to_recordset(p_answers) as x(question_id uuid, was_viewed boolean)
      order by x.question_id
    ) v on v.question_id = ids.question_id
    on conflict (attempt_id, question_id) do nothing;

    -- d. Flags, bookmarks and "viewed" at the moment of finishing
    update attempt_answers aa
    set is_flagged    = coalesce(x.is_flagged, false),
        is_bookmarked = coalesce(x.is_bookmarked, false),
        was_viewed    = aa.was_viewed or coalesce(x.was_viewed, false) or aa.chosen_answer is not null
    from jsonb_to_recordset(p_answers) as x(
      question_id uuid, is_flagged boolean, is_bookmarked boolean, was_viewed boolean
    )
    where aa.attempt_id = p_attempt_id and aa.question_id = x.question_id;

    -- e. Final counts and close the attempt
    select
      count(*),
      count(*) filter (where is_correct),
      count(*) filter (where chosen_answer is not null and not is_correct),
      count(*) filter (where chosen_answer is null)
    into v_total, v_correct, v_incorrect, v_skipped
    from attempt_answers
    where attempt_id = p_attempt_id;

    update exam_attempts
    set status          = 'completed',
        completed_at    = now(),
        total_questions = v_total,
        correct_count   = v_correct,
        incorrect_count = v_incorrect,
        skipped_count   = v_skipped,
        score           = case when v_total > 0 then round(v_correct * 100.0 / v_total) else 0 end,
        time_spent      = greatest(time_spent, least(greatest(coalesce(p_total_time_seconds, 0), 0), 86400))
    where id = p_attempt_id;

    if v_attempt.exam_id is not null then
      delete from study_progress where user_id = v_user_id and exam_id = v_attempt.exam_id;
    end if;
  end if;

  return (
    select jsonb_build_object(
      'attempt_id', id,
      'total',      total_questions,
      'correct',    correct_count,
      'incorrect',  incorrect_count,
      'skipped',    skipped_count,
      'percentage', score,
      'time_spent', time_spent
    )
    from exam_attempts
    where id = p_attempt_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_study_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with my_answers as (
    -- Every answer this student gave, in any attempt (finished or not)
    select aa.question_id, aa.is_correct, aa.answered_at
    from attempt_answers aa
    join exam_attempts ea on ea.id = aa.attempt_id
    where ea.user_id = auth.uid()
      and aa.chosen_answer is not null
  ),
  first_answers as (
    -- Only the FIRST answer to each question counts (retakes cannot inflate accuracy)
    select distinct on (question_id) question_id, is_correct
    from my_answers
    order by question_id, answered_at
  ),
  skipped as (
    -- Shown in a FINISHED attempt, left unanswered, and never answered anywhere
    select distinct aa.question_id
    from attempt_answers aa
    join exam_attempts ea on ea.id = aa.attempt_id
    join questions q      on q.id = aa.question_id and q.deleted_at is null
    where ea.user_id = auth.uid()
      and ea.status = 'completed'
      and aa.chosen_answer is null
      and aa.was_viewed
      and not exists (select 1 from my_answers ma where ma.question_id = aa.question_id)
  ),
  by_subject as (
    select
      s.name as subject_name,
      count(*) as answered,
      count(*) filter (where fa.is_correct) as correct
    from first_answers fa
    join questions q on q.id = fa.question_id
    join exams e     on e.id = q.exam_id
    join subjects s  on s.id = e.subject_id
    group by s.name
  )
  select jsonb_build_object(
    'questions_solved',      (select count(*) from first_answers),
    'first_attempt_correct', (select count(*) from first_answers where is_correct),
    'skipped',               (select count(*) from skipped),
    'study_seconds',         (select coalesce(sum(time_spent), 0)
                              from exam_attempts where user_id = auth.uid()),
    'completed_exams',       (select count(distinct coalesce(exam_id, custom_exam_id))
                              from exam_attempts
                              where user_id = auth.uid() and status = 'completed'),
    'by_subject',            coalesce((
                               select jsonb_agg(jsonb_build_object(
                                 'subject', subject_name,
                                 'answered', answered,
                                 'correct', correct
                               ) order by subject_name)
                               from by_subject
                             ), '[]'::jsonb)
  );
$function$;

-- 4. exam_attempts columns
alter table public.exam_attempts
  drop constraint exam_attempts_question_ids_check,
  drop constraint exam_attempts_current_index_check,
  drop column question_ids,
  drop column current_index,
  drop column viewed_ids,
  drop column flagged_ids;

-- 5. The progress table
drop table public.user_question_progress;

-- 6. Self-checks (any failure undoes everything above)
do $$
begin
  if to_regclass('public.user_question_progress') is not null then
    raise exception 'Rollback self-check failed: table still exists';
  end if;
  if to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean)') is null
     or to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean,uuid[])') is not null
     or to_regprocedure('public.record_answer(uuid,text,integer,uuid)') is null
     or to_regprocedure('public.finish_exam_attempt(uuid,jsonb,integer)') is null
     or to_regprocedure('public.get_my_study_stats()') is null then
    raise exception 'Rollback self-check failed: functions not restored';
  end if;
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('save_attempt_progress', 'get_my_exam_progress', 'get_my_wrong_overview',
                      'remove_from_wrong_list', 'recalc_after_correct_answer_change')
  ) then
    raise exception 'Rollback self-check failed: a new function still exists';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_attempts'
      and column_name in ('question_ids', 'current_index', 'viewed_ids', 'flagged_ids')
  ) then
    raise exception 'Rollback self-check failed: new columns still exist';
  end if;
end $$;

-- Summary (read inside the transaction, before the temporary table is dropped)
select 1 as n, 'attempts closed (part of an exam)' as item, (select n from rollback_closed_attempts)::text as value
union all
select 2, 'user_question_progress exists', (to_regclass('public.user_question_progress') is not null)::text
union all
select 3, 'start_exam_attempt signature', (select string_agg(oid::regprocedure::text, ', ') from pg_proc
                                          where pronamespace = 'public'::regnamespace and proname = 'start_exam_attempt')
union all
select 4, 'wrong_answers rows', (select count(*) from public.wrong_answers)::text
order by n;

commit;
