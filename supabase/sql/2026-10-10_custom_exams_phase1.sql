-- supabase/sql/2026-10-10_custom_exams_phase1.sql
--
-- Custom exam rebuild, phase 1 (database). Paste in Supabase -> SQL Editor ->
-- New query -> Run. Everything runs in one transaction: it applies completely
-- or not at all. Undo with 2026-10-10_custom_exams_phase1_ROLLBACK.sql.
--
-- What it does:
--   1. Backs up the old custom exams (19 rows on 10 Oct 2026) and their attempts.
--   2. Deletes the old custom exams (they have no owner and no name; decided by
--      the user). Open attempts on them are closed as "abandoned" first (none of
--      them had a question seen). Question progress (solved / skipped) is kept.
--   3. custom_exams gets an owner, a name, a link name (slug) and the filters used.
--      A student's exams are private; guests get temporary exams (no owner,
--      no name) that are removed after 7 days.
--   4. New functions:
--        create_custom_exam      - checks, picks the questions and saves the exam
--        get_custom_exam_options - doctors / chapters / lectures of a subject
--        delete_my_custom_exam   - the owner deletes an exam for good
--   5. start_exam_attempt only opens a student's own custom exam.
--   6. Nobody can insert into custom_exams directly any more (open issue #2).

begin;

-- -- 0. Safety checks ----------------------------------------------------------
do $$
begin
  if to_regclass('public.user_question_progress') is null then
    raise exception 'The question progress system (9 Oct 2026) is missing. Nothing was changed.';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'custom_exams' and column_name = 'user_id') then
    raise exception 'This file has already been applied (custom_exams.user_id exists). Nothing was changed.';
  end if;
  if to_regclass('migration_backup.custom_exams_20261010') is not null
     or to_regclass('migration_backup.custom_exam_attempts_20261010') is not null then
    raise exception 'Backup tables already exist in migration_backup. Nothing was changed.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('create_custom_exam', 'get_custom_exam_options', 'delete_my_custom_exam')) then
    raise exception 'A function with a new name already exists. Nothing was changed.';
  end if;
end $$;

-- -- 1. Backups ----------------------------------------------------------------
create schema if not exists migration_backup;

create table migration_backup.custom_exams_20261010 as
  select * from public.custom_exams;

create table migration_backup.custom_exam_attempts_20261010 as
  select id, custom_exam_id, status
  from public.exam_attempts
  where custom_exam_id is not null;

-- -- 2. Remove the old custom exams --------------------------------------------
-- Open attempts on them are closed first (their answers stay in the answer log).
update public.exam_attempts
set status = 'abandoned'
where custom_exam_id is not null
  and status = 'in_progress';

-- exam_attempts.custom_exam_id is ON DELETE SET NULL: the attempt history stays.
delete from public.custom_exams;

-- -- 3. New columns and rules --------------------------------------------------
alter table public.custom_exams
  add column user_id    uuid references public.users(id) on delete cascade,
  add column name       text,
  add column slug       text,
  add column filters    jsonb not null default '{}'::jsonb,
  alter column subject_id set not null;

alter table public.custom_exams
  -- A student's exam has an owner, a name and a link name; a guest's exam has none
  add constraint custom_exams_owner_name
    check ((user_id is null and name is null and slug is null)
        or (user_id is not null and name is not null and slug is not null)),
  -- English letters, digits, spaces and - ( ) & , . ' _ ; 3 to 60 characters; at least one letter
  add constraint custom_exams_name_format
    check (name is null or (
      name ~ '^[A-Za-z0-9 ()&,.''_-]{3,60}$'
      and name ~ '[A-Za-z]'
      and name = btrim(name)
      and name !~ '  ')),
  add constraint custom_exams_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60)),
  add constraint custom_exams_question_count
    check (cardinality(question_ids) between 1 and 200);

