-- supabase/sql/2026-10-09_question_progress_phase1.sql
--
-- Question progress system, phase 1 (EXPAND ONLY: the current code keeps working).
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Undo:   2026-10-09_question_progress_phase1_ROLLBACK.sql
--
-- Every question has one of three states for each student:
--   solved   - the student answered it at least once (right or wrong)
--   skipped  - the student saw it in a FINISHED exam and did not answer it
--   unsolved - no row (never seen, or seen only in an exam that was not finished)
-- A solved question never goes back to skipped.
--
-- What this file does:
--   1. New table user_question_progress (one row per student per question):
--      state, FIRST answer (accuracy), LAST answer (wrong-questions page),
--      in_wrong_list (replaces wrong_answers). Filled from the existing answer
--      log (attempt_answers) and from wrong_answers.
--   2. exam_attempts gets: question_ids (attempt over part of an exam, e.g.
--      "unanswered questions only"), current_index, viewed_ids, flagged_ids
--      (progress kept on the attempt instead of study_progress).
--   3. Updated functions (same names): record_answer, finish_exam_attempt,
--      start_exam_attempt (new optional p_question_ids), get_my_study_stats
--      (old fields kept, new fields added).
--   4. New functions: save_attempt_progress, get_my_exam_progress,
--      get_my_wrong_overview, remove_from_wrong_list.
--   5. Trigger: when an admin changes a question's correct answer, the answer
--      log, attempt totals and student progress are recomputed.
--
-- wrong_answers and study_progress are NOT changed. Until the cleanup phase,
-- the functions keep wrong_answers in sync so the current pages stay correct.

begin;

-- =============================================================================
-- 0. Safety checks (nothing has been changed if one of these fails)
-- =============================================================================
do $$
declare
  v_orphans integer;
begin
  -- Not applied yet
  if to_regclass('public.user_question_progress') is not null then
    raise exception 'Already applied: table user_question_progress exists. Nothing was changed.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_attempts'
      and column_name in ('question_ids', 'current_index', 'viewed_ids', 'flagged_ids')
  ) then
    raise exception 'Already applied: exam_attempts has the new columns. Nothing was changed.';
  end if;
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('save_attempt_progress', 'get_my_exam_progress', 'get_my_wrong_overview',
                      'remove_from_wrong_list', 'recalc_after_correct_answer_change')
  ) then
    raise exception 'A function with one of the new names already exists. Nothing was changed.';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trigger_recalc_after_correct_answer_change') then
    raise exception 'Trigger trigger_recalc_after_correct_answer_change already exists. Nothing was changed.';
  end if;

  -- The functions this file replaces exist with the expected signatures
  if to_regprocedure('public.record_answer(uuid,text,integer,uuid)') is null
     or to_regprocedure('public.finish_exam_attempt(uuid,jsonb,integer)') is null
     or to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean)') is null
     or to_regprocedure('public.get_my_study_stats()') is null then
    raise exception 'An expected attempt function is missing or has another signature. Nothing was changed.';
  end if;

  -- Columns this file relies on
  if (select count(*) from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (
          ('attempt_answers', 'was_viewed'), ('attempt_answers', 'chosen_answer'),
          ('attempt_answers', 'answered_at'), ('exam_attempts', 'status'),
          ('exam_attempts', 'custom_exam_id'), ('wrong_answers', 'question_id'),
          ('questions', 'correct_answer'), ('exams', 'subject_id'))) <> 8 then
    raise exception 'An expected column is missing. Nothing was changed.';
  end if;

  -- Every wrong_answers row must have a real answer in the log
  select count(*) into v_orphans
  from wrong_answers w
  where not exists (
    select 1
    from attempt_answers aa
    join exam_attempts ea on ea.id = aa.attempt_id
    where ea.user_id = w.user_id
      and aa.question_id = w.question_id
      and aa.chosen_answer is not null
  );
  if v_orphans > 0 then
    raise exception '% wrong_answers row(s) have no answer in attempt_answers. Nothing was changed. Send this message to the chat.', v_orphans;
  end if;
end $$;

