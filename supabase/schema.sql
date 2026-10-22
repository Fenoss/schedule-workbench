-- Schedule Workbench: database, file storage and access rules for Supabase.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste this file -> Run.
-- Safe to re-run: objects are created only if missing and policies are replaced.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per person who signs in. New people start as 'pending' until an admin approves them.
-- The first person to sign in becomes 'admin' automatically.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'pending' check (role in ('pending', 'viewer', 'contributor', 'admin')),
  created_at  timestamptz not null default now()
);

-- Optional: anyone signing in with an email on this domain is approved straight away with this role.
-- Example: insert into public.app_settings (id, auto_approve_domain, auto_approve_role) values (1, 'yourcompany.com', 'viewer')
--          on conflict (id) do update set auto_approve_domain = excluded.auto_approve_domain, auto_approve_role = excluded.auto_approve_role;
create table if not exists public.app_settings (
  id                  int primary key default 1 check (id = 1),
  auto_approve_domain text,
  auto_approve_role   text not null default 'viewer' check (auto_approve_role in ('viewer', 'contributor'))
);

-- 'team' projects are visible to every approved user; 'private' projects only to their owner.
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  space       text not null default 'team' check (space in ('team', 'private')),
  owner       uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_dd     bigint
);

-- One row per saved schedule update. dd = data date in milliseconds since 1970 (UTC).
-- stats holds the period's headline figures; files lists the XER files (by content hash) and their roles.
create table if not exists public.periods (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  label       text not null check (length(label) between 1 and 120),
  notes       text not null default '',
  dd          bigint,
  stats       jsonb not null default '{}'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  saved_by    uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  saved_at    timestamptz not null default now()
);
create index if not exists periods_project_idx on public.periods (project_id, dd);

-- Index of the XER files kept in Storage. A file used by several periods (e.g. the baseline) is stored once.
create table if not exists public.xer_files (
  project_id  uuid not null references public.projects (id) on delete cascade,
  hash        text not null,
  name        text not null,
  size        bigint,
  path        text not null,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (project_id, hash)
);

-- ---------------------------------------------------------------------------
-- Helper functions used by the access rules
-- ---------------------------------------------------------------------------
-- They live in a 'private' schema so they can't be called through the public API.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'pending')
$$;

create or replace function private.can_read_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p
      and private.my_role() <> 'pending'
      and (pr.space = 'team' or pr.owner = auth.uid())
  )
$$;

create or replace function private.can_write_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p
      and (
        (pr.space = 'team' and private.my_role() in ('contributor', 'admin'))
        or (pr.space = 'private' and pr.owner = auth.uid() and private.my_role() <> 'pending')
      )
  )
$$;

-- Storage paths look like '<project uuid>/<hash>.xer.gz'. Returns null for anything else.
create or replace function private.path_project(path text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(path, '/', 1)::uuid end
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile when someone signs in for the first time.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
  s public.app_settings;
  r text := 'pending';
begin
  select not exists (select 1 from public.profiles) into first_user;
  select * into s from public.app_settings where id = 1;
  if first_user then
    r := 'admin';
  elsif s.auto_approve_domain is not null and lower(split_part(new.email, '@', 2)) = lower(s.auto_approve_domain) then
    r := s.auto_approve_role;
  end if;
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Only admins may change roles, and nobody may change their own role.
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if private.my_role() <> 'admin' then raise exception 'Only admins can change access'; end if;
    if old.id = auth.uid() then raise exception 'You cannot change your own access'; end if;
  end if;
  if new.id <> old.id or new.email is distinct from old.email then raise exception 'Profile id and email cannot be changed'; end if;
  return new;
end $$;
drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function private.guard_profile_update();

-- Keep the project's 'last updated' stamp current when periods are added.
create or replace function private.touch_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.projects set updated_at = now(), last_dd = greatest(coalesce(last_dd, 0), coalesce(new.dd, 0))
  where id = new.project_id;
  return new;
end $$;
drop trigger if exists touch_project on public.periods;
create trigger touch_project after insert on public.periods
  for each row execute function private.touch_project();

create or replace function private.stamp_updated() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists stamp_updated on public.projects;
create trigger stamp_updated before update on public.projects
  for each row execute function private.stamp_updated();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.app_settings enable row level security;
alter table public.projects     enable row level security;
alter table public.periods      enable row level security;
alter table public.xer_files    enable row level security;

-- profiles: you always see yourself; approved users see everyone (to show who saved what); admins edit.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.my_role() <> 'pending');
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (private.my_role() = 'admin') with check (private.my_role() = 'admin');
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles for delete to authenticated
  using (private.my_role() = 'admin' and id <> auth.uid());