-- The link name is unique for each student
create unique index custom_exams_user_slug on public.custom_exams (user_id, slug) where user_id is not null;
create index custom_exams_user_created on public.custom_exams (user_id, created_at desc);

-- -- 4. Who can read and write -------------------------------------------------
drop policy if exists "anyone can create custom exam" on public.custom_exams;
drop policy if exists "anyone can read custom exam" on public.custom_exams;

create policy "students read own custom exams" on public.custom_exams
  for select to authenticated
  using (user_id = auth.uid());

-- Guests' temporary exams are opened by their link (a random id), as before
create policy "anyone can read guest custom exams" on public.custom_exams
  for select
  using (user_id is null);

-- Every write goes through the functions below
revoke insert, update, delete, truncate on public.custom_exams from anon, authenticated;

-- -- 5. Functions --------------------------------------------------------------

-- Doctors, chapters and lectures of a subject for the builder, counted in the
-- database (only published exams and active questions; no 1000-row limit).
create function public.get_custom_exam_options(p_subject_id uuid)
 returns jsonb
 language sql
 stable
 security invoker
 set search_path to 'public'
as $function$
  with q as (
    select q.id, q.doctor_id, q.chapter_id, q.lecture_id
    from questions q
    join exams e on e.id = q.exam_id
    where e.subject_id = p_subject_id
      and e.deleted_at is null
      and e.status = 'published'
      and q.deleted_at is null
  )
  select jsonb_build_object(
    'total_questions',  (select count(*) from q),
    'tagged_questions', (select count(*) from q where doctor_id is not null),
    -- Only doctors who have tagged questions in this subject
    'doctors', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'count', x.n) order by d.name)
      from (select doctor_id, count(*) as n from q where doctor_id is not null group by doctor_id) x
      join doctors d on d.id = x.doctor_id), '[]'::jsonb),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'count', x.n) order by c.display_order, c.name)
      from (select chapter_id, count(*) as n from q where chapter_id is not null group by chapter_id) x
      join chapters c on c.id = x.chapter_id), '[]'::jsonb),
    'lectures', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'chapter_id', l.chapter_id, 'count', x.n)
                       order by l.display_order, l.name)
      from (select lecture_id, count(*) as n from q where lecture_id is not null group by lecture_id) x
      join lectures l on l.id = x.lecture_id), '[]'::jsonb)
  );
$function$;

