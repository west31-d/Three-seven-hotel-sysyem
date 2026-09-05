-- Existing database migration: anonymous shared reservation editing.
-- Run the entire file in Supabase SQL Editor. Existing reservation data is preserved.
-- Everyone can read, insert, update and delete business data after this migration.
-- Authentication users/profiles are not made public.
begin;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.hotels, public.raw_rows,
  public.app_settings, public.checked_reservations, public.support_tickets
  to anon, authenticated;

-- Remove the existing business-data policies, including custom hotel restrictions.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('hotels', 'raw_rows', 'app_settings', 'checked_reservations', 'support_tickets')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

alter table public.hotels disable row level security;
alter table public.raw_rows disable row level security;
alter table public.app_settings disable row level security;
alter table public.checked_reservations disable row level security;
alter table public.support_tickets disable row level security;

-- Remove the previous functions that required an authenticated hotel profile.
drop function if exists public.replace_source(text, jsonb);
drop function if exists public.append_source(text, jsonb);

create or replace function public.replace_source(p_source text, p_rows jsonb, p_hotel_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_source is null or p_source not in ('HIS', 'BS', 'HANJIN') then
    raise exception 'Invalid reservation source';
  end if;
  -- Serialize bulk operations for this hotel, including append_source.
  perform 1 from hotels where id = p_hotel_id for update;
  if not found then raise exception 'Hotel not found'; end if;
  delete from raw_rows where hotel_id = p_hotel_id and source = p_source;
  insert into raw_rows (id, hotel_id, source, source_order, data)
  select (r->>'id')::uuid, p_hotel_id, p_source, (r->>'sourceOrder')::int, r->'data'
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
end;
$$;

create or replace function public.append_source(p_source text, p_rows jsonb, p_hotel_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare base integer;
begin
  if p_source is null or p_source not in ('HIS', 'BS', 'HANJIN') then
    raise exception 'Invalid reservation source';
  end if;
  perform 1 from hotels where id = p_hotel_id for update;
  if not found then raise exception 'Hotel not found'; end if;
  select coalesce(max(source_order), -1) + 1 into base
    from raw_rows where hotel_id = p_hotel_id and source = p_source;
  insert into raw_rows (id, hotel_id, source, source_order, data)
  select (r->>'id')::uuid, p_hotel_id, p_source, base + (r->>'sourceOrder')::int, r->'data'
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
end;
$$;

grant execute on function public.replace_source(text, jsonb, uuid) to anon, authenticated;
grant execute on function public.append_source(text, jsonb, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
