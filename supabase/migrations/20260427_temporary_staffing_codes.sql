alter table public.profiles
  add column if not exists has_temporary_staffing_code boolean not null default false;

create index if not exists profiles_temporary_staffing_code_idx
  on public.profiles (has_temporary_staffing_code, created_at)
  where role = 'mch';