-- =============================================================================
-- 1. Table user_question_progress
-- =============================================================================
create table public.user_question_progress (
  user_id           uuid        not null references public.users(id)     on delete cascade,
  question_id       uuid        not null references public.questions(id) on delete cascade,
  status            text        not null check (status in ('solved', 'skipped')),
  -- First answer: written once, never changed (accuracy)
  first_answer      text,
  first_is_correct  boolean,
  first_answered_at timestamptz,
  -- Last answer: changes with every new answer (wrong-questions page)
  last_answer       text,
  last_is_correct   boolean,
  last_answered_at  timestamptz,
  answer_count      integer     not null default 0 check (answer_count >= 0),
  -- Shown on the wrong-questions page (set by a wrong answer,
  -- cleared by a right answer or by the student)
  in_wrong_list     boolean     not null default false,
  skipped_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, question_id),
  constraint user_question_progress_state_check check (
    (status = 'solved'
      and first_answer is not null and first_is_correct is not null and first_answered_at is not null
      and last_answer  is not null and last_is_correct  is not null and last_answered_at  is not null
      and answer_count >= 1)
    or
    (status = 'skipped'
      and first_answer is null and last_answer is null and answer_count = 0)
  ),
  constraint user_question_progress_wrong_list_check check (not in_wrong_list or last_is_correct = false)
);

comment on table public.user_question_progress is
  'One row per student per question seen: solved / skipped (no row = unsolved), first and last answer, wrong-list flag. Written only by the attempt functions.';

create index user_question_progress_question_idx
  on public.user_question_progress (question_id);
create index user_question_progress_wrong_list_idx
  on public.user_question_progress (user_id, last_answered_at desc)
  where in_wrong_list;

alter table public.user_question_progress enable row level security;

-- Students read their own rows. There are no write policies:
-- every write goes through the database functions below.
create policy "users can read own question progress"
  on public.user_question_progress for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.user_question_progress from anon, authenticated;

-- =============================================================================
-- 2. New columns on exam_attempts
-- =============================================================================
alter table public.exam_attempts
  add column question_ids  uuid[],
  add column current_index integer not null default 0,
  add column viewed_ids    uuid[]  not null default '{}',
  add column flagged_ids   uuid[]  not null default '{}';

alter table public.exam_attempts
  add constraint exam_attempts_question_ids_check
    check (question_ids is null or (exam_id is not null and cardinality(question_ids) between 1 and 1000)),
  add constraint exam_attempts_current_index_check
    check (current_index >= 0);

comment on column public.exam_attempts.question_ids is
  'NULL = the whole exam. Otherwise the attempt covers only these questions (e.g. unanswered questions only).';

-- =============================================================================
-- 3. Fill user_question_progress from the existing history
-- =============================================================================

-- 3a. Solved: every question a student answered, in any attempt
with answered as (
  select ea.user_id, aa.question_id, aa.chosen_answer, aa.is_correct, aa.answered_at, aa.id
  from attempt_answers aa
  join exam_attempts ea on ea.id = aa.attempt_id
  where ea.user_id is not null
    and aa.chosen_answer is not null
),
firsts as (
  select distinct on (user_id, question_id) user_id, question_id, chosen_answer, is_correct, answered_at
  from answered
  order by user_id, question_id, answered_at, id
),
lasts as (
  select distinct on (user_id, question_id) user_id, question_id, chosen_answer, is_correct, answered_at
  from answered
  order by user_id, question_id, answered_at desc, id desc
),
counts as (
  select user_id, question_id, count(*)::integer as n
  from answered
  group by user_id, question_id
)
insert into public.user_question_progress (
  user_id, question_id, status,
  first_answer, first_is_correct, first_answered_at,
  last_answer, last_is_correct, last_answered_at,
  answer_count, in_wrong_list, created_at, updated_at
)
select
  f.user_id, f.question_id, 'solved',
  f.chosen_answer, f.is_correct, f.answered_at,
  l.chosen_answer, l.is_correct, l.answered_at,
  c.n,
  -- Keep the student's own removals: only rows still in wrong_answers stay in the list
  (not l.is_correct) and exists (
    select 1 from wrong_answers w
    where w.user_id = f.user_id and w.question_id = f.question_id
  ),
  f.answered_at, l.answered_at
from firsts f
join lasts  l using (user_id, question_id)
join counts c using (user_id, question_id);

-- 3b. Skipped: seen in a finished attempt, left unanswered, never answered anywhere
insert into public.user_question_progress (user_id, question_id, status, skipped_at, created_at, updated_at)
select ea.user_id, aa.question_id, 'skipped', max(ea.completed_at), min(ea.completed_at), max(ea.completed_at)
from attempt_answers aa
join exam_attempts ea on ea.id = aa.attempt_id
where ea.user_id is not null
  and ea.status = 'completed'
  and aa.chosen_answer is null
  and aa.was_viewed
group by ea.user_id, aa.question_id
on conflict (user_id, question_id) do nothing;

-- =============================================================================
-- 4. record_answer: also updates the question progress
-- =============================================================================
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

    -- Old wrong questions list (kept in sync until the cleanup phase)
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

