-- =============================================================================
-- Batches restructure - Phase 2 functions
-- Date: 2026-09-29
--
-- The 4 database functions below reached an exam's subject through
-- batches.subject_id. They now read exams.subject_id directly (added in
-- Phase 1), which keeps working after Phase 3 makes batches shared.
--
-- Only the joins change. Names, parameters, return shapes, security mode
-- (invoker / definer), STABLE and search_path are exactly as before, so
-- existing permissions are kept and the app code needs no change.
--   * get_my_study_stats          : subject via e.subject_id
--   * get_my_study_tip_data       : filter on e.subject_id
--   * get_questions_per_subject   : subjects -> exams directly
--   * search_questions            : subject via e.subject_id; the batch is
--                                   still joined for its name and filter, and
--                                   the JSON result keeps the same shape
--                                   (exam -> batch -> subject)
--
-- Undo: 2026-09-29_batches_phase2_functions_ROLLBACK.sql
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

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

CREATE OR REPLACE FUNCTION public.get_my_study_tip_data(p_subject_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with subject_answers as (
    -- Answered questions only (skipped never count), finished or unfinished attempts
    select aa.question_id, aa.is_correct, aa.answered_at, q.chapter_id, q.lecture_id
    from attempt_answers aa
    join exam_attempts ea on ea.id = aa.attempt_id
    join questions q      on q.id = aa.question_id
    join exams e          on e.id = q.exam_id
    where ea.user_id = auth.uid()
      and aa.chosen_answer is not null
      and e.subject_id = p_subject_id
  ),
  gaps as (
    select answered_at, lag(answered_at) over (order by answered_at) as previous_at
    from subject_answers
  ),
  current_session as (
    -- The session starts at the last answer that came after a 30-day break
    select max(answered_at) as session_start
    from gaps
    where previous_at is null or answered_at - previous_at > interval '30 days'
  ),
  latest_answers as (
    -- The LATEST answer to each question in this session (shows where the student is now)
    select distinct on (sa.question_id) sa.question_id, sa.is_correct, sa.chapter_id, sa.lecture_id
    from subject_answers sa
    cross join current_session cs
    where sa.answered_at >= cs.session_start
    order by sa.question_id, sa.answered_at desc
  ),
  chapter_stats as (
    select la.chapter_id, c.name as chapter_name,
           count(*) as total,
           count(*) filter (where not la.is_correct) as wrong
    from latest_answers la
    join chapters c on c.id = la.chapter_id
    group by la.chapter_id, c.name
  ),
  lecture_stats as (
    select la.chapter_id, la.lecture_id, l.name as lecture_name,
           count(*) as total,
           count(*) filter (where not la.is_correct) as wrong
    from latest_answers la
    join lectures l on l.id = la.lecture_id
    group by la.chapter_id, la.lecture_id, l.name
  )
  select jsonb_build_object(
    'session_start',    (select session_start from current_session),
    'questions_solved', (select count(*) from latest_answers),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'chapter_id', cs.chapter_id,
        'chapter',    cs.chapter_name,
        'total',      cs.total,
        'wrong',      cs.wrong,
        'lectures',   coalesce((
          select jsonb_agg(jsonb_build_object(
            'lecture_id', ls.lecture_id,
            'lecture',    ls.lecture_name,
            'total',      ls.total,
            'wrong',      ls.wrong
          ))
          from lecture_stats ls
          where ls.chapter_id = cs.chapter_id
        ), '[]'::jsonb)
      ))
      from chapter_stats cs
    ), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_questions_per_subject()
 RETURNS TABLE(subject_name text, question_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.name AS subject_name,
    COUNT(q.id) AS question_count
  FROM subjects s
  JOIN exams e ON e.subject_id = s.id
  JOIN questions q ON q.exam_id = e.id
  WHERE q.deleted_at IS NULL
    AND e.deleted_at IS NULL
  GROUP BY s.name
  ORDER BY question_count DESC;
$function$;

CREATE OR REPLACE FUNCTION public.search_questions(search_terms text[], filter_year_id uuid DEFAULT NULL::uuid, filter_semester_id uuid DEFAULT NULL::uuid, filter_subject_id uuid DEFAULT NULL::uuid, filter_batch_id uuid DEFAULT NULL::uuid, filter_exam_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with matched as (
    select
      q.id, q.question_text, q.question_order,
      q.choice_a, q.choice_b, q.choice_c, q.choice_d, q.choice_e,
      q.correct_answer, q.explanation, q.chapter_id, q.lecture_id,
      ch.id   as ch_id,   ch.name  as ch_name,
      le.id   as le_id,   le.name  as le_name,
      e.id    as e_id,    e.title  as e_title, e.calendar_year, e.exam_type, e.status,
      b.id    as b_id,    b.name   as b_name,
      s.id    as s_id,    s.name   as s_name, s.semester_id, s.year_id,
      sem.id  as sem_id,  sem.name as sem_name,
      sy.id   as sy_id,   sy.name  as sy_name,   -- year reached through the semester (pre-clinical)
      dy.id   as dy_id,   dy.name  as dy_name    -- year linked directly to the subject (clinical)
    from questions q
    join exams e                on e.id   = q.exam_id
    left join batches b         on b.id   = e.batch_id
    left join subjects s        on s.id   = e.subject_id
    left join semesters sem     on sem.id = s.semester_id
    left join academic_years sy on sy.id  = sem.academic_year_id
    left join academic_years dy on dy.id  = s.year_id
    left join chapters ch       on ch.id  = q.chapter_id
    left join lectures le       on le.id  = q.lecture_id
    where q.deleted_at is null
      and e.status = 'published'
      and e.deleted_at is null
      and (filter_exam_id     is null or e.id   = filter_exam_id)
      and (filter_batch_id    is null or b.id   = filter_batch_id)
      and (filter_subject_id  is null or s.id   = filter_subject_id)
      and (filter_semester_id is null or sem.id = filter_semester_id)
      and (filter_year_id     is null or coalesce(sy.id, dy.id) = filter_year_id)
      -- every term must be found: "no term is missing"
      and not exists (
        select 1
        from unnest(search_terms) as t(term)
        where concat_ws(' ',
                q.question_text, ch.name, le.name, q.correct_answer, q.explanation,
                q.choice_a, q.choice_b, q.choice_c, q.choice_d, q.choice_e,
                e.title, e.calendar_year::text, b.name, s.name, sem.name,
                coalesce(sy.name, dy.name)
              )
              -- % and _ typed by the student are searched literally, not as wildcards
              not ilike '%' || replace(replace(replace(t.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  )
  select jsonb_build_object(
    'total', count(*),
    'results', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'question_text', m.question_text,
          'question_order', m.question_order,
          'choice_a', m.choice_a, 'choice_b', m.choice_b, 'choice_c', m.choice_c,
          'choice_d', m.choice_d, 'choice_e', m.choice_e,
          'correct_answer', m.correct_answer,
          'explanation', m.explanation,
          'chapter_id', m.chapter_id,
          'lecture_id', m.lecture_id,
          'chapter', case when m.ch_id is null then null
                          else jsonb_build_object('id', m.ch_id, 'name', m.ch_name) end,
          'lecture', case when m.le_id is null then null
                          else jsonb_build_object('id', m.le_id, 'name', m.le_name) end,
          'exam', jsonb_build_object(
            'id', m.e_id,
            'title', m.e_title,
            'calendar_year', m.calendar_year,
            'exam_type', m.exam_type,
            'status', m.status,
            'batch', case when m.b_id is null then null else jsonb_build_object(
              'id', m.b_id,
              'name', m.b_name,
              'subject', case when m.s_id is null then null else jsonb_build_object(
                'id', m.s_id,
                'name', m.s_name,
                'semester_id', m.semester_id,
                'year_id', m.year_id,
                'semester', case when m.sem_id is null then null else jsonb_build_object(
                  'id', m.sem_id,
                  'name', m.sem_name,
                  'academic_year', case when m.sy_id is null then null
                                        else jsonb_build_object('id', m.sy_id, 'name', m.sy_name) end
                ) end,
                'academic_year', case when m.dy_id is null then null
                                      else jsonb_build_object('id', m.dy_id, 'name', m.dy_name) end
              ) end
            ) end
          )
        )
        order by m.s_name, m.e_title, m.question_order
      ),
      '[]'::jsonb
    )
  )
  from matched m;
$function$;

commit;
