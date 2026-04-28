alter table public.profiles
  drop constraint if exists profiles_mch_requires_staffing_code;

alter table public.profiles
  add constraint profiles_staff_role_has_no_staffing_code
  check (
    (role = 'staff' and staffing_code is null)
    or role = 'mch'
  );
