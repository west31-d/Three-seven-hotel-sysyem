/**
 * Supabase(Postgres) 기반 SupportRepository 구현.
 * 저장 형태: support_tickets(id, hotel_id, title, content, status, reporter, created_at, updated_at)
 * 권한: RLS 가 hotel_id 를 강제하므로 다른 호텔의 기록은 읽지도 쓰지도 못한다(본사는 읽기만 가능).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { newId } from '@travel/domain';
import { isMissingTableError } from './postgrestErrors';
import type { SupportRepository, SupportTicket, TicketStatus } from './SupportRepository';

interface TicketRecord {
  id: string;
  title: string;
  content: string;
  status: string;
  reporter: string | null;
  created_at: string;
  updated_at: string;
}

const MISSING_TABLE_MESSAGE =
  "고객센터 기능이 아직 설정되지 않았습니다. 관리자가 Supabase 에 'support_tickets' 테이블을 추가해야 합니다.";

function fromRecord(rec: TicketRecord): SupportTicket {
  return {
    id: rec.id,
    title: rec.title,
    content: rec.content,
    status: rec.status as TicketStatus,
    reporter: rec.reporter,
    createdAt: rec.created_at,
    updatedAt: rec.updated_at,
  };
}

export class SupabaseSupportRepository implements SupportRepository {
  constructor(
    private readonly sb: SupabaseClient,
    private readonly hotelId: string,
  ) {}

  async listTickets(): Promise<SupportTicket[]> {
    const { data, error } = await this.sb
      .from('support_tickets')
      .select('id, title, content, status, reporter, created_at, updated_at')
      .eq('hotel_id', this.hotelId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingTableError(error)) {
        // eslint-disable-next-line no-console
        console.warn(
          "'support_tickets' 테이블이 아직 없습니다. supabase/schema.sql 을 실행하면 고객센터 기능이 활성화됩니다.",
        );
        return [];
      }
      throw new Error(`고객센터 기록을 읽지 못했습니다: ${error.message}`);
    }
    return (data ?? []).map((r) => fromRecord(r as TicketRecord));
  }

  async createTicket(input: {
    title: string;
    content: string;
    reporter: string | null;
  }): Promise<void> {
    const { error } = await this.sb.from('support_tickets').insert({
      id: newId(),
      hotel_id: this.hotelId,
      title: input.title,
      content: input.content,
      status: '미해결',
      reporter: input.reporter,
    });
    if (error) {
      throw new Error(
        isMissingTableError(error)
          ? MISSING_TABLE_MESSAGE
          : `고객센터 기록을 저장하지 못했습니다: ${error.message}`,
      );
    }
  }

  async setTicketStatus(id: string, status: TicketStatus): Promise<void> {
    const { error } = await this.sb
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('hotel_id', this.hotelId)
      .eq('id', id);
    if (error) {
      throw new Error(
        isMissingTableError(error)
          ? MISSING_TABLE_MESSAGE
          : `상태를 변경하지 못했습니다: ${error.message}`,
      );
    }
  }

  async deleteTicket(id: string): Promise<void> {
    const { error } = await this.sb
      .from('support_tickets')
      .delete()
      .eq('hotel_id', this.hotelId)
      .eq('id', id);
    if (error) {
      throw new Error(
        isMissingTableError(error)
          ? MISSING_TABLE_MESSAGE
          : `기록을 삭제하지 못했습니다: ${error.message}`,
      );
    }
  }
}
