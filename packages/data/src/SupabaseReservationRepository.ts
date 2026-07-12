/**
 * Supabase(Postgres) 저장소 — 기존 ReservationRepository 인터페이스를 그대로 구현한다.
 * 따라서 화면 코드는 바꾸지 않고 IndexedDB 구현과 교체할 수 있다.
 *
 * 저장 형태: raw_rows(id, hotel_id, source, source_order, data jsonb)
 *  - data 는 엑셀 원본 행을 그대로 담는다(원본 충실).
 *  - 파생 통합/집계는 저장하지 않고 항상 원본에서 재계산한다.
 *
 * 멱등성: 원본 교체/추가는 서버의 트랜잭션 함수(RPC)로 처리한다.
 *  - replace_source: (호텔, 원본) 을 지우고 새로 넣는다 → 같은 파일을 두 번 올려도 중복되지 않음
 *  - append_source: 기존 최대 source_order 뒤로 이어 붙인다
 * 권한: RLS 가 hotel_id 를 강제하므로 다른 호텔 데이터는 읽지도 쓰지도 못한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { newId, type CellValue, type SourceType } from '@travel/domain';
import {
  SELECTED_DATE_KEY,
  type RawRowMap,
  type ReservationRepository,
} from './ReservationRepository';

/** DB 에 저장되는 행 모양 */
interface RawRowRecord {
  id: string;
  source_order: number;
  data: Record<string, CellValue>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 앱의 원본 행 <-> DB 레코드 변환 */
function toRecord(row: Record<string, CellValue> & { id: string; sourceOrder: number }): {
  id: string;
  sourceOrder: number;
  data: Record<string, CellValue>;
} {
  const { id, sourceOrder, ...data } = row;
  return {
    id: UUID_PATTERN.test(id) ? id : newId(),
    sourceOrder,
    data: data as Record<string, CellValue>,
  };
}

function fromRecord<S extends SourceType>(rec: RawRowRecord): RawRowMap[S] {
  return {
    ...rec.data,
    id: rec.id,
    sourceOrder: rec.source_order,
  } as unknown as RawRowMap[S];
}

export class SupabaseReservationRepository implements ReservationRepository {
  constructor(
    private readonly sb: SupabaseClient,
    private readonly hotelId: string,
  ) {}

  async listRows<S extends SourceType>(source: S): Promise<RawRowMap[S][]> {
    const { data, error } = await this.sb
      .from('raw_rows')
      .select('id, source_order, data')
      .eq('hotel_id', this.hotelId)
      .eq('source', source)
      .order('source_order', { ascending: true });

    if (error) throw new Error(`원본을 읽지 못했습니다: ${error.message}`);
    return (data ?? []).map((r) => fromRecord<S>(r as RawRowRecord));
  }

  async putRow<S extends SourceType>(source: S, row: RawRowMap[S]): Promise<void> {
    const rec = toRecord(row as never);
    const { error } = await this.sb.from('raw_rows').upsert(
      {
        id: rec.id,
        hotel_id: this.hotelId,
        source,
        source_order: rec.sourceOrder,
        data: rec.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(`행을 저장하지 못했습니다: ${error.message}`);
  }

  async deleteRow(source: SourceType, id: string): Promise<void> {
    const { error } = await this.sb
      .from('raw_rows')
      .delete()
      .eq('hotel_id', this.hotelId)
      .eq('source', source)
      .eq('id', id);
    if (error) throw new Error(`행을 삭제하지 못했습니다: ${error.message}`);
  }

  /** 원본 전체 교체 — 서버 트랜잭션(RPC)으로 원자적 처리 */
  async replaceRows<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void> {
    const payload = rows.map((r) => toRecord(r as never));
    const { error } = await this.sb.rpc('replace_source', {
      p_source: source,
      p_rows: payload,
    });
    if (error) throw new Error(`원본을 교체하지 못했습니다: ${error.message}`);
  }

  /** 원본에 추가 — 서버에서 기존 최대 순서 뒤로 이어 붙인다 */
  async appendRows<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void> {
    const payload = rows.map((r) => toRecord(r as never));
    const { error } = await this.sb.rpc('append_source', {
      p_source: source,
      p_rows: payload,
    });
    if (error) throw new Error(`원본에 추가하지 못했습니다: ${error.message}`);
  }

  async clearSource(source: SourceType): Promise<void> {
    const { error } = await this.sb
      .from('raw_rows')
      .delete()
      .eq('hotel_id', this.hotelId)
      .eq('source', source);
    if (error) throw new Error(`원본을 비우지 못했습니다: ${error.message}`);
  }

  async clearAllData(): Promise<void> {
    const { error } = await this.sb
      .from('raw_rows')
      .delete()
      .eq('hotel_id', this.hotelId);
    if (error) throw new Error(`데이터를 비우지 못했습니다: ${error.message}`);
  }

  async getSelectedDate(): Promise<string | null> {
    const { data, error } = await this.sb
      .from('app_settings')
      .select('value')
      .eq('hotel_id', this.hotelId)
      .eq('key', SELECTED_DATE_KEY)
      .maybeSingle<{ value: string | null }>();
    if (error) throw new Error(`설정을 읽지 못했습니다: ${error.message}`);
    return data?.value ?? null;
  }

  async setSelectedDate(date: string): Promise<void> {
    const { error } = await this.sb.from('app_settings').upsert(
      { hotel_id: this.hotelId, key: SELECTED_DATE_KEY, value: date },
      { onConflict: 'hotel_id,key' },
    );
    if (error) throw new Error(`설정을 저장하지 못했습니다: ${error.message}`);
  }
}
