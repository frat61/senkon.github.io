-- SENKON model viewer: database setup. Run once in the Supabase SQL editor of the dedicated project.
-- Before running: Authentication > Providers > Email: disable "Allow new users to sign up";
-- Authentication > Users: create the owner user manually.

create table public.models (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- random, unguessable, used in the link
  name        text not null,
  description text,
  kind        text not null default 'parametric' check (kind in ('parametric','file')),
  data        jsonb,                          -- parametric model (spec section 6)
  file_path   text,                           -- for kind = 'file', path in Storage (future)
  file_format text,                           -- 'ifc' | 'glb' (future)
  owner       uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.models enable row level security;

-- Owner can do everything with their own rows. No policy for anon, so anon cannot read the table.
create policy models_owner_all on public.models
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Public lookup by slug only. security definer bypasses RLS for this one query.
create or replace function public.get_model(p_slug text)
returns table (name text, description text, kind text, data jsonb, file_path text, file_format text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select name, description, kind, data, file_path, file_format, updated_at
  from public.models where slug = p_slug limit 1;
$$;
revoke all on function public.get_model(text) from public;
grant execute on function public.get_model(text) to anon, authenticated;

-- updated_at follows every update
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger models_updated_at before update on public.models
  for each row execute function public.set_updated_at();
