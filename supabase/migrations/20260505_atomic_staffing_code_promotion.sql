create or replace function public.promote_temporary_profile_staffing_code(
  p_profile_id uuid,
  p_pool_row_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staffing_code text;
begin
  select staffing_code
  into v_staffing_code
  from public.staffing_id_pool
  where id = p_pool_row_id
    and is_assigned = false
  for update;

  if v_staffing_code is null then
    raise exception 'The selected staffing code is no longer available.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and role = 'mch'
      and has_temporary_staffing_code = true
  ) then
    raise exception 'This profile is no longer eligible for promotion.';
  end if;

  update public.profiles
  set
    staffing_code = v_staffing_code,
    has_temporary_staffing_code = false
  where id = p_profile_id
    and role = 'mch'
    and has_temporary_staffing_code = true;

  if not found then
    raise exception 'The profile could not be updated.';
  end if;

  update public.staffing_id_pool
  set
    is_assigned = true,
    assigned_profile_id = p_profile_id
  where id = p_pool_row_id
    and is_assigned = false;

  if not found then
    raise exception 'The staffing code could not be reserved.';
  end if;
end;
$$;

revoke all on function public.promote_temporary_profile_staffing_code(uuid, uuid) from public;
grant execute on function public.promote_temporary_profile_staffing_code(uuid, uuid) to service_role;
