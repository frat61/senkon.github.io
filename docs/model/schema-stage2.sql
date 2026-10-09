-- SENKON model viewer, Stage 2: preview column and the storage bucket for uploaded GLB files.
-- Run once in the Supabase SQL editor, after schema.sql.

alter table public.models add column if not exists thumbnail text;   -- JPEG data URL, about 30-60 KB

-- Public bucket: anyone with the exact path can fetch a file; nobody can list the bucket
-- because there is no select policy for anon on storage.objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('models', 'models', true, 52428800, array['model/gltf-binary'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800, allowed_mime_types = array['model/gltf-binary'];

-- The owner (the only authenticated user; sign-ups are disabled) may manage objects in the bucket.
create policy models_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'models');
create policy models_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'models') with check (bucket_id = 'models');
create policy models_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'models');
create policy models_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'models');
