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
