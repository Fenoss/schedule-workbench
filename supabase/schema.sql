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


-- Programmes group projects on the Portfolio page. 'team' ones are visible to every approved user.
create table if not exists public.programmes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  code        text not null default '',
  client      text not null default '',
  description text not null default '',
  colour      text not null default '',
  space       text not null default 'team' check (space in ('team', 'private')),
  owner       uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 'team' projects are visible to every approved user; 'private' projects only to their owner.
-- A project with no periods yet is a 'slot' on the Portfolio page.
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  space       text not null default 'team' check (space in ('team', 'private')),
  owner       uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_dd     bigint
);

alter table public.projects add column if not exists programme_id uuid references public.programmes (id) on delete set null;
alter table public.projects add column if not exists code        text not null default '';
alter table public.projects add column if not exists status      text not null default 'active';
alter table public.projects add column if not exists manager     text not null default '';
alter table public.projects add column if not exists description text not null default '';
alter table public.projects add column if not exists summary     jsonb;  -- headline figures from the latest period, kept current by a trigger
do $$ begin
  alter table public.projects add constraint projects_status_check check (status in ('planned', 'active', 'on_hold', 'complete'));
exception when duplicate_object then null; end $$;
create index if not exists projects_programme_idx on public.projects (programme_id);

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
  r text := 'pending';
begin
  select not exists (select 1 from public.profiles) into first_user;
  -- Replaced further down by the company-aware version.
  if first_user then r := 'admin'; end if;
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
  -- auth.uid() is null for direct database sessions (SQL editor, service key), which are trusted.
  if new.role is distinct from old.role and auth.uid() is not null then
    if private.my_role() <> 'admin' then raise exception 'Only admins can change access'; end if;
    if old.id = auth.uid() then raise exception 'You cannot change your own access'; end if;
  end if;
  if new.id <> old.id or new.email is distinct from old.email then raise exception 'Profile id and email cannot be changed'; end if;
  return new;
end $$;
drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function private.guard_profile_update();

