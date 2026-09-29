-- =============================================================================
-- Batches restructure - Phase 3c: search batch filter
-- Date: 2026-09-29
--
-- search_questions: the batch filter compares the batch SLUG instead of the
-- batch row id. Before the switch a batch name still has one row per subject,
-- so the id sent by the page (the shared row) would miss exams that point to
-- another row of the same name. The slug is the same for all of them, and
-- stays correct after the switch.
--
-- Only that one condition changes; everything else is exactly the Phase 2
-- definition (same parameters, result shape, STABLE, invoker, search_path).
--
-- Undo: 2026-09-29_batches_phase3c_search_ROLLBACK.sql
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

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
      -- batch matched by slug (every batch name has one slug), so a batch filter
      -- finds the exams of that batch in every subject
      and (filter_batch_id    is null or b.slug = (select fb.slug from batches fb where fb.id = filter_batch_id))
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