-- =============================================================================
-- 5. finish_exam_attempt: marks skipped questions, returns the new counts
-- =============================================================================
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

    if v_attempt.exam_id is not null then
      delete from study_progress where user_id = v_user_id and exam_id = v_attempt.exam_id;
    end if;
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

-- =============================================================================
-- 6. start_exam_attempt: optional list of questions (part of an exam)
--    The old 3-argument version is replaced; calls without the new argument
--    keep working because it has a default.
-- =============================================================================
drop function public.start_exam_attempt(uuid, uuid, boolean);

create function public.start_exam_attempt(p_exam_id uuid default null::uuid, p_custom_exam_id uuid default null::uuid, p_resume boolean default false, p_question_ids uuid[] default null::uuid[])
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_total      integer;
  v_ids        uuid[];
  v_attempt_id uuid;
begin
  if (p_exam_id is null) = (p_custom_exam_id is null) then
    raise exception 'Provide exactly one of exam_id or custom_exam_id' using errcode = '22023';
  end if;

  if p_question_ids is not null then
    if p_exam_id is null then
      raise exception 'A question list is only allowed for a regular exam' using errcode = '22023';
    end if;
    if cardinality(p_question_ids) not between 1 and 1000 then
      raise exception 'Invalid question list' using errcode = '22023';
    end if;
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

    if p_question_ids is null then
      select count(*) into v_total
      from questions where exam_id = p_exam_id and deleted_at is null;
    else
      -- Every chosen question must be an active question of this exam
      select array_agg(q.id order by q.question_order, q.id) into v_ids
      from questions q
      where q.exam_id = p_exam_id
        and q.deleted_at is null
        and q.id = any(p_question_ids);

      if v_ids is null
         or cardinality(v_ids) <> (select count(distinct x) from unnest(p_question_ids) as x) then
        raise exception 'Question is not part of this exam' using errcode = '22023';
      end if;
      v_total := cardinality(v_ids);
    end if;
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
    user_id, exam_id, custom_exam_id, status, total_questions, started_at, completed_at, question_ids
  )
  values (
    v_user_id, p_exam_id, p_custom_exam_id, 'in_progress', v_total, now(), null, v_ids
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

-- =============================================================================
-- 7. save_attempt_progress (new): auto-save of an open attempt
--    Replaces update_attempt_time + study_progress in the exam screen (phase 2).
-- =============================================================================
create function public.save_attempt_progress(p_attempt_id uuid, p_time_seconds integer, p_current_index integer default 0, p_viewed_ids uuid[] default '{}'::uuid[], p_flagged_ids uuid[] default '{}'::uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(cardinality(p_viewed_ids), 0) > 1000 or coalesce(cardinality(p_flagged_ids), 0) > 1000 then
    raise exception 'Invalid progress data' using errcode = '22023';
  end if;

  -- Time only moves forward; "viewed" only grows; closed attempts are ignored
  update exam_attempts ea
  set time_spent    = greatest(ea.time_spent, least(greatest(coalesce(p_time_seconds, 0), 0), 86400)),
      current_index = least(greatest(coalesce(p_current_index, 0), 0), greatest(ea.total_questions - 1, 0)),
      viewed_ids    = (select coalesce(array_agg(distinct v), '{}'::uuid[])
                       from unnest(ea.viewed_ids || coalesce(p_viewed_ids, '{}'::uuid[])) as v),
      flagged_ids   = (select coalesce(array_agg(distinct f), '{}'::uuid[])
                       from unnest(coalesce(p_flagged_ids, '{}'::uuid[])) as f)
  where ea.id = p_attempt_id
    and ea.user_id = auth.uid()
    and ea.status = 'in_progress';
end;
$function$;

-- =============================================================================
-- 8. get_my_study_stats: from the new table (old fields kept, new ones added)
--    Deleted questions and unpublished exams are no longer counted.
-- =============================================================================
create or replace function public.get_my_study_stats()
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
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
    'completed_exams',       (select count(distinct coalesce(exam_id, custom_exam_id))
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

-- =============================================================================
-- 9. get_my_exam_progress (new): one exam, for the prep page and the
--    "unanswered questions only" mode. Null for guests.
-- =============================================================================
create function public.get_my_exam_progress(p_exam_id uuid)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  with exam_questions as (
    select q.id, q.question_order
    from questions q
    join exams e on e.id = q.exam_id and e.deleted_at is null
    where q.exam_id = p_exam_id
      and q.deleted_at is null
  ),
  mine as (
    select eq.id, eq.question_order, p.status, p.first_is_correct
    from exam_questions eq
    left join user_question_progress p
      on p.question_id = eq.id and p.user_id = auth.uid()
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'total',         (select count(*) from mine),
    'solved',        (select count(*) from mine where status = 'solved'),
    'skipped',       (select count(*) from mine where status = 'skipped'),
    'unsolved',      (select count(*) from mine where status is null),
    'first_correct', (select count(*) from mine where status = 'solved' and first_is_correct),
    -- Never answered (skipped + unsolved), in exam order
    'unanswered_ids', coalesce((
                        select jsonb_agg(id order by question_order, id)
                        from mine
                        where status is distinct from 'solved'
                      ), '[]'::jsonb)
  ) end;
$function$;

-- =============================================================================
-- 10. get_my_wrong_overview (new): counts for the dashboard and the
--     wrong-questions page, computed in the database (no 1000-row limit)
-- =============================================================================
create function public.get_my_wrong_overview()
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  with wrong as (
    select p.question_id, q.chapter_id, q.lecture_id, e.subject_id
    from user_question_progress p
    join questions q on q.id = p.question_id and q.deleted_at is null
    join exams e     on e.id = q.exam_id and e.deleted_at is null and e.status = 'published'
    where p.user_id = auth.uid()
      and p.in_wrong_list
  ),
  by_subject as (
    select w.subject_id, s.name, count(*) as n
    from wrong w
    join subjects s on s.id = w.subject_id
    group by w.subject_id, s.name
  ),
  by_chapter as (
    select w.chapter_id, c.name, w.subject_id, s.name as subject_name, count(*) as n
    from wrong w
    join chapters c on c.id = w.chapter_id
    join subjects s on s.id = w.subject_id
    group by w.chapter_id, c.name, w.subject_id, s.name
  ),
  by_lecture as (
    select w.chapter_id, w.lecture_id, l.name, count(*) as n
    from wrong w
    join lectures l on l.id = w.lecture_id
    group by w.chapter_id, w.lecture_id, l.name
  )
  select jsonb_build_object(
    'total', (select count(*) from wrong),
    'by_subject', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_id', subject_id, 'subject', name, 'count', n
      ) order by n desc, name)
      from by_subject
    ), '[]'::jsonb),
    'by_chapter', coalesce((
      select jsonb_agg(jsonb_build_object(
        'chapter_id', bc.chapter_id,
        'chapter',    bc.name,
        'subject_id', bc.subject_id,
        'subject',    bc.subject_name,
        'count',      bc.n,
        'lectures',   coalesce((
          select jsonb_agg(jsonb_build_object(
            'lecture_id', bl.lecture_id, 'lecture', bl.name, 'count', bl.n
          ) order by bl.n desc, bl.name)
          from by_lecture bl
          where bl.chapter_id = bc.chapter_id
        ), '[]'::jsonb)
      ) order by bc.n desc, bc.name)
      from by_chapter bc
    ), '[]'::jsonb)
  );
