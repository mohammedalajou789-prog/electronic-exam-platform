-- supabase/sql/2026-10-09_question_progress_phase4_cleanup_ROLLBACK.sql
--
-- Undoes 2026-10-09_question_progress_phase4_cleanup.sql:
--   recreates wrong_answers and study_progress exactly as they were (columns,
--   keys, indexes, row level security and policies), restores their rows from
--   migration_backup, brings wrong_answers up to date with the current wrong list,
--   restores update_attempt_time, the 3 indexes and the previous function versions
--   (the ones that keep the old tables in sync).
-- Run in: Supabase -> SQL Editor -> New query -> Run

begin;

-- 0. Safety checks
do $$
begin
  if to_regclass('public.wrong_answers') is not null or to_regclass('public.study_progress') is not null then
    raise exception 'The cleanup is not applied (or was already undone). Nothing was changed.';
  end if;
  if to_regclass('migration_backup.wrong_answers_20261009') is null
     or to_regclass('migration_backup.study_progress_20261009') is null then
    raise exception 'Backup tables are missing in migration_backup. Nothing was changed.';
  end if;
end $$;

-- 1. Tables, exactly as before
create table public.study_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  exam_id uuid,
  current_question integer default 0,
  elapsed_seconds integer,
  answers_json jsonb default '{}'::jsonb,
  flags_json jsonb default '[]'::jsonb,
  completed boolean default false,
  started_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
alter table public.study_progress add constraint study_progress_pkey primary key (id);
alter table public.study_progress add constraint study_progress_user_id_exam_id_key unique (user_id, exam_id);
alter table public.study_progress add constraint study_progress_exam_id_fkey foreign key (exam_id) references public.exams(id) on delete cascade;
alter table public.study_progress add constraint study_progress_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
create index idx_progress_user on public.study_progress using btree (user_id);
alter table public.study_progress enable row level security;
create policy "users can manage own progress" on public.study_progress for all to public using ((auth.uid() = user_id));

create table public.wrong_answers (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  question_id uuid,
  exam_id uuid,
  created_at timestamp with time zone default now()
);
alter table public.wrong_answers add constraint wrong_answers_pkey primary key (id);
alter table public.wrong_answers add constraint wrong_answers_user_id_question_id_key unique (user_id, question_id);
alter table public.wrong_answers add constraint wrong_answers_exam_id_fkey foreign key (exam_id) references public.exams(id) on delete cascade;
alter table public.wrong_answers add constraint wrong_answers_question_id_fkey foreign key (question_id) references public.questions(id) on delete cascade;
alter table public.wrong_answers add constraint wrong_answers_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
create index idx_wrong_answers_user on public.wrong_answers using btree (user_id);
alter table public.wrong_answers enable row level security;
create policy "users own wrong answers" on public.wrong_answers for all to public using ((auth.uid() = user_id));

-- 2. Rows from the backups (rows whose exam, question or student no longer exists are skipped)
insert into public.study_progress
select b.* from migration_backup.study_progress_20261009 b
where exists (select 1 from public.users u where u.id = b.user_id)
  and exists (select 1 from public.exams e where e.id = b.exam_id);

insert into public.wrong_answers
select b.* from migration_backup.wrong_answers_20261009 b
where exists (select 1 from public.users u where u.id = b.user_id)
  and exists (select 1 from public.questions q where q.id = b.question_id)
  and exists (select 1 from public.exams e where e.id = b.exam_id);

-- 3. Bring wrong_answers up to date with the current wrong list
delete from public.wrong_answers w
where not exists (
  select 1 from public.user_question_progress p
  where p.user_id = w.user_id and p.question_id = w.question_id and p.in_wrong_list
);
insert into public.wrong_answers (user_id, question_id, exam_id)
select p.user_id, p.question_id, q.exam_id
from public.user_question_progress p
join public.questions q on q.id = p.question_id
where p.in_wrong_list
on conflict (user_id, question_id) do nothing;

-- 4. Indexes
create index attempt_answers_attempt_idx on public.attempt_answers using btree (attempt_id);
create index idx_attempt_answers_attempt on public.attempt_answers using btree (attempt_id);
create index idx_exam_attempts_user on public.exam_attempts using btree (user_id);

-- 5. Previous function versions (exact copies)
CREATE OR REPLACE FUNCTION public.update_attempt_time(p_attempt_id uuid, p_time_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Time only moves forward; closed attempts are ignored
  update exam_attempts
  set time_spent = greatest(time_spent, least(greatest(coalesce(p_time_seconds, 0), 0), 86400))
  where id = p_attempt_id
    and user_id = auth.uid()
    and status = 'in_progress';
end;
$function$;

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

  -- Old wrong questions list (kept in sync until the cleanup phase)
  delete from wrong_answers where user_id = v_user_id and question_id = p_question_id;

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

-- 6. Self-check
do $$
begin
  if to_regclass('public.wrong_answers') is null or to_regclass('public.study_progress') is null
     or to_regprocedure('public.update_attempt_time(uuid,integer)') is null
     or position('wrong_answers' in pg_get_functiondef('public.record_answer(uuid,text,integer,uuid)'::regprocedure)) = 0 then
    raise exception 'Rollback self-check failed';
  end if;
end $$;

-- 7. Summary
select 1 as n, 'wrong_answers rows' as item, count(*)::text as value from public.wrong_answers
union all
select 2, 'study_progress rows', count(*)::text from public.study_progress
order by n;

commit;
