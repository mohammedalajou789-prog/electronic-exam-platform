-- =============================================================================
-- Open issue 1: protect chapters and lectures that have questions
-- Date: 2026-09-30
--
-- Before: questions.chapter_id / questions.lecture_id were ON DELETE SET NULL,
-- so deleting a chapter (which also deletes its lectures) silently removed the
-- chapter and lecture of every question that used them.
--
-- After: ON DELETE RESTRICT. The database refuses to delete a chapter or a
-- lecture while any question (active or soft-deleted) still uses it.
-- No data is changed; only the two foreign keys are replaced.
--
-- Undo: 2026-09-30_protect_chapters_lectures_ROLLBACK.sql
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

-- Safety check: both foreign keys exist and are still ON DELETE SET NULL
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'questions_chapter_id_fkey' and confdeltype = 'n') then
    raise exception 'questions_chapter_id_fkey is missing or is not ON DELETE SET NULL (already changed?)';
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'questions_lecture_id_fkey' and confdeltype = 'n') then
    raise exception 'questions_lecture_id_fkey is missing or is not ON DELETE SET NULL (already changed?)';
  end if;
end $$;

alter table public.questions drop constraint questions_chapter_id_fkey;
alter table public.questions
  add constraint questions_chapter_id_fkey
  foreign key (chapter_id) references public.chapters(id) on delete restrict;

alter table public.questions drop constraint questions_lecture_id_fkey;
alter table public.questions
  add constraint questions_lecture_id_fkey
  foreign key (lecture_id) references public.lectures(id) on delete restrict;

-- Self-check
do $$
begin
  if (select count(*) from pg_constraint
      where conname in ('questions_chapter_id_fkey', 'questions_lecture_id_fkey')
        and confdeltype = 'r') <> 2 then
    raise exception 'The two foreign keys are not ON DELETE RESTRICT';
  end if;
end $$;

commit;

-- Summary (read-only)
select conname as constraint_name, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in ('questions_chapter_id_fkey', 'questions_lecture_id_fkey', 'lectures_chapter_id_fkey')
order by conname;
