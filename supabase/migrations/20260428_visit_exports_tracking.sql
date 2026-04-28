alter table public.visits
  add column if not exists exported_at timestamptz,
  add column if not exists exported_by uuid references public.profiles (id) on delete set null;

create index if not exists visits_approved_unexported_idx
  on public.visits (visit_date desc, mch_profile_id)
  where status = 'approved' and exported_at is null;
