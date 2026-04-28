create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'app_role'
  ) then
    create type public.app_role as enum ('staff', 'mch');
  end if;
end $$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'user_metadata' ->> 'role')
  )::public.app_role
$$;

create or replace function public.set_profile_computed_fields()
returns trigger
language plpgsql
as $$
begin
  new.first_name = trim(new.first_name);
  new.last_name = trim(new.last_name);
  new.full_name = trim(new.last_name || ' ' || new.first_name);
  new.login_name =
    lower(regexp_replace(new.last_name, '[^a-zA-Z0-9]', '', 'g')) ||
    lower(regexp_replace(new.first_name, '[^a-zA-Z0-9]', '', 'g'));
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.protect_mch_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.id and public.current_app_role() = 'mch' then
    if new.role is distinct from old.role then
      raise exception 'Role cannot be changed by MCH';
    end if;

    if new.staffing_code is distinct from old.staffing_code then
      raise exception 'Staffing code cannot be changed by MCH';
    end if;

    if new.hourly_rate is distinct from old.hourly_rate then
      raise exception 'Hourly rate cannot be changed by MCH';
    end if;

    if new.agency_id is distinct from old.agency_id then
      raise exception 'Agency cannot be changed by MCH';
    end if;

    if new.default_store_id is distinct from old.default_store_id then
      raise exception 'Default store cannot be changed by MCH';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'Creator cannot be changed by MCH';
    end if;
  end if;

  return new;
end;
$$;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists agencies_name_unique_idx on public.agencies (lower(name));
create unique index if not exists agencies_code_unique_idx on public.agencies (lower(code));

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies (id) on delete set null,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists stores_name_unique_idx on public.stores (lower(name));
create unique index if not exists stores_code_unique_idx on public.stores (lower(code));
create index if not exists stores_agency_id_idx on public.stores (agency_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  staffing_code text unique,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  login_name text not null,
  phone_number text,
  email citext not null unique,
  agency_id uuid references public.agencies (id) on delete set null,
  default_store_id uuid references public.stores (id) on delete set null,
  hourly_rate numeric(10, 2),
  must_reset_password boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_mch_requires_staffing_code
    check (
      (role = 'staff' and staffing_code is null)
      or (role = 'mch' and staffing_code is not null)
    ),
  constraint profiles_hourly_rate_non_negative
    check (hourly_rate is null or hourly_rate >= 0)
);

create unique index if not exists profiles_login_name_unique_idx on public.profiles (login_name);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_agency_id_idx on public.profiles (agency_id);
create index if not exists profiles_default_store_id_idx on public.profiles (default_store_id);

create table if not exists public.staffing_id_pool (
  id uuid primary key default gen_random_uuid(),
  staffing_code text not null unique,
  is_assigned boolean not null default false,
  assigned_profile_id uuid references public.profiles (id) on delete set null,
  source_file_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint staffing_id_pool_assignment_consistency
    check (
      (is_assigned = false and assigned_profile_id is null)
      or (is_assigned = true and assigned_profile_id is not null)
    )
);

create index if not exists staffing_id_pool_available_idx
  on public.staffing_id_pool (staffing_code)
  where is_assigned = false;

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  mch_profile_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  visit_date date not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint visits_checkout_after_checkin
    check (check_out_at > check_in_at)
);

create index if not exists visits_profile_date_idx
  on public.visits (mch_profile_id, visit_date desc);

create index if not exists visits_store_date_idx
  on public.visits (store_id, visit_date desc);

create or replace view public.staff_export_users as
select
  p.staffing_code as id,
  p.first_name,
  p.last_name,
  p.phone_number,
  p.email,
  s.name as store,
  p.hourly_rate as rate,
  a.name as agency,
  p.login_name
from public.profiles p
left join public.stores s on s.id = p.default_store_id
left join public.agencies a on a.id = p.agency_id
where p.role = 'mch';

