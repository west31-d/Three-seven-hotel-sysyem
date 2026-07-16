/**
 * @travel/data — 저장소 계층.
 *
 * 화면은 ReservationRepository 인터페이스만 사용한다.
 * 구현은 Supabase(공유 DB) 또는 IndexedDB(로컬 모드) 두 가지이며,
 * createRepository() 가 환경/로그인 상태에 따라 골라 준다.
 */

export * from './ReservationRepository';
export * from './database';
export * from './IndexedDbReservationRepository';
export * from './SupabaseReservationRepository';
export * from './CentralReader';
export * from './createRepository';
export * from './refreshService';
export * from './supabaseClient';
export * from './SupportRepository';
export * from './IndexedDbSupportRepository';
export * from './SupabaseSupportRepository';
export * from './createSupportRepository';
export * from './CentralSupportReader';
