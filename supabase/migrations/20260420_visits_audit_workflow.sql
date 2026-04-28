do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'visit_status'
  ) then
    create type public.visit_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

alter table public.visits
  add column if not exists status public.visit_status not null default 'pending',
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_by uuid references public.profiles (id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

create index if not exists visits_status_date_idx
  on public.visits (status, visit_date desc, mch_profile_id);

create index if not exists visits_pending_date_idx
  on public.visits (visit_date desc, mch_profile_id)
  where status = 'pending';
