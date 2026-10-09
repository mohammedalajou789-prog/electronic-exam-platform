-- supabase/sql/2026-10-09_question_progress_phase1b_skip_on_leave_ROLLBACK.sql
--
-- Undoes 2026-10-09_question_progress_phase1b_skip_on_leave.sql:
--   1. save_attempt_progress goes back to the phase 1 version (saves progress only).
--   2. Skipped rows are brought back to the phase 1 rule: a question is skipped
--      only if it was seen and left unanswered in a FINISHED attempt.
--      Skipped rows without such an attempt (created by phase 1b) are removed.
-- Answers are never touched.
-- Run in: Supabase -> SQL Editor -> New query -> Run

begin;

-- 0. Safety check
do $$
begin
  if to_regprocedure('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])') is null
     or position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) = 0 then
    raise exception 'Phase 1b is not applied (or was already undone). Nothing was changed.';
  end if;
end $$;

-- 1. Phase 1 version of save_attempt_progress (exact copy)
create or replace function public.save_attempt_progress(p_attempt_id uuid, p_time_seconds integer, p_current_index integer default 0, p_viewed_ids uuid[] default '{}'::uuid[], p_flagged_ids uuid[] default '{}'::uuid[])
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

-- 2. Skipped rows without a finished attempt behind them
create temporary table phase1b_removed on commit drop as
with removed as (
  delete from public.user_question_progress p
  where p.status = 'skipped'
    and not exists (
      select 1
      from public.attempt_answers aa
      join public.exam_attempts ea on ea.id = aa.attempt_id
      where ea.user_id = p.user_id
        and ea.status = 'completed'
        and aa.question_id = p.question_id
        and aa.chosen_answer is null
        and aa.was_viewed
    )
  returning 1
)
select count(*) as n from removed;

-- 3. Self-check
do $$
begin
  if position('skipped' in pg_get_functiondef('public.save_attempt_progress(uuid,integer,integer,uuid[],uuid[])'::regprocedure)) > 0 then
    raise exception 'Rollback self-check failed: save_attempt_progress was not restored';
  end if;
end $$;

-- 4. Summary
select 1 as n, 'skipped rows removed' as item, (select n from phase1b_removed)::text as value
union all
select 2, 'progress rows: skipped', count(*)::text from public.user_question_progress where status = 'skipped'
order by n;

commit;
