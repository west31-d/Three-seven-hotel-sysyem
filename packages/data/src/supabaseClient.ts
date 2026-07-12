/**
 * Supabase 클라이언트.
 *
 * 환경변수가 없으면 null 을 돌려준다 → 앱은 '로컬 모드'(IndexedDB)로 동작한다.
 * 덕분에 Supabase 를 설정하기 전에도 `npm run dev` 로 바로 실행해 볼 수 있다.
 *
 * 필요한 환경변수 (.env):
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** 호텔 (통합 DB 서버의 hotels 테이블) */
export interface Hotel {
  id: string;
  code: string;
  name: string;
}

/** 로그인 사용자 프로필 (어느 호텔 소속인지 / 본사인지) */
export interface Profile {
  user_id: string;
  hotel_id: string | null;
  is_central: boolean;
}

/** 현재 로그인 상태 */
export interface Session {
  email: string;
  profile: Profile;
  hotel: Hotel | null;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase 가 설정되어 있는가 (아니면 로컬 모드) */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** 설정되어 있으면 Supabase 클라이언트, 아니면 null */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** 현재 로그인 사용자의 프로필 + 호텔을 읽는다 (로그인 안 되어 있으면 null) */
export async function loadSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('user_id, hotel_id, is_central')
    .eq('user_id', user.id)
    .maybeSingle<Profile>();

  if (pErr) throw new Error(`프로필을 읽지 못했습니다: ${pErr.message}`);
  if (!profile) {
    throw new Error(
      '이 계정에 연결된 프로필이 없습니다. 관리자에게 호텔 배정을 요청하세요.',
    );
  }

  let hotel: Hotel | null = null;
  if (profile.hotel_id) {
    const { data: h, error: hErr } = await sb
      .from('hotels')
      .select('id, code, name')
      .eq('id', profile.hotel_id)
      .maybeSingle<Hotel>();
    if (hErr) throw new Error(`호텔 정보를 읽지 못했습니다: ${hErr.message}`);
    hotel = h ?? null;
  }

  return { email: user.email ?? '', profile, hotel };
}

/** 이메일 + 비밀번호 로그인 */
export async function signIn(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 가 설정되어 있지 않습니다.');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`로그인 실패: ${error.message}`);
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
