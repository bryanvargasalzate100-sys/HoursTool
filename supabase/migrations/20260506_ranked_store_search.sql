create or replace function public.search_store_options(
  search_query text default '',
  max_results integer default 50
)
returns table (
  id uuid,
  name text,
  customer text
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      trim(coalesce(search_query, '')) as raw_query,
      lower(regexp_replace(trim(coalesce(search_query, '')), '[^[:alnum:]]+', '', 'g')) as normalized_query,
      greatest(1, least(coalesce(max_results, 50), 100)) as safe_limit
  ),
  tokens as (
    select distinct token_parts.match[1] as token
    from params
    cross join lateral regexp_matches(lower(params.raw_query), '([[:alpha:]]+|[[:digit:]]+)', 'g') as token_parts(match)
    where token_parts.match[1] <> ''
  ),
  token_count as (
    select count(*)::integer as value from tokens
  ),
  scored_stores as (
    select
      stores.id,
      stores.name,
      stores.customer,
      lower(regexp_replace(coalesce(stores.name, ''), '[^[:alnum:]]+', '', 'g')) as normalized_name,
      lower(regexp_replace(coalesce(stores.customer, ''), '[^[:alnum:]]+', '', 'g')) as normalized_customer,
      lower(regexp_replace(coalesce(stores.code, ''), '[^[:alnum:]]+', '', 'g')) as normalized_code
    from public.stores
    where stores.is_active = true
  ),
  ranked_stores as (
    select
      scored_stores.id,
      scored_stores.name,
      scored_stores.customer,
      (
        select count(*)::integer
        from tokens
        where
          scored_stores.normalized_name like '%' || tokens.token || '%'
          or scored_stores.normalized_customer like '%' || tokens.token || '%'
          or scored_stores.normalized_code like '%' || tokens.token || '%'
      ) as token_matches,
      case
        when params.normalized_query <> ''
          and scored_stores.normalized_name like '%' || params.normalized_query || '%'
        then 1
        else 0
      end as name_phrase_match,
      case
        when params.normalized_query <> ''
          and scored_stores.normalized_customer like '%' || params.normalized_query || '%'
        then 1
        else 0
      end as customer_phrase_match,
      case
        when params.normalized_query <> ''
          and scored_stores.normalized_code like '%' || params.normalized_query || '%'
        then 1
        else 0
      end as code_phrase_match,
      case
        when params.normalized_query <> ''
          and (
            scored_stores.normalized_name like params.normalized_query || '%'
            or scored_stores.normalized_code like params.normalized_query || '%'
          )
        then 1
        else 0
      end as starts_with_query
    from scored_stores
    cross join params
  )
  select
    ranked_stores.id,
    ranked_stores.name,
    ranked_stores.customer
  from ranked_stores
  cross join params
  cross join token_count
  where
    params.raw_query = ''
    or ranked_stores.name_phrase_match = 1
    or ranked_stores.customer_phrase_match = 1
    or ranked_stores.code_phrase_match = 1
    or ranked_stores.token_matches > 0
  order by
    case
      when params.raw_query = '' then 0
      else
        ranked_stores.name_phrase_match * 500
        + ranked_stores.code_phrase_match * 450
        + ranked_stores.customer_phrase_match * 300
        + case
            when token_count.value > 0 and ranked_stores.token_matches = token_count.value then 250
            else 0
          end
        + ranked_stores.starts_with_query * 125
        + ranked_stores.token_matches * 50
    end desc,
    ranked_stores.name asc
  limit (select safe_limit from params);
$$;

grant execute on function public.search_store_options(text, integer) to authenticated;
