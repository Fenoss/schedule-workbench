-- ---------------------------------------------------------------------------
-- Framework Workbench: shared data structures (WBS, OBS, RBS, CBS, code lists,
-- interface register, project attributes) and attribute values on programmes
-- and projects. Safe to run again. Appended to schema.sql as well.
-- ---------------------------------------------------------------------------
alter table public.programmes add column if not exists attrs jsonb not null default '{}'::jsonb;
alter table public.projects   add column if not exists attrs jsonb not null default '{}'::jsonb;

create table if not exists public.structures (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default private.my_company() references public.companies (id) on delete cascade,
  kind        text not null check (kind in ('wbs', 'obs', 'rbs', 'cbs', 'code', 'ifc', 'attrs', 'other')),
  name        text not null,
  data        jsonb not null default '{}'::jsonb,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists structures_company_idx on public.structures (company_id);
create index if not exists structures_updated_by_idx on public.structures (updated_by);

create or replace function private.structures_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.company_id := old.company_id; end if;
  return new;
end $$;
create or replace trigger structures_touch before insert or update on public.structures
  for each row execute function private.structures_touch();

alter table public.structures enable row level security;
drop policy if exists structures_read on public.structures;
create policy structures_read on public.structures for select to authenticated
  using ((select private.my_role()) <> 'pending' and company_id = (select private.my_company()));
drop policy if exists structures_write on public.structures;
drop policy if exists structures_insert on public.structures;
create policy structures_insert on public.structures for insert to authenticated
  with check (company_id = (select private.my_company()) and (select private.my_role()) = 'admin');
drop policy if exists structures_update on public.structures;
create policy structures_update on public.structures for update to authenticated
  using (company_id = (select private.my_company()) and (select private.my_role()) = 'admin')
  with check (company_id = (select private.my_company()) and (select private.my_role()) = 'admin');
drop policy if exists structures_delete on public.structures;
create policy structures_delete on public.structures for delete to authenticated
  using (company_id = (select private.my_company()) and (select private.my_role()) = 'admin');
grant select, insert, update, delete on public.structures to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.structures; exception when duplicate_object then null; end;
  end if;
end $$;

create or replace function private.audit_structures() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform private.audit('structure.created', new.company_id, new.name, jsonb_build_object('kind', new.kind)); return new;
  elsif tg_op = 'DELETE' then perform private.audit('structure.deleted', old.company_id, old.name, jsonb_build_object('kind', old.kind)); return old;
  else if new.data is distinct from old.data or new.name is distinct from old.name then perform private.audit('structure.changed', new.company_id, new.name, jsonb_build_object('kind', new.kind)); end if; return new; end if;
end $$;
create or replace trigger audit_structures after insert or update or delete on public.structures
  for each row execute function private.audit_structures();
