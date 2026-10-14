-- supabase/sql/2026-10-14_question_images_r2_ROLLBACK.sql
--
-- Undoes 2026-10-14_question_images_r2.sql: storage_key back to image_url, the new
-- constraints and indexes removed, the previous privileges given back.
-- Paste in Supabase -> SQL Editor -> New query -> Run.
--
-- It refuses to run while the table has rows: the rows hold R2 keys, not URLs, and the
-- old code could not show them. Delete those images from the admin pages first.

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'question_images'
                   and column_name = 'storage_key') then
    raise exception 'storage_key is missing: the file was not applied or was already undone. Nothing was changed.';
  end if;
  if (select count(*) from public.question_images) > 0 then
    raise exception 'question_images has % rows (R2 keys). Nothing was changed.',
      (select count(*) from public.question_images);
  end if;
end $$;

drop index public.question_images_question_order;
drop index public.question_images_one_per_slot;
alter table public.question_images drop constraint question_images_storage_key_key;
alter table public.question_images drop constraint question_images_storage_key_check;
alter table public.question_images alter column display_order drop not null;
alter table public.question_images alter column question_id drop not null;
alter table public.question_images rename column storage_key to image_url;

grant insert, update, delete, truncate, trigger, references on public.question_images to anon;
grant truncate, trigger, references on public.question_images to authenticated;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'question_images'
                   and column_name = 'image_url')
     or to_regclass('public.question_images_one_per_slot') is not null
     or not has_table_privilege('anon', 'public.question_images', 'INSERT') then
    raise exception 'Self-check failed: the old state was not restored';
  end if;
end $$;

commit;

select 'restored' as item, 'question_images.image_url, old constraints and privileges' as value;
