-- =====================================================================
-- 통합 DB 서버 스키마 (Supabase / Postgres)
--
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행하세요.
--
-- 설계 요약
--  * 원본(raw_rows)만 저장한다. 통합/중복 등 파생값은 저장하지 않고 앱이 항상 재계산한다.
--  * 호텔 사이트는 자기 호텔 데이터만 읽고 쓸 수 있다 (RLS 로 강제).
--  * 본사(is_central) 계정은 모든 호텔을 '읽기만' 할 수 있다.
--  * 원본 교체/추가는 트랜잭션 함수로 처리 → 같은 파일을 두 번 올려도 중복이 생기지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------- 테이블

create table if not exists hotels (
  id   uuid primary key default gen_random_uuid(),
  code text unique not null,           -- 예: 'THREE_SEVEN'
  name text not null                   -- 예: '쓰리세븐호텔'
);

-- 로그인 사용자 ↔ 호텔 매핑. is_central = 본사(통합 화면) 계정
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hotel_id   uuid references hotels(id) on delete set null,
  is_central boolean not null default false
);

-- 엑셀 원본 행을 그대로 보관 (source = 여행사)
create table if not exists raw_rows (
  id           uuid primary key,
  hotel_id     uuid not null references hotels(id) on delete cascade,
  source       text not null check (source in ('HIS', 'BS', 'HANJIN')),
  source_order integer not null,
  data         jsonb not null,
  updated_at   timestamptz not null default now()
);

create index if not exists raw_rows_hotel_source_order_idx
  on raw_rows (hotel_id, source, source_order);

-- 호텔별 앱 설정(조회일 등)
create table if not exists app_settings (
  hotel_id uuid not null references hotels(id) on delete cascade,
  key      text not null,
  value    text,
  primary key (hotel_id, key)
);

-- 통합 DB 화면에서 수동으로 확인 체크한 예약(NormalizedReservation.id 는 uuid 가 아니므로 text).
-- 존재하면 확인됨, 없으면 미확인.
create table if not exists checked_reservations (
  hotel_id   uuid not null references hotels(id) on delete cascade,
  id         text not null,
  checked_at timestamptz not null default now(),
  primary key (hotel_id, id)
);

