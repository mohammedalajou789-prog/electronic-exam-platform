-- =============================================================================
-- Open issue 1: protect chapters and lectures - ROLLBACK
-- Date: 2026-09-30
--
-- Puts questions.chapter_id / questions.lecture_id back to ON DELETE SET NULL,
-- exactly as before 2026-09-30_protect_chapters_lectures.sql.
-- Run this only to undo that file.
--
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

alter table public.questions drop constraint questions_chapter_id_fkey;
alter table public.questions
  add constraint questions_chapter_id_fkey
  foreign key (chapter_id) references public.chapters(id) on delete set null;

alter table public.questions drop constraint questions_lecture_id_fkey;
alter table public.questions
  add constraint questions_lecture_id_fkey
  foreign key (lecture_id) references public.lectures(id) on delete set null;

commit;