-- Keep each project's summary (latest period's headline figures) current as periods are added or removed.
create or replace function private.refresh_project_summary(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.periods;
  prev_finish jsonb;
  n int;
begin
  select * into a from public.periods where project_id = pid order by dd desc nulls last, saved_at desc limit 1;
  if not found then
    update public.projects set summary = null, last_dd = null where id = pid;
    return;
  end if;
  select p.stats -> 'finish' into prev_finish from public.periods p
   where p.project_id = pid and p.id <> a.id and coalesce(p.dd, 0) <= coalesce(a.dd, 0)
   order by p.dd desc nulls last, p.saved_at desc limit 1;
  select count(*) into n from public.periods where project_id = pid;
  update public.projects set last_dd = a.dd, summary = jsonb_build_object(
      'periodId', a.id, 'label', a.label, 'dd', a.dd,
      'finish', a.stats -> 'finish', 'blFinish', a.stats -> 'blFinish', 'bei', a.stats -> 'bei',
      'crit', a.stats -> 'crit', 'neg', a.stats -> 'neg', 'pctA', a.stats -> 'pctA', 'pctP', a.stats -> 'pctP',
      'rel', a.stats -> 'rel', 'n', a.stats -> 'n', 'prevFinish', prev_finish, 'count', n)
   where id = pid;
end $$;

create or replace function private.touch_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.refresh_project_summary(coalesce(new.project_id, old.project_id));
  return null;
end $$;
drop trigger if exists touch_project on public.periods;
create trigger touch_project after insert or update or delete on public.periods
  for each row execute function private.touch_project();

create or replace function private.stamp_updated() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists stamp_updated on public.projects;
create trigger stamp_updated before update on public.projects
  for each row execute function private.stamp_updated();
drop trigger if exists stamp_updated on public.programmes;
create trigger stamp_updated before update on public.programmes
  for each row execute function private.stamp_updated();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.programmes   enable row level security;
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



-- programmes
drop policy if exists programmes_read on public.programmes;
create policy programmes_read on public.programmes for select to authenticated
  using (private.my_role() <> 'pending' and (space = 'team' or owner = auth.uid()));
drop policy if exists programmes_insert on public.programmes;
create policy programmes_insert on public.programmes for insert to authenticated
  with check (owner = auth.uid() and (
    (space = 'team' and private.my_role() in ('contributor', 'admin'))
    or (space = 'private' and private.my_role() <> 'pending')));
drop policy if exists programmes_update on public.programmes;
create policy programmes_update on public.programmes for update to authenticated
  using (private.my_role() = 'admin' or owner = auth.uid())
  with check (private.my_role() = 'admin' or owner = auth.uid());
drop policy if exists programmes_delete on public.programmes;
create policy programmes_delete on public.programmes for delete to authenticated
  using (private.my_role() = 'admin' or owner = auth.uid());

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
    begin alter publication supabase_realtime add table public.programmes; exception when duplicate_object then null; end;
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
grant select, insert, update, delete on public.profiles, public.programmes, public.projects, public.periods, public.xer_files to authenticated;

-- Fill in summaries for projects that already have periods.
select private.refresh_project_summary(id) from public.projects;



-- ---------------------------------------------------------------------------
-- Companies (multi-tenant). Must run after everything above.
-- ---------------------------------------------------------------------------
-- Multi-company: a workbench owner (master admin), separate company instances, and an admin per company.
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(name) between 1 and 120),
  status              text not null default 'active' check (status in ('active', 'suspended')),
  auto_approve_domain text,
  auto_approve_role   text not null default 'viewer' check (auto_approve_role in ('viewer', 'contributor')),
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null
);
alter table public.profiles add column if not exists company_id        uuid references public.companies (id) on delete set null;
alter table public.profiles add column if not exists is_owner          boolean not null default false;
alter table public.profiles add column if not exists active_company_id uuid references public.companies (id) on delete set null;
create index if not exists profiles_company_idx on public.profiles (company_id);

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('viewer', 'contributor', 'admin')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists invitations_open_idx on public.invitations (company_id, lower(email)) where accepted_at is null;

create table if not exists public.company_settings (
  company_id  uuid primary key references public.companies (id) on delete cascade,
  quality     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

alter table public.programmes add column if not exists company_id uuid references public.companies (id) on delete restrict;
alter table public.projects   add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists programmes_company_idx on public.programmes (company_id);
create index if not exists projects_company_idx on public.projects (company_id);

-- Helpers
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false)
$$;
-- The company whose data you're working in: your own, or for the owner the one they've switched into.
create or replace function private.my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select case when p.is_owner then coalesce(p.active_company_id, p.company_id) else p.company_id end
  from public.profiles p where p.id = auth.uid()
$$;
-- Your role in that company. The owner is admin everywhere; people with no company, or in a suspended one, are pending.
create or replace function private.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when p.is_owner then 'admin'
                when p.company_id is null then 'pending'
                when c.status <> 'active' then 'pending'
                else p.role end
    from public.profiles p left join public.companies c on c.id = p.company_id
    where p.id = auth.uid()), 'pending')
$$;
create or replace function private.can_read_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and private.my_role() <> 'pending' and pr.company_id = private.my_company()
      and (pr.space = 'team' or pr.owner = auth.uid()))
$$;
create or replace function private.can_write_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and pr.company_id = private.my_company()
      and ((pr.space = 'team' and private.my_role() in ('contributor', 'admin'))
           or (pr.space = 'private' and pr.owner = auth.uid() and private.my_role() <> 'pending')))
$$;