-- Creates a custom exam: checks the input, picks the questions and saves it.
-- Logged-in students: a name is required, the exam is private, and the
-- "not answered yet" / "wrong on first try" filters can be used.
-- Guests: no name, no personal filters; the exam is temporary (7 days).
-- Returns {id, slug, question_count}.
create function public.create_custom_exam(
  p_subject_id   uuid,
  p_name         text    default null,
  p_count        integer default 20,
  p_randomize    boolean default true,
  p_batch_ids    uuid[]  default '{}'::uuid[],
  p_doctor_ids   uuid[]  default '{}'::uuid[],
  p_chapter_ids  uuid[]  default '{}'::uuid[],
  p_lecture_ids  uuid[]  default '{}'::uuid[],
  p_not_answered boolean default false,
  p_first_wrong  boolean default false
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name    text;
  v_slug    text;
  v_ids     uuid[];
  v_id      uuid;
begin
  -- a. Input checks
  if p_count is null or p_count not between 1 and 200 then
    raise exception 'The number of questions must be between 1 and 200' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_batch_ids), 0) > 200 or coalesce(cardinality(p_doctor_ids), 0) > 200
     or coalesce(cardinality(p_chapter_ids), 0) > 500 or coalesce(cardinality(p_lecture_ids), 0) > 1000 then
    raise exception 'Too many filters' using errcode = '22023';
  end if;
  if not exists (select 1 from subjects where id = p_subject_id) then
    raise exception 'Subject not found' using errcode = 'P0002';
  end if;

  if v_user_id is null then
    -- Guests: temporary exam, no personal filters
    if coalesce(p_not_answered, false) or coalesce(p_first_wrong, false) then
      raise exception 'Sign in to use your own progress as a filter' using errcode = '42501';
    end if;
    v_name := null;
    v_slug := null;
    -- Remove guests' temporary exams older than 7 days
    delete from custom_exams
    where user_id is null and created_at < now() - interval '7 days';
  else
    if not exists (select 1 from users where id = v_user_id) then
      raise exception 'User profile not found' using errcode = 'P0002';
    end if;
    v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
    if v_name !~ '^[A-Za-z0-9 ()&,.''_-]{3,60}$' or v_name !~ '[A-Za-z]' then
      raise exception 'Use 3 to 60 English letters, digits and spaces for the exam name' using errcode = '22023';
    end if;
    v_slug := btrim(lower(regexp_replace(v_name, '[^A-Za-z0-9]+', '-', 'g')), '-');
    if exists (select 1 from custom_exams where user_id = v_user_id and slug = v_slug) then
      raise exception 'You already have a custom exam with this name' using errcode = '23505';
    end if;
  end if;

  -- b. Pick the questions (filters inside the database; empty list = all)
  with candidates as (
    select q.id,
           case when p_randomize then random() else 0 end as sort_key,
           q.exam_id, q.question_order
    from questions q
    join exams e on e.id = q.exam_id
    where e.subject_id = p_subject_id
      and e.deleted_at is null
      and e.status = 'published'
      and q.deleted_at is null
      and (coalesce(cardinality(p_batch_ids), 0) = 0   or e.batch_id   = any(p_batch_ids))
      -- Doctor filter on the question itself: untagged questions are left out
      and (coalesce(cardinality(p_doctor_ids), 0) = 0  or q.doctor_id  = any(p_doctor_ids))
      and (coalesce(cardinality(p_chapter_ids), 0) = 0 or q.chapter_id = any(p_chapter_ids))
      and (coalesce(cardinality(p_lecture_ids), 0) = 0 or q.lecture_id = any(p_lecture_ids))
      -- Personal filters (both ticked = either one)
      and (
        (not coalesce(p_not_answered, false) and not coalesce(p_first_wrong, false))
        or (coalesce(p_not_answered, false) and not exists (
              select 1 from user_question_progress p
              where p.user_id = v_user_id and p.question_id = q.id and p.status = 'solved'))
        or (coalesce(p_first_wrong, false) and exists (
              select 1 from user_question_progress p
              where p.user_id = v_user_id and p.question_id = q.id
                and p.status = 'solved' and p.first_is_correct = false))
      )
  )
  select array_agg(id order by sort_key, exam_id, question_order, id)
  into v_ids
  from (select * from candidates order by sort_key, exam_id, question_order, id limit p_count) c;

  if v_ids is null then
    raise exception 'No questions match these filters' using errcode = 'P0002';
  end if;

  -- c. Save
  insert into custom_exams (subject_id, user_id, name, slug, question_ids, question_count, filters)
  values (
    p_subject_id, v_user_id, v_name, v_slug, v_ids, cardinality(v_ids),
    jsonb_build_object(
      'requested_count', p_count,
      'randomize',       coalesce(p_randomize, false),
      'batch_ids',       to_jsonb(coalesce(p_batch_ids, '{}'::uuid[])),
      'doctor_ids',      to_jsonb(coalesce(p_doctor_ids, '{}'::uuid[])),
      'chapter_ids',     to_jsonb(coalesce(p_chapter_ids, '{}'::uuid[])),
      'lecture_ids',     to_jsonb(coalesce(p_lecture_ids, '{}'::uuid[])),
      'not_answered',    coalesce(p_not_answered, false),
      'first_wrong',     coalesce(p_first_wrong, false)
    )
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'question_count', cardinality(v_ids));
exception
  -- Two tabs created the same name at the same moment
  when unique_violation then
    raise exception 'You already have a custom exam with this name' using errcode = '23505';
