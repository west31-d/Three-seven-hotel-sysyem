/**
 * 저장소 팩토리.
 *
 * - Supabase 가 설정되어 있고 로그인되어 있으면 → SupabaseReservationRepository (공유 DB)
 * - 아니면 → IndexedDbReservationRepository (로컬 모드, 브라우저에만 저장)
 *
 * 로컬 모드를 남겨 둔 이유: Supabase 설정 전에도 `npm run dev` 로 바로 실행해 볼 수 있고,
 * 인터넷이 끊긴 곳에서도 데모/연습이 가능하기 때문이다.
 */

import { IndexedDbReservationRepository } from './IndexedDbReservationRepository';
import { SupabaseReservationRepository } from './SupabaseReservationRepository';
import type { ReservationRepository } from './ReservationRepository';
import { getSupabase, getPublicSupabase, type Hotel, type Session } from './supabaseClient';

export type StorageMode = 'supabase' | 'local';

export interface RepositoryHandle {
  repo: ReservationRepository;
  mode: StorageMode;
  /** 중복 판정 범위가 되는 호텔 이름 (로컬 모드면 null) */
  hotel: string | null;
}

/**
 * 세션에 맞는 저장소를 만든다.
 * session 이 null 이거나 Supabase 미설정이면 로컬 모드.
 */
export function createRepository(session: Session | null, publicHotel?: Hotel | null): RepositoryHandle {
  const sb = publicHotel ? getPublicSupabase() : getSupabase();

  if (sb && publicHotel) {
    return { repo: new SupabaseReservationRepository(sb, publicHotel.id), mode: 'supabase', hotel: publicHotel.name };
  }

  if (sb && session && session.profile.hotel_id && session.hotel) {
    return {
      repo: new SupabaseReservationRepository(sb, session.profile.hotel_id),
      mode: 'supabase',
      hotel: session.hotel.name,
    };
  }

  return {
    repo: new IndexedDbReservationRepository(),
    mode: 'local',
    hotel: null,
  };
}
