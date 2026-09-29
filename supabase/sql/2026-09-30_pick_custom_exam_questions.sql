-- =============================================================================
-- Open issue 3: pick custom exam questions inside the database
-- Date: 2026-09-30
--
-- The custom exam used to fetch the ids of every matching question and shuffle
-- them in the app. The Supabase API returns at most 1000 rows per request, so
-- in a subject with more than 1000 questions only the first 1000 could ever be
-- picked. This function filters, shuffles and limits inside the database and
-- returns only the chosen ids (in order).
--
--   p_exam_ids     exams to take questions from (already filtered by the app)
--   p_chapter_ids  optional: only these chapters (empty or NULL = all)
--   p_lecture_ids  optional: only these lectures (empty or NULL = all)
--   p_count        how many questions to return
--   p_randomize    true = random order; false = exam, then question order
--
-- VOLATILE because of random(). SECURITY INVOKER: the caller's RLS applies.
--
-- Undo: 2026-09-30_pick_custom_exam_questions_ROLLBACK.sql
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

-- Fails (and rolls back) if a function with this name already exists
create function public.pick_custom_exam_questions(
  p_exam_ids    uuid[],
  p_chapter_ids uuid[],
  p_lecture_ids uuid[],
  p_count       integer,
  p_randomize   boolean
)
returns uuid[]
language sql
volatile
security invoker
set search_path = public
as $$
  with candidates as (
    select q.id,
           case when p_randomize then random() else 0 end as sort_key,
           q.exam_id,
           q.question_order
    from questions q
    where q.exam_id = any(p_exam_ids)
      and q.deleted_at is null
      and (coalesce(cardinality(p_chapter_ids), 0) = 0 or q.chapter_id = any(p_chapter_ids))
      and (coalesce(cardinality(p_lecture_ids), 0) = 0 or q.lecture_id = any(p_lecture_ids))
  ),
  ranked as (
    select id,
           row_number() over (order by sort_key, exam_id, question_order, id) as rn
    from candidates
  )
  select coalesce(array_agg(id order by rn), '{}'::uuid[])
  from ranked
  where rn <= greatest(coalesce(p_count, 0), 0);
$$;

commit;

-- Summary (read-only)
select p.oid::regprocedure as function_signature,
       case when p.provolatile = 'v' then 'volatile' else p.provolatile::text end as volatility,
       case when p.prosecdef then 'security definer' else 'security invoker' end as security
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'pick_custom_exam_questions';