$function$;

-- =============================================================================
-- 11. remove_from_wrong_list (new): the student clears a question from the
--     wrong-questions page. It comes back after the next wrong answer.
-- =============================================================================
create function public.remove_from_wrong_list(p_question_id uuid)
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

  -- Old wrong questions list (kept in sync until the cleanup phase)
  delete from wrong_answers where user_id = v_user_id and question_id = p_question_id;

  return v_changed > 0;
end;
$function$;

-- =============================================================================
-- 12. Trigger: an admin changes a question's correct answer
--     -> the answer log, attempt totals and student progress follow
--     (community statistics in question_statistics are not recomputed)
-- =============================================================================
create function public.recalc_after_correct_answer_change()
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

  -- d. Old wrong questions list (kept in sync until the cleanup phase)
  delete from wrong_answers w
  using user_question_progress p
  where w.question_id = new.id
    and p.question_id = new.id
    and p.user_id = w.user_id
    and not p.in_wrong_list;

  insert into wrong_answers (user_id, question_id, exam_id)
  select p.user_id, p.question_id, new.exam_id
  from user_question_progress p
  where p.question_id = new.id
    and p.in_wrong_list
  on conflict (user_id, question_id) do nothing;

  return null;
end;
$function$;

create trigger trigger_recalc_after_correct_answer_change
after update of correct_answer on public.questions
for each row
when (old.correct_answer is distinct from new.correct_answer)
execute function public.recalc_after_correct_answer_change();

-- =============================================================================
-- 13. Self-checks (any failure undoes EVERYTHING above)
-- =============================================================================
do $$
declare
  v_expected integer;
  v_actual   integer;
