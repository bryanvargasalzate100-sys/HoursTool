create or replace function public.set_profile_computed_fields()
returns trigger
language plpgsql
as $$
begin
  new.first_name = trim(new.first_name);
  new.last_name = trim(new.last_name);
  new.full_name = trim(new.last_name || ' ' || new.first_name);
  new.email = lower(trim(new.email::text))::citext;
  new.login_name = lower(trim(new.email::text));
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

update public.profiles
set login_name = lower(trim(email::text)),
    updated_at = timezone('utc', now());