drop trigger if exists profiles_set_computed_fields on public.profiles;
create trigger profiles_set_computed_fields
before insert or update on public.profiles
for each row
execute function public.set_profile_computed_fields();

drop trigger if exists profiles_protect_mch_fields on public.profiles;
create trigger profiles_protect_mch_fields
before update on public.profiles
for each row
execute function public.protect_mch_profile_fields();

drop trigger if exists agencies_set_updated_at on public.agencies;
create trigger agencies_set_updated_at
before update on public.agencies
for each row
execute function public.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row
execute function public.set_updated_at();

drop trigger if exists staffing_id_pool_set_updated_at on public.staffing_id_pool;
create trigger staffing_id_pool_set_updated_at
before update on public.staffing_id_pool
for each row
execute function public.set_updated_at();

drop trigger if exists visits_set_updated_at on public.visits;
create trigger visits_set_updated_at
before update on public.visits
for each row
execute function public.set_updated_at();

alter table public.agencies enable row level security;
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.staffing_id_pool enable row level security;
alter table public.visits enable row level security;

alter table public.agencies force row level security;
alter table public.stores force row level security;
alter table public.profiles force row level security;
alter table public.staffing_id_pool force row level security;
alter table public.visits force row level security;

drop policy if exists "agencies_read_authenticated" on public.agencies;
create policy "agencies_read_authenticated"
on public.agencies
for select
to authenticated
using (true);

drop policy if exists "agencies_write_staff" on public.agencies;
create policy "agencies_write_staff"
on public.agencies
for all
to authenticated
using (public.current_app_role() = 'staff')
with check (public.current_app_role() = 'staff');

drop policy if exists "stores_read_authenticated" on public.stores;
create policy "stores_read_authenticated"
on public.stores
for select
to authenticated
using (true);

drop policy if exists "stores_write_staff" on public.stores;
create policy "stores_write_staff"
on public.stores
for all
to authenticated
using (public.current_app_role() = 'staff')
with check (public.current_app_role() = 'staff');

drop policy if exists "profiles_read_self_or_staff" on public.profiles;
create policy "profiles_read_self_or_staff"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() = 'staff'
);

drop policy if exists "profiles_insert_staff_only" on public.profiles;
create policy "profiles_insert_staff_only"
on public.profiles
for insert
to authenticated
with check (public.current_app_role() = 'staff');

drop policy if exists "profiles_update_self_or_staff" on public.profiles;
create policy "profiles_update_self_or_staff"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() = 'staff'
)
with check (
  id = auth.uid()
  or public.current_app_role() = 'staff'
);

drop policy if exists "staffing_id_pool_read_staff_only" on public.staffing_id_pool;
create policy "staffing_id_pool_read_staff_only"
on public.staffing_id_pool
for select
to authenticated
using (public.current_app_role() = 'staff');

drop policy if exists "staffing_id_pool_write_staff_only" on public.staffing_id_pool;
create policy "staffing_id_pool_write_staff_only"
on public.staffing_id_pool
for all
to authenticated
using (public.current_app_role() = 'staff')
with check (public.current_app_role() = 'staff');

drop policy if exists "visits_read_own_or_staff" on public.visits;
create policy "visits_read_own_or_staff"
on public.visits
for select
to authenticated
using (
  mch_profile_id = auth.uid()
  or public.current_app_role() = 'staff'
);

drop policy if exists "visits_insert_mch_only" on public.visits;
create policy "visits_insert_mch_only"
on public.visits
for insert
to authenticated
with check (
  public.current_app_role() = 'mch'
  and mch_profile_id = auth.uid()
);

drop policy if exists "visits_update_own_or_staff" on public.visits;
create policy "visits_update_own_or_staff"
on public.visits
for update
to authenticated
using (
  mch_profile_id = auth.uid()
  or public.current_app_role() = 'staff'
)
with check (
  mch_profile_id = auth.uid()
  or public.current_app_role() = 'staff'
);
