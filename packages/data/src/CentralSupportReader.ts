/**
 * 고객센터 기록을 모든 호텔에서 읽어오는 central 앱 전용 리더 (읽기 전용).
 * 본사 계정만 읽을 수 있다(RLS 가 강제한다). 쓰기는 각 호텔에서만 가능하다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingTableError } from './postgrestErrors';
import type { TicketStatus } from './SupportRepository';
import type { Hotel } from './supabaseClient';

export interface CentralSupportTicket {
  id: string;
  hotel: string;
  title: string;
  content: string;
  status: TicketStatus;
  reporter: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketRecord {
  id: string;
  hotel_id: string;
  title: string;
  content: string;
  status: string;
  reporter: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

/** 모든 호텔의 고객센터 기록을 최신순으로 읽는다. */
export async function loadCentralSupportTickets(
  sb: SupabaseClient,
  hotels: Hotel[],
): Promise<CentralSupportTicket[]> {
  const { data, error } = await sb
    .from('support_tickets')
    .select('id, hotel_id, title, content, status, reporter, image, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(`고객센터 기록을 읽지 못했습니다: ${error.message}`);
  }

  const hotelById = new Map(hotels.map((h) => [h.id, h.name]));
  return (data ?? []).map((r) => {
    const rec = r as TicketRecord;
    return {
      id: rec.id,
      hotel: hotelById.get(rec.hotel_id) ?? '알 수 없음',
      title: rec.title,
      content: rec.content,
      status: rec.status as TicketStatus,
      reporter: rec.reporter,
      image: rec.image,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
    };
  });
}
