-- supabase/sql/2026-10-14_question_images_r2.sql
--
-- Question images move to Cloudflare R2 (14 Oct 2026). Paste in Supabase -> SQL Editor ->
-- New query -> Run. Undo with 2026-10-14_question_images_r2_ROLLBACK.sql.
--
-- The image files live in the R2 bucket. This table keeps only the object key, e.g.
--   q/<question id>/<32 random hex>.webp   (question images)
--   e/<question id>/<32 random hex>.webp   (explanation images, [Image Slot 1-3])
-- The app builds the public address as NEXT_PUBLIC_IMAGES_BASE_URL + '/' + key, so moving
-- to a custom domain later needs no database change.
--
-- 1. image_url is renamed to storage_key (the table is empty) and must be a key of the
--    form above that belongs to its own question (never a full URL).
-- 2. question_id and display_order become required.
-- 3. Keys are unique; at most one image per explanation slot per question.
-- 4. Index to load a question's images in order.
-- 5. Guests (anon) keep read access only. TRUNCATE / TRIGGER / REFERENCES are removed
--    from anon and authenticated. Writes stay limited to admins by the existing RLS policy.

begin;

-- 0. Safety checks
do $$
begin
  if to_regclass('public.question_images') is null then
    raise exception 'question_images is missing. Nothing was changed.';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'question_images'
               and column_name = 'storage_key') then
    raise exception 'This file has already been applied. Nothing was changed.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'question_images'
                   and column_name = 'image_url') then
    raise exception 'question_images.image_url is missing. Nothing was changed.';
  end if;
  if (select count(*) from public.question_images) > 0 then
    raise exception 'question_images is not empty (% rows). Nothing was changed.',
      (select count(*) from public.question_images);
  end if;
end $$;

-- 1. The object key instead of a full URL
alter table public.question_images rename column image_url to storage_key;

alter table public.question_images
  add constraint question_images_storage_key_check
  check (
    storage_key ~ '^[qe]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{32}\.(webp|png|jpg)$'
    and split_part(storage_key, '/', 2) = question_id::text
  );

-- 2. Required columns
alter table public.question_images alter column question_id set not null;
alter table public.question_images alter column display_order set not null;

-- 3. Unique keys, one image per explanation slot
alter table public.question_images
  add constraint question_images_storage_key_key unique (storage_key);

create unique index question_images_one_per_slot
  on public.question_images (question_id, slot_type)
  where slot_type <> 'question';

-- 4. A question's images in order
create index question_images_question_order
  on public.question_images (question_id, display_order);

-- 5. Privileges
revoke insert, update, delete, truncate, trigger, references on public.question_images from anon;
revoke truncate, trigger, references on public.question_images from authenticated;

-- 6. Self-checks
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'question_images'
                   and column_name = 'storage_key' and is_nullable = 'NO') then
    raise exception 'Self-check failed: storage_key';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'question_images'
               and column_name in ('question_id', 'display_order') and is_nullable = 'YES') then
    raise exception 'Self-check failed: required columns';
  end if;
  if to_regclass('public.question_images_one_per_slot') is null
     or to_regclass('public.question_images_question_order') is null
     or to_regclass('public.question_images_storage_key_key') is null then
    raise exception 'Self-check failed: indexes';
  end if;
  if has_table_privilege('anon', 'public.question_images', 'INSERT')
     or has_table_privilege('anon', 'public.question_images', 'DELETE')
     or not has_table_privilege('anon', 'public.question_images', 'SELECT')
     or has_table_privilege('authenticated', 'public.question_images', 'TRUNCATE') then
    raise exception 'Self-check failed: privileges';
  end if;
end $$;

commit;

-- 7. Summary (send this table back)
select 1 as n, 'storage_key column (required)' as item,
       (select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'question_images'
          and column_name = 'storage_key') as value
union all
select 2, 'image_url column still exists',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'question_images'
                 and column_name = 'image_url')::text
union all
select 3, 'key format check',
       (select pg_get_constraintdef(oid) is not null from pg_constraint
        where conname = 'question_images_storage_key_check')::text
union all
select 4, 'indexes',
       (select string_agg(indexname, ', ' order by indexname) from pg_indexes
        where schemaname = 'public' and tablename = 'question_images')
union all
select 5, 'anon privileges',
       (select string_agg(privilege_type, ',' order by privilege_type)
        from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'question_images' and grantee = 'anon')
union all
select 6, 'authenticated privileges',
       (select string_agg(privilege_type, ',' order by privilege_type)
        from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'question_images' and grantee = 'authenticated')
union all
select 7, 'rows', (select count(*) from public.question_images)::text
order by 1;
