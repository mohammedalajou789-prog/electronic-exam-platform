-- supabase/sql/2026-10-09_question_progress_phase1b_skip_on_leave.sql
--
-- Question progress system, phase 1b.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Undo:   2026-10-09_question_progress_phase1b_skip_on_leave_ROLLBACK.sql
--
-- New rule (the student's decision, 9 Oct 2026):
--   A question the student SAW and did not answer is "skipped" as soon as the
--   progress is saved (auto-save every 30 seconds, "Continue Later", closing the
--   tab, or Finish), not only when Finish is pressed.
--   A solved question still never goes back to skipped, and answering a skipped
--   question later makes it solved.
--
-- What this file does:
--   1. save_attempt_progress: after saving the progress, every question seen in
--      the attempt and not answered becomes "skipped" (only questions that really
--      belong to the attempt; the list sent by the browser is checked).
--   2. Applies the rule once to the attempts that are open right now.
-- Nothing else changes (finish_exam_attempt already marks skipped questions).

begin;

-- 0. Safety checks
do $$
begin
  if to_regclass('public.user_question_progress') is null
     or to_regprocedure('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])') is null then
    raise exception 'Phase 1 is not applied. Nothing was changed.';
  end if;
  if position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) > 0 then
    raise exception 'Already applied: save_attempt_progress already marks skipped questions. Nothing was changed.';
  end if;
end $$;

-- 1. save_attempt_progress: also marks seen, unanswered questions as skipped
create or replace function public.save_attempt_progress(p_attempt_id uuid, p_time_seconds integer, p_current_index integer default 0, p_viewed_ids uuid[] default '{}'::uuid[], p_flagged_ids uuid[] default '{}'::uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt exam_attempts%rowtype;
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
    and ea.user_id = v_user_id
    and ea.status = 'in_progress'
  returning ea.* into v_attempt;

  if not found then
    return;
  end if;

  -- Seen and not answered -> skipped (a solved question never goes back).
  -- Only questions that belong to this attempt count.
  insert into user_question_progress (user_id, question_id, status, skipped_at)
  select v_user_id, q.id, 'skipped', now()
  from questions q
  where q.id = any(v_attempt.viewed_ids)
    and q.deleted_at is null
    and (
      (v_attempt.exam_id is not null
        and q.exam_id = v_attempt.exam_id
        and (v_attempt.question_ids is null or q.id = any(v_attempt.question_ids)))
      or
      (v_attempt.custom_exam_id is not null
        and exists (select 1 from custom_exams ce
                    where ce.id = v_attempt.custom_exam_id and q.id = any(ce.question_ids)))
    )
    and not exists (
      select 1 from attempt_answers aa
      where aa.attempt_id = p_attempt_id
        and aa.question_id = q.id
        and aa.chosen_answer is not null
    )
  on conflict (user_id, question_id) do update
    set skipped_at = now(),
        updated_at = now()
    where user_question_progress.status = 'skipped';
end;
$function$;

-- 2. Apply the rule once to the attempts that are open right now
create temporary table phase1b_new_skipped on commit drop as
with candidates as (
  select distinct ea.user_id, q.id as question_id
  from exam_attempts ea
  join questions q on q.id = any(ea.viewed_ids) and q.deleted_at is null
  where ea.status = 'in_progress'
    and ea.user_id is not null
    and (
      (ea.exam_id is not null
        and q.exam_id = ea.exam_id
        and (ea.question_ids is null or q.id = any(ea.question_ids)))
      or
      (ea.custom_exam_id is not null
        and exists (select 1 from custom_exams ce
                    where ce.id = ea.custom_exam_id and q.id = any(ce.question_ids)))
    )
    and not exists (
      select 1 from attempt_answers aa
      where aa.attempt_id = ea.id and aa.question_id = q.id and aa.chosen_answer is not null
    )
),
inserted as (
  insert into public.user_question_progress (user_id, question_id, status, skipped_at)
  select user_id, question_id, 'skipped', now()
  from candidates
  on conflict (user_id, question_id) do nothing
  returning 1
)
select count(*) as n from inserted;

-- 3. Self-checks (any failure undoes everything above)
do $$
begin
  if position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) = 0 then
    raise exception 'Self-check failed: save_attempt_progress was not updated';
  end if;
  -- No question can be both answered and skipped
  if exists (
    select 1 from public.user_question_progress
    where status = 'skipped' and (answer_count > 0 or first_answer is not null)
  ) then
    raise exception 'Self-check failed: a skipped row has an answer';
  end if;
end $$;

-- 4. Summary (read-only, inside the transaction). Send this table to the chat.
select 1 as n, 'new skipped rows from open attempts' as item, (select n from phase1b_new_skipped)::text as value
union all
select 2, 'progress rows: solved', count(*)::text from public.user_question_progress where status = 'solved'
union all
select 3, 'progress rows: skipped', count(*)::text from public.user_question_progress where status = 'skipped'
union all
select 4, 'save_attempt_progress marks skipped',
  (position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) > 0)::text
order by n;

commit;