begin
  -- Solved rows = distinct (student, question) pairs answered in the log
  select count(*) into v_expected from (
    select distinct ea.user_id, aa.question_id
    from attempt_answers aa join exam_attempts ea on ea.id = aa.attempt_id
    where ea.user_id is not null and aa.chosen_answer is not null
  ) x;
  select count(*) into v_actual from user_question_progress where status = 'solved';
  if v_actual <> v_expected then
    raise exception 'Self-check failed: solved % <> expected %', v_actual, v_expected;
  end if;

  -- First answers that were right = same rule as the old statistics
  select count(*) into v_expected from (
    select distinct on (ea.user_id, aa.question_id) aa.is_correct
    from attempt_answers aa join exam_attempts ea on ea.id = aa.attempt_id
    where ea.user_id is not null and aa.chosen_answer is not null
    order by ea.user_id, aa.question_id, aa.answered_at, aa.id
  ) x where x.is_correct;
  select count(*) into v_actual from user_question_progress where status = 'solved' and first_is_correct;
  if v_actual <> v_expected then
    raise exception 'Self-check failed: first-correct % <> expected %', v_actual, v_expected;
  end if;

  -- Skipped rows = same rule as the old statistics (without the deleted-question filter)
  select count(*) into v_expected from (
    select distinct ea.user_id, aa.question_id
    from attempt_answers aa join exam_attempts ea on ea.id = aa.attempt_id
    where ea.user_id is not null and ea.status = 'completed'
      and aa.chosen_answer is null and aa.was_viewed
      and not exists (
        select 1 from attempt_answers a2 join exam_attempts e2 on e2.id = a2.attempt_id
        where e2.user_id = ea.user_id and a2.question_id = aa.question_id and a2.chosen_answer is not null
      )
  ) x;
  select count(*) into v_actual from user_question_progress where status = 'skipped';
  if v_actual <> v_expected then
    raise exception 'Self-check failed: skipped % <> expected %', v_actual, v_expected;
  end if;

  -- Wrong list = wrong_answers rows whose last answer is still wrong
  select count(*) into v_expected
  from wrong_answers w
  join user_question_progress p on p.user_id = w.user_id and p.question_id = w.question_id
  where not p.last_is_correct;
  select count(*) into v_actual from user_question_progress where in_wrong_list;
  if v_actual <> v_expected then
    raise exception 'Self-check failed: wrong list % <> expected %', v_actual, v_expected;
  end if;

  -- Objects in place
  if to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean,uuid[])') is null
     or to_regprocedure('public.start_exam_attempt(uuid,uuid,boolean)') is not null
     or to_regprocedure('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])') is null
     or to_regprocedure('public.get_my_exam_progress(uuid)') is null
     or to_regprocedure('public.get_my_wrong_overview()') is null
     or to_regprocedure('public.remove_from_wrong_list(uuid)') is null
     or to_regprocedure('public.recalc_after_correct_answer_change()') is null then
    raise exception 'Self-check failed: a function is missing or the old start_exam_attempt still exists';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trigger_recalc_after_correct_answer_change') then
    raise exception 'Self-check failed: trigger missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.user_question_progress'::regclass) then
    raise exception 'Self-check failed: RLS is not enabled on user_question_progress';
  end if;
end $$;

commit;

-- =============================================================================
-- 14. Summary (read-only). Send this table to the chat.
-- =============================================================================
select 1 as n, 'progress rows: solved' as item, count(*)::text as value
from public.user_question_progress where status = 'solved'
union all
select 2, 'progress rows: skipped', count(*)::text
from public.user_question_progress where status = 'skipped'
union all
select 3, 'progress rows: in wrong list', count(*)::text
from public.user_question_progress where in_wrong_list
union all
select 4, 'wrong_answers rows (old list, unchanged)', count(*)::text
from public.wrong_answers
union all
select 5, 'old wrong rows dropped (last answer is right)', count(*)::text
from public.wrong_answers w
join public.user_question_progress p on p.user_id = w.user_id and p.question_id = w.question_id
where p.last_is_correct
union all
select 6, 'students with progress', count(distinct user_id)::text
from public.user_question_progress
union all
select 7, 'log answers graded against an older key', count(*)::text
from public.attempt_answers aa
join public.questions q on q.id = aa.question_id
where aa.chosen_answer is not null
  and aa.is_correct is distinct from (upper(trim(aa.chosen_answer)) = upper(trim(q.correct_answer)))
union all
select 8, 'new exam_attempts columns', count(*)::text
from information_schema.columns
where table_schema = 'public' and table_name = 'exam_attempts'
  and column_name in ('question_ids', 'current_index', 'viewed_ids', 'flagged_ids')
union all
select 9, 'new/updated functions present', count(*)::text
from pg_proc
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
    'recalc_after_correct_answer_change()')
order by n;