-- Backfill: existing data becomes the first company; the owner accounts are flagged.
do $$
declare cid uuid;
begin
  select id into cid from public.companies order by created_at limit 1;
  if cid is null then
    insert into public.companies (name) values ('My company') returning id into cid;
    if to_regclass('public.app_settings') is not null then
      execute 'update public.companies c set auto_approve_domain = s.auto_approve_domain, auto_approve_role = coalesce(s.auto_approve_role, ''viewer'') from public.app_settings s where s.id = 1 and c.id = $1' using cid;
    end if;
  end if;
  update public.profiles   set company_id = cid where company_id is null;
  update public.programmes set company_id = cid where company_id is null;
  update public.projects   set company_id = cid where company_id is null;
  if to_regclass('public.quality_settings') is not null then
    execute 'insert into public.company_settings (company_id, quality) select $1, q.config from public.quality_settings q where q.id = 1 on conflict (company_id) do nothing' using cid;
  end if;
end $$;
-- If no one is the workbench owner yet, the earliest admin becomes it. Add more owners in the SQL editor:
--   update public.profiles set is_owner = true where email = 'you@example.com';
update public.profiles set is_owner = true
 where not exists (select 1 from public.profiles where is_owner)
   and id = (select id from public.profiles where role = 'admin' order by created_at limit 1);

alter table public.programmes alter column company_id set default private.my_company();
alter table public.projects   alter column company_id set default private.my_company();
alter table public.programmes alter column company_id set not null;
alter table public.projects   alter column company_id set not null;

-- Sign-up: the first person is the owner; then an open invitation, then a company's auto-approve domain, else pending with no company.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
  inv public.invitations;
  co  public.companies;
  r   text := 'pending';
  cid uuid;
  own boolean := false;
begin
  select not exists (select 1 from public.profiles) into first_user;
  select * into inv from public.invitations where lower(email) = lower(new.email) and accepted_at is null order by created_at limit 1;
  if first_user then
    own := true; r := 'admin';
    select id into cid from public.companies order by created_at limit 1;
    if cid is null then insert into public.companies (name) values ('My company') returning id into cid; end if;
  elsif inv.id is not null then
    cid := inv.company_id; r := inv.role;
    update public.invitations set accepted_at = now() where id = inv.id;
  else
    select * into co from public.companies
     where status = 'active' and auto_approve_domain is not null and lower(auto_approve_domain) = lower(split_part(new.email, '@', 2))
     order by created_at limit 1;
    if co.id is not null then cid := co.id; r := co.auto_approve_role; end if;
  end if;
  insert into public.profiles (id, email, name, role, company_id, is_owner)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          r, cid, own)
  on conflict (id) do nothing;
  return new;
end $$;

-- Who may change what on a profile.
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Direct database sessions (SQL editor, service key) and the workbench's own invitation step are trusted.
  if auth.uid() is null or current_setting('sw.trusted', true) = 'on' then return new; end if;
  if new.id <> old.id or new.email is distinct from old.email then raise exception 'Profile id and email cannot be changed'; end if;
  if new.is_owner is distinct from old.is_owner then
    if not private.is_owner() then raise exception 'Only the workbench owner can change owner access'; end if;
    if old.id = auth.uid() then raise exception 'You cannot change your own owner access'; end if;
  end if;
  if new.active_company_id is distinct from old.active_company_id and not (old.id = auth.uid() and old.is_owner) then
    raise exception 'Only the workbench owner can switch companies';
  end if;
  if new.company_id is distinct from old.company_id and not private.is_owner() then
    if not (private.my_role() = 'admin' and old.company_id = private.my_company() and new.company_id is null) then
      raise exception 'Only the workbench owner can move people between companies';
    end if;
    new.role := 'pending';
  end if;
  if new.role is distinct from old.role then
    if not (private.is_owner() or (private.my_role() = 'admin' and old.company_id = private.my_company())) then raise exception 'Only admins can change access'; end if;
    if old.id = auth.uid() and not private.is_owner() then raise exception 'You cannot change your own access'; end if;
  end if;
  return new;
end $$;

-- Only the owner changes a company's status.
create or replace function private.guard_company_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.status is distinct from old.status and not private.is_owner() then
    raise exception 'Only the workbench owner can suspend or reactivate a company';
  end if;
  return new;
end $$;
create or replace trigger guard_company_update before update on public.companies
  for each row execute function private.guard_company_update();

