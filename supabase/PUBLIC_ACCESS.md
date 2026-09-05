# 로그인 없는 공유 예약 DB

호텔 사이트는 Supabase 익명 클라이언트로 호텔 코드 `THREE_SEVEN`을 조회하고 해당 호텔의 공유 예약·확인 상태·설정·고객센터를 읽고 수정합니다. 로그인 화면과 로그아웃 버튼은 없습니다. 이전 로그인 세션도 사용하지 않습니다.

## 기존 서버 적용

1. Supabase 프로젝트의 SQL Editor에서 [public-access.sql](./public-access.sql) 전체를 실행합니다. 이 파일은 기존 데이터가 있는 서버용이며 원본 예약을 삭제하지 않습니다.
2. Cloudflare 빌드 환경의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 설정합니다. 공개 anon 키 또는 publishable 키를 사용하며 service-role 키는 넣지 않습니다.
3. 호텔 코드가 `THREE_SEVEN`과 다르면 `VITE_PUBLIC_HOTEL_CODE`를 설정합니다.
4. `npm run build:hotel`로 빌드한 `apps/hotel/dist`를 배포합니다. 환경변수를 변경했다면 다시 빌드해야 합니다.
5. 로그인하지 않은 브라우저 두 개에서 동일 예약을 조회하고, 한쪽에서 추가·수정한 뒤 다른 쪽에서 새로고침해 확인합니다. CSV/Excel 교체·추가, 확인 체크, 고객센터도 확인합니다.

Supabase 설정이 전혀 없으면 기존 로컬 모드로 실행됩니다. 서버 설정이 있는데 호텔 조회가 실패하면 오류를 표시하고 로컬로 자동 전환하지 않습니다. 브라우저에만 저장된 기존 예약은 서버로 자동 이전되지 않습니다.

## 적용 범위

`hotels`, `raw_rows`, `app_settings`, `checked_reservations`, `support_tickets`는 모든 방문자가 조회·추가·수정·삭제할 수 있습니다. 원본 교체·추가 함수는 로그인 프로필 대신 명시적인 호텔 ID를 받습니다. SQL 적용과 새 앱 배포를 함께 진행해야 하며 기존 배포본의 두 인자 RPC는 더 이상 사용할 수 없습니다.

인증 사용자와 profiles 데이터는 공개하지 않습니다. 별도 본사 앱의 인증 화면은 유지됩니다. PMS HTML에 내장된 이전 예약 앱은 별도 복사본이므로 이 소스 변경으로 자동 갱신되지 않습니다.

신규 DB는 `schema.sql`을 사용합니다. 기존 DB에 오래된 schema.sql을 다시 적용하면 로그인 권한이 복원될 수 있으므로 현재 버전의 파일을 사용하세요.
