-- SENKON /tasarim/ requests: private storage bucket for project files that visitors attach.
-- Run in the Supabase SQL editor, after schema-stage2.sql. Safe to re-run: each policy is dropped and created again.
--
-- Visitors are anonymous, so anon may only INSERT, and only to a path of the exact shape the page builds
-- (<YYYYMMDD>-<12 random chars>/<clean file name>.<allowed extension>). There is deliberately no anon select,
-- update or delete: a visitor can not list, read, overwrite or remove anything, including their own upload.
-- The bucket is private; the owner (the only authenticated user) reads and deletes from the dashboard or panel.
-- The pattern below is the same one as PATH_RE in assets/senkon/upload.js (a test keeps them identical).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('talepler', 'talepler', false, 52428800, null)
on conflict (id) do update
  set public = false, file_size_limit = 52428800, allowed_mime_types = null;

drop policy if exists talepler_anon_insert on storage.objects;
create policy talepler_anon_insert on storage.objects for insert to anon
  with check (bucket_id = 'talepler' and name ~* '^[0-9]{8}-[a-z0-9]{12}\/[^/]+\.(pdf|dwg|dxf|ifc|zip|jpg|jpeg|png)$');

drop policy if exists talepler_owner_select on storage.objects;
create policy talepler_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'talepler');
drop policy if exists talepler_owner_delete on storage.objects;
create policy talepler_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'talepler');
