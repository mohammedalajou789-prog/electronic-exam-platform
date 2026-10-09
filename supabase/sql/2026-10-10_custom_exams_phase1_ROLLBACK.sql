-- supabase/sql/2026-10-10_custom_exams_phase1_ROLLBACK.sql
--
-- Undoes 2026-10-10_custom_exams_phase1.sql and restores the exact previous state:
-- the 19 old custom exams, their attempts, the old policies and functions.
-- WARNING: custom exams created after phase 1 are deleted by this file.
-- Paste in Supabase -> SQL Editor -> New query -> Run.

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'custom_exams' and column_name = 'user_id') then
    raise exception 'Phase 1 is not applied (custom_exams.user_id is missing). Nothing was changed.';
  end if;
  if to_regclass('migration_backup.custom_exams_20261010') is null
     or to_regclass('migration_backup.custom_exam_attempts_20261010') is null then
    raise exception 'The phase 1 backup tables are missing. Nothing was changed.';
  end if;
end $$;

-- 1. New functions
drop function public.create_custom_exam(uuid, text, integer, boolean, uuid[], uuid[], uuid[], uuid[], boolean, boolean);
drop function public.get_custom_exam_options(uuid);
drop function public.delete_my_custom_exam(uuid);

-- 2. start_exam_attempt as it was before phase 1
CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_exam_id uuid DEFAULT NULL::uuid, p_custom_exam_id uuid DEFAULT NULL::uuid, p_resume boolean DEFAULT false, p_question_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- 3. Custom exams made after phase 1 (their attempts keep their history)
delete from public.custom_exams;

-- 4. Table back to its old shape
drop policy if exists "students read own custom exams" on public.custom_exams;
drop policy if exists "anyone can read guest custom exams" on public.custom_exams;
drop index if exists public.custom_exams_user_slug;
drop index if exists public.custom_exams_user_created;
alter table public.custom_exams
  drop constraint custom_exams_owner_name,
  drop constraint custom_exams_name_format,
  drop constraint custom_exams_slug_format,
  drop constraint custom_exams_question_count,
  drop column user_id,
  drop column name,
  drop column slug,
  drop column filters,
  alter column subject_id drop not null;

create policy "anyone can create custom exam" on public.custom_exams
  for insert
  with check (true);
create policy "anyone can read custom exam" on public.custom_exams
  for select
  using (true);
grant insert, update, delete, truncate on public.custom_exams to anon, authenticated;

-- 5. Old rows and their attempts
insert into public.custom_exams (id, subject_id, question_ids, question_count, created_at)
select id, subject_id, question_ids, question_count, created_at
from migration_backup.custom_exams_20261010;

update public.exam_attempts ea
set custom_exam_id = b.custom_exam_id,
    status         = b.status
from migration_backup.custom_exam_attempts_20261010 b
where ea.id = b.id;

-- 6. Self-checks
do $$
begin
  if (select count(*) from public.custom_exams) <> (select count(*) from migration_backup.custom_exams_20261010) then
    raise exception 'Self-check failed: custom exams were not restored';
  end if;
  if exists (select 1 from migration_backup.custom_exam_attempts_20261010 b
             join public.exam_attempts ea on ea.id = b.id
             where ea.custom_exam_id is distinct from b.custom_exam_id or ea.status <> b.status) then
    raise exception 'Self-check failed: attempts were not restored';
  end if;
end $$;

drop table migration_backup.custom_exams_20261010;
drop table migration_backup.custom_exam_attempts_20261010;

commit;

select 'custom exams restored' as item, (select count(*) from public.custom_exams)::text as value
union all
select 'policies', (select string_agg(polname, ', ' order by polname) from pg_policy
                    where polrelid = 'public.custom_exams'::regclass);
