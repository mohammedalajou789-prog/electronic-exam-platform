-- supabase/sql/2026-10-09_question_progress_phase4_cleanup.sql
--
-- Question progress system, phase 4: CLEANUP (approved by the user on 9 Oct 2026).
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Undo:   2026-10-09_question_progress_phase4_cleanup_ROLLBACK.sql
--
-- The app no longer reads or writes the old tables (checked in the code on
-- 9 Oct 2026), so this file removes them:
--   1. Backups of wrong_answers and study_progress in the private schema
--      migration_backup (not exposed by the API).
--   2. record_answer, finish_exam_attempt, remove_from_wrong_list and the
--      admin-correction trigger function stop writing to the old tables.
--   3. Removes the old function update_attempt_time (replaced by save_attempt_progress).
--   4. Removes the tables wrong_answers and study_progress.
--   5. Removes 3 redundant indexes (the unique index (attempt_id, question_id)
--      and the index (user_id, completed_at) already cover them).

begin;

-- 0. Safety checks (nothing has been changed if one of these fails)
do $$
begin
  if to_regclass('public.user_question_progress') is null
     or to_regprocedure('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])') is null
     or position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) = 0 then
    raise exception 'Phases 1 and 1b must be applied first. Nothing was changed.';
  end if;
  if to_regclass('public.wrong_answers') is null or to_regclass('public.study_progress') is null then
    raise exception 'Already applied: the old tables are gone. Nothing was changed.';
  end if;
  if to_regclass('migration_backup.wrong_answers_20261009') is not null
     or to_regclass('migration_backup.study_progress_20261009') is not null then
    raise exception 'Backup tables already exist in migration_backup. Nothing was changed.';
  end if;
  -- The old wrong list must match the new one (nothing is lost by dropping it)
  if exists (
    (select user_id, question_id from public.wrong_answers
     except select user_id, question_id from public.user_question_progress where in_wrong_list)
    union all
    (select user_id, question_id from public.user_question_progress where in_wrong_list
     except select user_id, question_id from public.wrong_answers)
  ) then
    raise exception 'wrong_answers differs from the new wrong list. Nothing was changed. Send this message to the chat.';
  end if;
end $$;

-- 1. Backups (private schema, not exposed by the API)
create schema if not exists migration_backup;
create table migration_backup.wrong_answers_20261009 as select * from public.wrong_answers;
create table migration_backup.study_progress_20261009 as select * from public.study_progress;

