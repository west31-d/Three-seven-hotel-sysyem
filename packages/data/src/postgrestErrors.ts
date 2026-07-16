/**
 * PostgREST(Supabase) 오류 판별 유틸.
 *
 * 새 테이블을 추가한 뒤 supabase/schema.sql 을 아직 실행하지 않은 경우 등,
 * '테이블이 없음'은 부가 기능이 앱 전체를 멈추게 하면 안 되는 흔한 상황이라 따로 뺀다.
 */
export function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    (error.message ?? '').includes('Could not find the table')
  );
}
