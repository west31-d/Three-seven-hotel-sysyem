/**
 * 고객센터 저장소 팩토리. createRepository() 와 동일한 규칙:
 * Supabase 설정 + 로그인 + 호텔 배정이 모두 있으면 Supabase, 아니면 로컬(IndexedDB) 모드.
 */

import { IndexedDbSupportRepository } from './IndexedDbSupportRepository';
import { SupabaseSupportRepository } from './SupabaseSupportRepository';
import type { SupportRepository } from './SupportRepository';
import { getSupabase, getPublicSupabase, type Hotel, type Session } from './supabaseClient';

export function createSupportRepository(session: Session | null, publicHotel?: Hotel | null): SupportRepository {
  const sb = publicHotel ? getPublicSupabase() : getSupabase();
  if (sb && publicHotel) return new SupabaseSupportRepository(sb, publicHotel.id);
  if (sb && session && session.profile.hotel_id) {
    return new SupabaseSupportRepository(sb, session.profile.hotel_id);
  }
  return new IndexedDbSupportRepository();
}