-- 고객센터(오류/문의) 기록. 호텔은 자기 것만 쓰고, 본사는 전체를 읽기 전용으로 본다.
create table if not exists support_tickets (
  id         uuid primary key,
  hotel_id   uuid not null references hotels(id) on delete cascade,
  title      text not null,
  content    text not null,
  status     text not null default '미해결' check (status in ('미해결', '해결됨')),
  reporter   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_hotel_created_idx
  on support_tickets (hotel_id, created_at desc);

-- ---------------------------------------------------------------- 헬퍼 함수
-- 정책 안에서 profiles 를 조회하므로 security definer 로 두어 재귀/권한 문제를 피한다.

create or replace function current_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hotel_id from profiles where user_id = auth.uid();
$$;

create or replace function is_central()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_central from profiles where user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------- RLS

alter table hotels               enable row level security;
alter table profiles             enable row level security;
alter table raw_rows             enable row level security;
alter table app_settings         enable row level security;
alter table checked_reservations enable row level security;
alter table support_tickets      enable row level security;

drop policy if exists hotels_select on hotels;
create policy hotels_select on hotels
  for select using (is_central() or id = current_hotel_id());

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (user_id = auth.uid());

-- 원본: 본사는 전체 읽기, 호텔은 자기 것만 읽기/쓰기
drop policy if exists raw_rows_select on raw_rows;
create policy raw_rows_select on raw_rows
  for select using (is_central() or hotel_id = current_hotel_id());

drop policy if exists raw_rows_insert on raw_rows;
create policy raw_rows_insert on raw_rows
  for insert with check (hotel_id = current_hotel_id());

drop policy if exists raw_rows_update on raw_rows;
create policy raw_rows_update on raw_rows
  for update using (hotel_id = current_hotel_id())
          with check (hotel_id = current_hotel_id());

drop policy if exists raw_rows_delete on raw_rows;
create policy raw_rows_delete on raw_rows
  for delete using (hotel_id = current_hotel_id());

-- 설정: 자기 호텔만
drop policy if exists app_settings_all on app_settings;
create policy app_settings_all on app_settings
  for all using (hotel_id = current_hotel_id())
          with check (hotel_id = current_hotel_id());

-- 확인 여부: 본사는 전체 읽기, 호텔은 자기 것만 읽기/쓰기
drop policy if exists checked_reservations_select on checked_reservations;
create policy checked_reservations_select on checked_reservations
  for select using (is_central() or hotel_id = current_hotel_id());

drop policy if exists checked_reservations_write on checked_reservations;
create policy checked_reservations_write on checked_reservations
  for all using (hotel_id = current_hotel_id())
          with check (hotel_id = current_hotel_id());

-- 고객센터: 본사는 전체 읽기, 호텔은 자기 것만 읽기/쓰기/삭제/상태변경
drop policy if exists support_tickets_select on support_tickets;
create policy support_tickets_select on support_tickets
  for select using (is_central() or hotel_id = current_hotel_id());

drop policy if exists support_tickets_write on support_tickets;
create policy support_tickets_write on support_tickets
  for all using (hotel_id = current_hotel_id())
          with check (hotel_id = current_hotel_id());

-- 이 프로젝트는 public 스키마 신규 테이블에 대한 기본 권한(default privileges)이
-- authenticated 롤까지 자동으로 내려오지 않는 것으로 보여 명시적으로 부여한다.
grant select, insert, update, delete on table checked_reservations to authenticated;
grant select, insert, update, delete on table support_tickets to authenticated;

-- ---------------------------------------------------------------- 트랜잭션 함수
-- 앱이 보내는 p_rows 형태: [{ "id": uuid, "sourceOrder": 0, "data": { ...원본 행... } }, ...]

-- 원본 전체 교체 (같은 파일을 두 번 올려도 중복이 생기지 않는다)
create or replace function replace_source(p_source text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h uuid;
begin
  if p_source not in ('HIS', 'BS', 'HANJIN') then
    raise exception '알 수 없는 원본: %', p_source;
  end if;

  h := current_hotel_id();
  if h is null then
    raise exception '호텔 계정이 아닙니다 (본사 계정은 조회 전용입니다)';
  end if;

  delete from raw_rows where hotel_id = h and source = p_source;

  insert into raw_rows (id, hotel_id, source, source_order, data)
  select (r->>'id')::uuid, h, p_source, (r->>'sourceOrder')::int, r->'data'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r;
end;
$$;

-- 원본에 이어 붙이기 (기존 최대 순서 뒤로)
create or replace function append_source(p_source text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h    uuid;
  base integer;
begin
  if p_source not in ('HIS', 'BS', 'HANJIN') then
    raise exception '알 수 없는 원본: %', p_source;
  end if;

  h := current_hotel_id();
  if h is null then
    raise exception '호텔 계정이 아닙니다 (본사 계정은 조회 전용입니다)';
  end if;

  select coalesce(max(source_order), -1) + 1
    into base
    from raw_rows
   where hotel_id = h and source = p_source;

  insert into raw_rows (id, hotel_id, source, source_order, data)
  select (r->>'id')::uuid,
         h,
         p_source,
         base + (r->>'sourceOrder')::int,
         r->'data'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r;
end;
$$;

-- =====================================================================
-- 초기 데이터 (호텔 등록)
-- =====================================================================
insert into hotels (code, name)
values ('THREE_SEVEN', '쓰리세븐호텔')
on conflict (code) do nothing;

-- =====================================================================
-- 계정 만들기 (Supabase 대시보드 > Authentication > Users > Add user 로 먼저 생성한 뒤,
-- 아래 SQL 로 프로필을 연결하세요.)
--
-- 1) 호텔 담당자 계정
--   insert into profiles (user_id, hotel_id, is_central)
--   select u.id, h.id, false
--   from auth.users u, hotels h
--   where u.email = 'hotel@example.com' and h.code = 'THREE_SEVEN'
--   on conflict (user_id) do update
--     set hotel_id = excluded.hotel_id, is_central = excluded.is_central;
--
-- 2) 본사(통합 화면) 계정 — 모든 호텔 조회 전용
--   insert into profiles (user_id, hotel_id, is_central)
--   select u.id, null, true
--   from auth.users u
--   where u.email = 'central@example.com'
--   on conflict (user_id) do update
--     set hotel_id = excluded.hotel_id, is_central = excluded.is_central;
-- =====================================================================