end;
$function$;

-- The owner deletes a custom exam for good. An open attempt is ended first,
-- exactly like pressing Finish. Solved / skipped questions stay as they are.
create function public.delete_my_custom_exam(p_custom_exam_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  perform 1 from custom_exams where id = p_custom_exam_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Custom exam not found' using errcode = 'P0002';
  end if;

  select id into v_attempt
  from exam_attempts
  where user_id = v_user_id and custom_exam_id = p_custom_exam_id and status = 'in_progress';
  if v_attempt is not null then
    perform finish_exam_attempt(v_attempt, '[]'::jsonb, 0);
  end if;

  -- exam_attempts.custom_exam_id becomes null; the history stays
  delete from custom_exams where id = p_custom_exam_id and user_id = v_user_id;
  return true;
end;
$function$;

revoke all on function public.create_custom_exam(uuid, text, integer, boolean, uuid[], uuid[], uuid[], uuid[], boolean, boolean) from public;
grant execute on function public.create_custom_exam(uuid, text, integer, boolean, uuid[], uuid[], uuid[], uuid[], boolean, boolean) to anon, authenticated;
revoke all on function public.delete_my_custom_exam(uuid) from public, anon;
grant execute on function public.delete_my_custom_exam(uuid) to authenticated;
grant execute on function public.get_custom_exam_options(uuid) to anon, authenticated;

-- start_exam_attempt: same as before, except that a student's custom exam can
-- only be opened by its owner (a guest exam by anyone with the link).
create or replace function public.start_exam_attempt(p_exam_id uuid default null::uuid, p_custom_exam_id uuid default null::uuid, p_resume boolean default false, p_question_ids uuid[] default null::uuid[])
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
    -- A student's custom exam belongs to that student only
    if not exists (select 1 from custom_exams
                   where id = p_custom_exam_id
                     and (user_id is null or user_id = v_user_id)) then
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

-- -- 6. Self-checks ------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.custom_exams) then
    raise exception 'Self-check failed: old custom exams are still there';
  end if;
  if exists (select 1 from public.exam_attempts
             where status = 'in_progress' and exam_id is null and custom_exam_id is null) then
    raise exception 'Self-check failed: an open attempt lost its exam';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.custom_exams'::regclass
             and polname in ('anyone can create custom exam', 'anyone can read custom exam')) then
    raise exception 'Self-check failed: old policies are still there';
  end if;
  if has_table_privilege('anon', 'public.custom_exams', 'insert')
     or has_table_privilege('authenticated', 'public.custom_exams', 'insert') then
    raise exception 'Self-check failed: direct insert is still allowed';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('create_custom_exam', 'get_custom_exam_options', 'delete_my_custom_exam')) <> 3 then
    raise exception 'Self-check failed: new functions';
  end if;
end $$;

commit;

-- -- 7. Summary (send this table back) -----------------------------------------
select 1 as n, 'backup: old custom exams' as item, (select count(*) from migration_backup.custom_exams_20261010)::text as value
union all
select 2, 'backup: attempts on them', (select count(*) from migration_backup.custom_exam_attempts_20261010)::text
union all
select 3, 'custom exams now', (select count(*) from public.custom_exams)::text
union all
select 4, 'new columns', (select string_agg(column_name, ', ' order by column_name) from information_schema.columns
                          where table_schema = 'public' and table_name = 'custom_exams'
                            and column_name in ('user_id', 'name', 'slug', 'filters'))
union all
select 5, 'policies', (select string_agg(polname, ', ' order by polname) from pg_policy
                       where polrelid = 'public.custom_exams'::regclass)
union all
select 6, 'new functions', (select string_agg(p.proname, ', ' order by p.proname)
                            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                              and p.proname in ('create_custom_exam', 'get_custom_exam_options', 'delete_my_custom_exam'))
order by 1;