-- app_settings: admins only.
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings for all to authenticated
  using (private.my_role() = 'admin') with check (private.my_role() = 'admin');

-- projects
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (private.my_role() <> 'pending' and (space = 'team' or owner = auth.uid()));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (owner = auth.uid() and (
    (space = 'team' and private.my_role() in ('contributor', 'admin'))
    or (space = 'private' and private.my_role() <> 'pending')));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (private.my_role() = 'admin' or owner = auth.uid())
  with check (private.my_role() = 'admin' or owner = auth.uid());
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
  using (private.my_role() = 'admin' or owner = auth.uid());

-- periods
drop policy if exists periods_read on public.periods;
create policy periods_read on public.periods for select to authenticated
  using (private.can_read_project(project_id));
drop policy if exists periods_insert on public.periods;
create policy periods_insert on public.periods for insert to authenticated
  with check (saved_by = auth.uid() and private.can_write_project(project_id));
drop policy if exists periods_update on public.periods;
create policy periods_update on public.periods for update to authenticated
  using (private.can_write_project(project_id) and (saved_by = auth.uid() or private.my_role() = 'admin'))
  with check (private.can_write_project(project_id));
drop policy if exists periods_delete on public.periods;
create policy periods_delete on public.periods for delete to authenticated
  using (private.can_read_project(project_id) and (
    saved_by = auth.uid() or private.my_role() = 'admin'
    or exists (select 1 from public.projects pr where pr.id = project_id and pr.owner = auth.uid())));

-- xer_files
drop policy if exists files_read on public.xer_files;
create policy files_read on public.xer_files for select to authenticated
  using (private.can_read_project(project_id));
drop policy if exists files_insert on public.xer_files;
create policy files_insert on public.xer_files for insert to authenticated
  with check (created_by = auth.uid() and private.can_write_project(project_id));
drop policy if exists files_update on public.xer_files;
create policy files_update on public.xer_files for update to authenticated
  using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
drop policy if exists files_delete on public.xer_files;
create policy files_delete on public.xer_files for delete to authenticated
  using (private.can_write_project(project_id));

-- ---------------------------------------------------------------------------
-- File storage: a private bucket for the compressed XER files (50 MB per file cap)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('xer', 'xer', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists xer_read on storage.objects;
create policy xer_read on storage.objects for select to authenticated
  using (bucket_id = 'xer' and private.can_read_project(private.path_project(name)));
drop policy if exists xer_insert on storage.objects;
create policy xer_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'xer' and private.can_write_project(private.path_project(name)));
drop policy if exists xer_update on storage.objects;
create policy xer_update on storage.objects for update to authenticated
  using (bucket_id = 'xer' and private.can_write_project(private.path_project(name)))
  with check (bucket_id = 'xer' and private.can_write_project(private.path_project(name)));
drop policy if exists xer_delete on storage.objects;
create policy xer_delete on storage.objects for delete to authenticated
  using (bucket_id = 'xer' and private.can_write_project(private.path_project(name)));

-- ---------------------------------------------------------------------------
-- Live updates: let open pages see new projects and periods without reloading
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.periods;  exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role(), private.can_read_project(uuid), private.can_write_project(uuid), private.path_project(text) to authenticated;
-- Supabase's sign-up service creates the profile row through the trigger function.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- Remove the earlier public copies of these functions if an older version of this script created them.
drop function if exists public.my_role();
drop function if exists public.can_read_project(uuid);
drop function if exists public.can_write_project(uuid);
drop function if exists public.path_project(text);
drop function if exists public.handle_new_user();
drop function if exists public.guard_profile_update();
drop function if exists public.touch_project();
drop function if exists public.stamp_updated();
grant select, insert, update, delete on public.profiles, public.projects, public.periods, public.xer_files, public.app_settings to authenticated;