-- 2. Functions without the old tables
create or replace function public.record_answer(p_question_id uuid, p_chosen_answer text, p_time_seconds integer default 0, p_attempt_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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

    -- The question must belong to this attempt (its exam, or its chosen questions)
    if v_attempt.exam_id is not null then
      if v_question_exam <> v_attempt.exam_id
         or (v_attempt.question_ids is not null and not (p_question_id = any(v_attempt.question_ids))) then
        raise exception 'Question is not part of this exam' using errcode = '22023';
      end if;
    elsif not exists (
      select 1 from custom_exams
      where id = v_attempt.custom_exam_id and p_question_id = any(question_ids)
    ) then
      raise exception 'Question is not part of this exam' using errcode = '22023';
    end if;

    insert into attempt_answers (attempt_id, question_id, chosen_answer, is_correct, time_seconds, answered_at, was_viewed)
    values (p_attempt_id, p_question_id, v_chosen, v_is_correct, v_time, now(), true)
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

    -- Question progress: solved now; the FIRST answer is kept forever,
    -- the LAST answer decides the wrong-questions list
    insert into user_question_progress (
      user_id, question_id, status,
      first_answer, first_is_correct, first_answered_at,
      last_answer, last_is_correct, last_answered_at,
      answer_count, in_wrong_list
    )
    values (
      v_user_id, p_question_id, 'solved',
      v_chosen, v_is_correct, now(),
      v_chosen, v_is_correct, now(),
      1, not v_is_correct
    )
    on conflict (user_id, question_id) do update set
      status            = 'solved',
      first_answer      = coalesce(user_question_progress.first_answer,      excluded.first_answer),
      first_is_correct  = coalesce(user_question_progress.first_is_correct,  excluded.first_is_correct),
      first_answered_at = coalesce(user_question_progress.first_answered_at, excluded.first_answered_at),
      last_answer       = excluded.last_answer,
      last_is_correct   = excluded.last_is_correct,
      last_answered_at  = excluded.last_answered_at,
      answer_count      = user_question_progress.answer_count + 1,
      in_wrong_list     = excluded.in_wrong_list,
      updated_at        = now();
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

create or replace function public.finish_exam_attempt(p_attempt_id uuid, p_answers jsonb default '[]'::jsonb, p_total_time_seconds integer default 0)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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

    -- b. Official question list (the chosen questions, the exam, or the custom exam)
    if v_attempt.exam_id is not null then
      select array_agg(id) into v_question_ids
      from questions
      where exam_id = v_attempt.exam_id
        and deleted_at is null
        and (v_attempt.question_ids is null or id = any(v_attempt.question_ids));
    else
      select array_agg(q.id) into v_question_ids
      from custom_exams ce
      join questions q on q.id = any(ce.question_ids) and q.deleted_at is null
      where ce.id = v_attempt.custom_exam_id;
    end if;

    -- c. Every unanswered question is recorded, remembering if it was viewed
    --    (viewed = in this request, or saved earlier by the auto-save)
    insert into attempt_answers (attempt_id, question_id, chosen_answer, is_correct, time_seconds, was_viewed)
    select p_attempt_id, ids.question_id, null, false, 0,
           coalesce(v.was_viewed, false) or ids.question_id = any(v_attempt.viewed_ids)
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

    update attempt_answers
    set was_viewed = true
    where attempt_id = p_attempt_id
      and not was_viewed
      and (chosen_answer is not null or question_id = any(v_attempt.viewed_ids));

    -- e. Seen but not answered -> skipped (a solved question never goes back)
    insert into user_question_progress (user_id, question_id, status, skipped_at)
    select v_user_id, aa.question_id, 'skipped', now()
    from attempt_answers aa
    where aa.attempt_id = p_attempt_id
      and aa.chosen_answer is null
      and aa.was_viewed
    on conflict (user_id, question_id) do update
      set skipped_at = now(),
          updated_at = now()
      where user_question_progress.status = 'skipped';

    -- f. Final counts and close the attempt.
    --    skipped = seen and not answered (questions never seen are not counted)
    select
      count(*),
      count(*) filter (where is_correct),
      count(*) filter (where chosen_answer is not null and not is_correct),
      count(*) filter (where chosen_answer is null and was_viewed)
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
  end if;

  return (
    select jsonb_build_object(
      'attempt_id', ea.id,
      'total',      ea.total_questions,
      'correct',    ea.correct_count,
      'incorrect',  ea.incorrect_count,
      'skipped',    ea.skipped_count,
      'not_seen',   greatest(ea.total_questions - ea.correct_count - ea.incorrect_count - ea.skipped_count, 0),
      'percentage', ea.score,
      'time_spent', ea.time_spent,
      -- Questions of this exam the student has never answered (skipped + unsolved);
      -- null for custom exams
      'exam_unanswered', case when ea.exam_id is null then null else (
        select count(*)
        from questions q
        where q.exam_id = ea.exam_id
          and q.deleted_at is null
          and not exists (
            select 1 from user_question_progress p
            where p.user_id = v_user_id and p.question_id = q.id and p.status = 'solved'
          )
      ) end
    )
    from exam_attempts ea
    where ea.id = p_attempt_id
  );
end;
$function$;

create or replace function public.remove_from_wrong_list(p_question_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_changed integer;
begin
  if v_user_id is null then
    return false;
  end if;

  update user_question_progress
  set in_wrong_list = false,
      updated_at    = now()
  where user_id = v_user_id
    and question_id = p_question_id
    and in_wrong_list;
  get diagnostics v_changed = row_count;

  return v_changed > 0;
end;
$function$;

create or replace function public.recalc_after_correct_answer_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_key text := upper(trim(new.correct_answer));
begin
  -- a. The answer log
  update attempt_answers
  set is_correct = (upper(trim(chosen_answer)) = v_key)
  where question_id = new.id
    and chosen_answer is not null
    and is_correct is distinct from (upper(trim(chosen_answer)) = v_key);

  -- b. Totals of every attempt that contains the question
  update exam_attempts ea
  set correct_count   = c.correct,
      incorrect_count = c.incorrect,
      score           = case
                          when ea.status = 'completed' and ea.total_questions > 0
                            then round(c.correct * 100.0 / ea.total_questions)
                          else ea.score
                        end
  from (
    select aa.attempt_id,
           count(*) filter (where aa.is_correct)                                  as correct,
           count(*) filter (where aa.chosen_answer is not null and not aa.is_correct) as incorrect
    from attempt_answers aa
    where aa.attempt_id in (select attempt_id from attempt_answers where question_id = new.id)
    group by aa.attempt_id
  ) c
  where ea.id = c.attempt_id;

  -- c. Student progress. A question that becomes wrong joins the wrong list;
  --    one that becomes right leaves it; otherwise the student's choice stays.
  --    (Inside SET, p.last_is_correct is still the OLD value.)
  update user_question_progress p
  set first_is_correct = (upper(trim(p.first_answer)) = v_key),
      last_is_correct  = (upper(trim(p.last_answer))  = v_key),
      in_wrong_list    = case
                           when upper(trim(p.last_answer)) = v_key then false
                           when p.last_is_correct then true
                           else p.in_wrong_list
                         end,
      updated_at       = now()
  where p.question_id = new.id
    and p.status = 'solved';

  return null;
end;
$function$;

-- 3. Old function
drop function public.update_attempt_time(uuid, integer);

-- 4. Old tables (their policies and indexes go with them)
drop table public.wrong_answers;
drop table public.study_progress;

-- 5. Redundant indexes
drop index public.attempt_answers_attempt_idx;
drop index public.idx_attempt_answers_attempt;
drop index public.idx_exam_attempts_user;

-- 6. Self-checks (any failure undoes everything above)
do $$
begin
  if to_regclass('public.wrong_answers') is not null or to_regclass('public.study_progress') is not null then
    raise exception 'Self-check failed: an old table still exists';
  end if;
  if (select count(*) from migration_backup.wrong_answers_20261009) is null then
    raise exception 'Self-check failed: backup missing';
  end if;
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and (position('wrong_answers' in pg_get_functiondef(oid)) > 0
           or position('study_progress' in pg_get_functiondef(oid)) > 0)
      and prokind = 'f'
  ) then
    raise exception 'Self-check failed: a function still mentions an old table';
  end if;
  if to_regprocedure('public.update_attempt_time(uuid,integer)') is not null then
    raise exception 'Self-check failed: update_attempt_time still exists';
  end if;
end $$;

commit;

-- 7. Summary (read-only). Send this table to the chat.
select 1 as n, 'backup rows: wrong_answers' as item, count(*)::text as value from migration_backup.wrong_answers_20261009
union all
select 2, 'backup rows: study_progress', count(*)::text from migration_backup.study_progress_20261009
union all
select 3, 'old tables still present', (
  (to_regclass('public.wrong_answers') is not null)::int + (to_regclass('public.study_progress') is not null)::int)::text
union all
select 4, 'redundant indexes still present', (select count(*)::text from pg_indexes
  where schemaname = 'public'
    and indexname in ('attempt_answers_attempt_idx', 'idx_attempt_answers_attempt', 'idx_exam_attempts_user'))
union all
select 5, 'progress rows in wrong list (unchanged)', count(*)::text from public.user_question_progress where in_wrong_list
order by n;