-- Inviting someone who has already signed in (and has no company) adds them straight away.
create or replace function private.apply_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  perform set_config('sw.trusted', 'on', true);
  update public.profiles set company_id = new.company_id, role = new.role
   where lower(email) = new.email and company_id is null and not is_owner;
  if found then new.accepted_at := now(); end if;
  perform set_config('sw.trusted', '', true);
  return new;
end $$;
create or replace trigger apply_invitation before insert on public.invitations
  for each row execute function private.apply_invitation();

-- Company admins (and the owner) take someone out of a company; they go back to pending with no company.
create or replace function public.company_remove_user(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.profiles;
begin
  select * into t from public.profiles where id = uid;
  if t.id is null then raise exception 'Person not found'; end if;
  if uid = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  if t.is_owner then raise exception 'The workbench owner cannot be removed from a company'; end if;
  if not (private.is_owner() or (private.my_role() = 'admin' and t.company_id = private.my_company())) then raise exception 'Only an admin of this company can remove people'; end if;
  perform set_config('sw.trusted', 'on', true);
  update public.profiles set company_id = null, role = 'pending' where id = uid;
  perform set_config('sw.trusted', '', true);
end $$;
-- The owner places someone in a company with a role.
create or replace function public.owner_assign_user(uid uuid, cid uuid, r text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_owner() then raise exception 'Only the workbench owner can move people between companies'; end if;
  if r not in ('pending', 'viewer', 'contributor', 'admin') then raise exception 'Unknown role'; end if;
  perform set_config('sw.trusted', 'on', true);
  update public.profiles set company_id = cid, role = case when cid is null then 'pending' else r end where id = uid and not (is_owner and id = auth.uid());
  perform set_config('sw.trusted', '', true);
end $$;

-- Owner tools
create or replace function public.set_active_company(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_owner() then raise exception 'Only the workbench owner can switch companies'; end if;
  if cid is not null and not exists (select 1 from public.companies where id = cid) then raise exception 'Company not found'; end if;
  update public.profiles set active_company_id = cid where id = auth.uid();
end $$;
create or replace function public.owner_companies()
returns table (id uuid, name text, status text, auto_approve_domain text, auto_approve_role text, notes text, created_at timestamptz,
               users bigint, admins bigint, pending bigint, programmes bigint, projects bigint, periods bigint, invites bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_owner() then raise exception 'Only the workbench owner can list companies'; end if;
  return query
  select c.id, c.name, c.status, c.auto_approve_domain, c.auto_approve_role, c.notes, c.created_at,
    (select count(*) from public.profiles p where p.company_id = c.id),
    (select count(*) from public.profiles p where p.company_id = c.id and p.role = 'admin'),
    (select count(*) from public.profiles p where p.company_id = c.id and p.role = 'pending'),
    (select count(*) from public.programmes g where g.company_id = c.id),
    (select count(*) from public.projects pr where pr.company_id = c.id),
    (select count(*) from public.periods pe join public.projects pr on pr.id = pe.project_id where pr.company_id = c.id),
    (select count(*) from public.invitations i where i.company_id = c.id and i.accepted_at is null)
  from public.companies c order by c.name;
end $$;

-- Access rules
alter table public.companies        enable row level security;
alter table public.invitations      enable row level security;
alter table public.company_settings enable row level security;

alter policy profiles_read on public.profiles
  using (id = auth.uid() or private.is_owner() or (private.my_role() <> 'pending' and company_id = private.my_company()));
alter policy profiles_admin_update on public.profiles
  using (private.is_owner() or (private.my_role() = 'admin' and company_id = private.my_company()))
  with check (private.is_owner() or (private.my_role() = 'admin' and (company_id = private.my_company() or company_id is null)));
alter policy profiles_admin_delete on public.profiles
  using ((private.is_owner() or (private.my_role() = 'admin' and company_id = private.my_company())) and id <> auth.uid());

alter policy programmes_read on public.programmes
  using (private.my_role() <> 'pending' and company_id = private.my_company() and (space = 'team' or owner = auth.uid()));
alter policy programmes_insert on public.programmes
  with check (owner = auth.uid() and company_id = private.my_company() and (
    (space = 'team' and private.my_role() in ('contributor', 'admin'))
    or (space = 'private' and private.my_role() <> 'pending')));
alter policy programmes_update on public.programmes
  using (company_id = private.my_company() and (private.my_role() = 'admin' or owner = auth.uid()))
  with check (company_id = private.my_company() and (private.my_role() = 'admin' or owner = auth.uid()));
alter policy programmes_delete on public.programmes
  using (company_id = private.my_company() and (private.my_role() = 'admin' or owner = auth.uid()));

alter policy projects_read on public.projects
  using (private.my_role() <> 'pending' and company_id = private.my_company() and (space = 'team' or owner = auth.uid()));
alter policy projects_insert on public.projects
  with check (owner = auth.uid() and company_id = private.my_company() and (
    (space = 'team' and private.my_role() in ('contributor', 'admin'))
    or (space = 'private' and private.my_role() <> 'pending')));
alter policy projects_update on public.projects
  using (company_id = private.my_company() and (private.my_role() = 'admin' or owner = auth.uid()))
  with check (company_id = private.my_company() and (private.my_role() = 'admin' or owner = auth.uid()));
alter policy projects_delete on public.projects
  using (company_id = private.my_company() and (private.my_role() = 'admin' or owner = auth.uid()));

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_read') then
    create policy companies_read on public.companies for select to authenticated
      using (private.is_owner() or id = private.my_company());
    create policy companies_insert on public.companies for insert to authenticated with check (private.is_owner());
    create policy companies_update on public.companies for update to authenticated
      using (private.is_owner() or (private.my_role() = 'admin' and id = private.my_company()))
      with check (private.is_owner() or (private.my_role() = 'admin' and id = private.my_company()));
    create policy companies_delete on public.companies for delete to authenticated using (private.is_owner());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitations' and policyname = 'invitations_admin') then
    create policy invitations_admin on public.invitations for all to authenticated
      using (private.is_owner() or (private.my_role() = 'admin' and company_id = private.my_company()))
      with check (private.is_owner() or (private.my_role() = 'admin' and company_id = private.my_company()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_settings' and policyname = 'company_settings_read') then
    create policy company_settings_read on public.company_settings for select to authenticated
      using (company_id = private.my_company() and private.my_role() <> 'pending');
    create policy company_settings_insert on public.company_settings for insert to authenticated
      with check (company_id = private.my_company() and private.my_role() = 'admin');
    create policy company_settings_update on public.company_settings for update to authenticated
      using (company_id = private.my_company() and private.my_role() = 'admin')
      with check (company_id = private.my_company() and private.my_role() = 'admin');
  end if;
end $$;

grant select, insert, update, delete on public.companies, public.invitations, public.company_settings to authenticated;
revoke execute on function private.is_owner(), private.my_company(), private.handle_new_user(), private.guard_profile_update(), private.guard_company_update(), private.apply_invitation() from public, anon;
grant execute on function private.is_owner(), private.my_company() to authenticated;
revoke execute on function public.set_active_company(uuid), public.owner_companies(), public.company_remove_user(uuid), public.owner_assign_user(uuid, uuid, text) from public, anon;
grant execute on function public.set_active_company(uuid), public.owner_companies(), public.company_remove_user(uuid), public.owner_assign_user(uuid, uuid, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- Company branding (title, accent colour, logo) and site features (AI, Build tab, sample buttons).
alter table public.companies add column if not exists branding jsonb not null default '{}'::jsonb;
alter table public.company_settings add column if not exists site jsonb not null default '{}'::jsonb;

-- Earlier versions kept settings in these tables; companies and company_settings replace them.
drop table if exists public.quality_settings;
drop table if exists public.app_settings;

-- Audit log: who changed access, companies, invitations, settings, and who saved or deleted schedule data.
create table if not exists public.audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_email text,
  company_id  uuid references public.companies (id) on delete set null,
  action      text not null,
  target      text not null default '',
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_company_idx on public.audit_log (company_id, at desc);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_log' and policyname = 'audit_read') then
    create policy audit_read on public.audit_log for select to authenticated
      using (private.is_owner() or (private.my_role() = 'admin' and company_id = private.my_company()));
  end if;
end $$;
grant select on public.audit_log to authenticated;

create or replace function private.audit(act text, cid uuid, tgt text, det jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, actor_email, company_id, action, target, detail)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), cid, act, coalesce(tgt, ''), coalesce(det, '{}'::jsonb));
end $$;

create or replace function private.audit_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then perform private.audit('access.changed', coalesce(new.company_id, old.company_id), new.email, jsonb_build_object('from', old.role, 'to', new.role)); end if;
    if new.company_id is distinct from old.company_id then
      perform private.audit('person.moved', coalesce(old.company_id, new.company_id), new.email, jsonb_build_object('from', (select name from public.companies where id = old.company_id), 'to', (select name from public.companies where id = new.company_id)));
      if new.company_id is not null and old.company_id is not null then perform private.audit('person.moved', new.company_id, new.email, jsonb_build_object('from', (select name from public.companies where id = old.company_id), 'to', (select name from public.companies where id = new.company_id))); end if;
    end if;
    if new.is_owner is distinct from old.is_owner then perform private.audit(case when new.is_owner then 'owner.added' else 'owner.removed' end, null, new.email, '{}'); end if;
    return new;
  elsif tg_op = 'INSERT' then
    perform private.audit('person.signed_up', new.company_id, new.email, jsonb_build_object('role', new.role));
    return new;
  else
    perform private.audit('person.deleted', old.company_id, old.email, '{}');
    return old;
  end if;
end $$;
create or replace trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_profiles();

create or replace function private.audit_companies() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform private.audit('company.created', new.id, new.name, '{}'); return new;
  elsif tg_op = 'DELETE' then perform private.audit('company.deleted', null, old.name, '{}'); return old;
  else
    if new.status is distinct from old.status then perform private.audit(case when new.status = 'active' then 'company.reactivated' else 'company.suspended' end, new.id, new.name, '{}'); end if;
    if new.name is distinct from old.name then perform private.audit('company.renamed', new.id, new.name, jsonb_build_object('from', old.name)); end if;
    if new.auto_approve_domain is distinct from old.auto_approve_domain or new.auto_approve_role is distinct from old.auto_approve_role then
      perform private.audit('company.signin_changed', new.id, new.name, jsonb_build_object('domain', new.auto_approve_domain, 'role', new.auto_approve_role)); end if;
    if new.branding is distinct from old.branding then perform private.audit('company.branding_changed', new.id, new.name, jsonb_build_object('title', new.branding ->> 'title', 'accent', new.branding ->> 'accent', 'logo', (new.branding ? 'logo'))); end if;
    return new;
  end if;
end $$;
create or replace trigger audit_companies after insert or update or delete on public.companies
  for each row execute function private.audit_companies();

create or replace function private.audit_invitations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform private.audit('invite.sent', new.company_id, new.email, jsonb_build_object('role', new.role, 'joined_now', new.accepted_at is not null)); return new;
  elsif tg_op = 'DELETE' then if old.accepted_at is null then perform private.audit('invite.cancelled', old.company_id, old.email, '{}'); end if; return old;
  else return new; end if;
end $$;
create or replace trigger audit_invitations after insert or delete on public.invitations
  for each row execute function private.audit_invitations();

create or replace function private.audit_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.quality is distinct from old.quality then perform private.audit('settings.quality_changed', new.company_id, 'Quality checks', jsonb_build_object('default', new.quality ->> 'def')); end if;
  if tg_op = 'INSERT' or new.site is distinct from old.site then if new.site <> '{}'::jsonb then perform private.audit('settings.features_changed', new.company_id, 'Features', new.site); end if; end if;
  return new;
end $$;
create or replace trigger audit_settings after insert or update on public.company_settings
  for each row execute function private.audit_settings();

create or replace function private.audit_projects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform private.audit('project.created', new.company_id, new.name, jsonb_build_object('space', new.space)); return new;
  else perform private.audit('project.deleted', old.company_id, old.name, jsonb_build_object('space', old.space)); return old; end if;
end $$;
create or replace trigger audit_projects after insert or delete on public.projects
  for each row execute function private.audit_projects();

create or replace function private.audit_programmes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform private.audit('programme.created', new.company_id, new.name, '{}'); return new;
  else perform private.audit('programme.deleted', old.company_id, old.name, '{}'); return old; end if;
end $$;
create or replace trigger audit_programmes after insert or delete on public.programmes
  for each row execute function private.audit_programmes();

create or replace function private.audit_periods() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr public.projects;
begin
  select * into pr from public.projects where id = coalesce(new.project_id, old.project_id);
  if tg_op = 'INSERT' then perform private.audit('update.saved', pr.company_id, coalesce(pr.name, '') || ' · ' || new.label, jsonb_build_object('notes', left(new.notes, 200))); return new;
  else perform private.audit('update.deleted', pr.company_id, coalesce(pr.name, '') || ' · ' || old.label, '{}'); return old; end if;
end $$;
create or replace trigger audit_periods after insert or delete on public.periods
  for each row execute function private.audit_periods();

revoke execute on function private.audit(text, uuid, text, jsonb), private.audit_profiles(), private.audit_companies(), private.audit_invitations(), private.audit_settings(), private.audit_projects(), private.audit_programmes(), private.audit_periods() from public, anon, authenticated;

-- Structured narrative saved with each update.
alter table public.periods add column if not exists narrative jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Performance: evaluate sign-in helpers once per query, not once per row,
-- and index the foreign keys. Safe to run again.
-- ---------------------------------------------------------------------------
do $$
declare r record; q text; c text; f text;
begin
  for r in select tablename, policyname, qual, with_check from pg_policies
           where schemaname='public' and (coalesce(qual,'')||coalesce(with_check,'')) ~ '(?<!select )(auth\.uid\(\)|private\.(my_role|my_company|is_owner)\(\))'
  loop
    q := r.qual; c := r.with_check;
    foreach f in array array['auth.uid()','private.my_role()','private.my_company()','private.is_owner()'] loop
      q := replace(replace(q, '(select '||f||')', f), f, '(select '||f||')');
      c := replace(replace(c, '(select '||f||')', f), f, '(select '||f||')');
    end loop;
    execute format('alter policy %I on public.%I %s %s', r.policyname, r.tablename,
      case when q is not null then 'using ('||q||')' else '' end,
      case when c is not null then 'with check ('||c||')' else '' end);
  end loop;
end $$;
create index if not exists companies_created_by_idx on public.companies(created_by);
create index if not exists company_settings_updated_by_idx on public.company_settings(updated_by);
create index if not exists invitations_invited_by_idx on public.invitations(invited_by);
create index if not exists periods_saved_by_idx on public.periods(saved_by);
create index if not exists profiles_active_company_idx on public.profiles(active_company_id);
create index if not exists programmes_owner_idx on public.programmes(owner);
create index if not exists projects_owner_idx on public.projects(owner);
create index if not exists xer_files_created_by_idx on public.xer_files(created_by);

-- ---------------------------------------------------------------------------
-- Risk Workbench: risk registers at portfolio, programme and project level.
-- Safe to run again. Appended to schema.sql as well.
-- ---------------------------------------------------------------------------
alter table public.company_settings add column if not exists risk jsonb not null default '{}'::jsonb;

create table if not exists public.risks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default private.my_company() references public.companies (id) on delete cascade,
  space        text not null default 'team' check (space in ('team', 'private')),
  owner        uuid default auth.uid() references auth.users (id) on delete set null,
  level        text not null check (level in ('portfolio', 'programme', 'project')),
  programme_id uuid references public.programmes (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  parent_id    uuid references public.risks (id) on delete set null,
  ref          text not null default '',
  title        text not null,
  status       text not null default 'open',
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid() references auth.users (id) on delete set null,
  check ((level = 'portfolio' and programme_id is null and project_id is null)
      or (level = 'programme' and programme_id is not null and project_id is null)
      or (level = 'project' and project_id is not null))
);
create index if not exists risks_company_idx   on public.risks (company_id, space);
create index if not exists risks_programme_idx on public.risks (programme_id);
create index if not exists risks_project_idx   on public.risks (project_id);
create index if not exists risks_parent_idx    on public.risks (parent_id);
create index if not exists risks_owner_idx     on public.risks (owner);
create index if not exists risks_updated_by_idx on public.risks (updated_by);

create or replace function private.risks_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.company_id := old.company_id; new.owner := old.owner; end if;
  if new.parent_id = new.id then new.parent_id := null; end if;
  if new.parent_id is not null and not exists (select 1 from public.risks r where r.id = new.parent_id and r.company_id = new.company_id) then new.parent_id := null; end if;
  return new;
end $$;
create or replace trigger risks_touch before insert or update on public.risks
  for each row execute function private.risks_touch();

alter table public.risks enable row level security;
drop policy if exists risks_read on public.risks;
create policy risks_read on public.risks for select to authenticated
  using ((select private.my_role()) <> 'pending' and company_id = (select private.my_company())
         and (space = 'team' or owner = (select auth.uid()))
         and (project_id is null or private.can_read_project(project_id)));
drop policy if exists risks_insert on public.risks;
create policy risks_insert on public.risks for insert to authenticated
  with check (owner = (select auth.uid()) and company_id = (select private.my_company()) and (
    (space = 'team' and (select private.my_role()) in ('contributor', 'admin'))
    or (space = 'private' and (select private.my_role()) <> 'pending')));
drop policy if exists risks_update on public.risks;
create policy risks_update on public.risks for update to authenticated
  using (company_id = (select private.my_company()) and (
    (space = 'team' and (select private.my_role()) in ('contributor', 'admin'))
    or (space = 'private' and owner = (select auth.uid()))))
  with check (company_id = (select private.my_company()));
drop policy if exists risks_delete on public.risks;
create policy risks_delete on public.risks for delete to authenticated
  using (company_id = (select private.my_company()) and ((select private.my_role()) = 'admin' or owner = (select auth.uid())));
grant select, insert, update, delete on public.risks to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.risks; exception when duplicate_object then null; end;
  end if;
end $$;

create or replace function private.audit_risks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform private.audit('risk.created', new.company_id, trim(new.ref || ' ' || new.title), jsonb_build_object('level', new.level)); return new;
  elsif tg_op = 'DELETE' then perform private.audit('risk.deleted', old.company_id, trim(old.ref || ' ' || old.title), jsonb_build_object('level', old.level)); return old;
  else
    if new.status is distinct from old.status then perform private.audit('risk.status', new.company_id, trim(new.ref || ' ' || new.title), jsonb_build_object('from', old.status, 'to', new.status)); end if;
    if new.parent_id is distinct from old.parent_id and new.parent_id is not null then perform private.audit('risk.linked', new.company_id, trim(new.ref || ' ' || new.title), jsonb_build_object('parent', (select trim(ref || ' ' || title) from public.risks where id = new.parent_id))); end if;
    return new;
  end if;
end $$;
create or replace trigger audit_risks after insert or update or delete on public.risks
  for each row execute function private.audit_risks();

create or replace function private.audit_risk_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.risk is distinct from old.risk) and new.risk <> '{}'::jsonb then
    perform private.audit('settings.risk_changed', new.company_id, 'Risk registers', jsonb_build_object('align', new.risk ->> 'align'));
  end if;
  return new;
end $$;
create or replace trigger audit_risk_settings after insert or update on public.company_settings
  for each row execute function private.audit_risk_settings();
