-- =============================================================================
-- Open issue 3: pick custom exam questions - ROLLBACK
-- Date: 2026-09-30
--
-- Removes the function created by 2026-09-30_pick_custom_exam_questions.sql.
-- Run this only to undo that file (and only after the app code no longer calls it).
--
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

begin;

drop function public.pick_custom_exam_questions(uuid[], uuid[], uuid[], integer, boolean);

commit;
