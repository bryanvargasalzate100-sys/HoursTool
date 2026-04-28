alter table public.agencies
  add column if not exists charge numeric(5, 2) not null default 0;

alter table public.agencies
  add constraint agencies_charge_range
  check (charge >= 0 and charge <= 100);

alter table public.stores
  add column if not exists customer text not null default '';

alter table public.stores
  alter column code drop not null;

alter table public.stores
  alter column agency_id drop not null;

update public.stores
set customer = coalesce(nullif(trim(customer), ''), 'Default Customer')
where customer is null or trim(customer) = '';

drop index if exists public.stores_code_unique_idx;

create unique index if not exists stores_name_unique_idx on public.stores (lower(name));
