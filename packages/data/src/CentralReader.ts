/**
 * 통합 DB 화면용 리더 (읽기 전용).
 *
 * 모든 호텔의 원본을 읽어 호텔별로 통합한 뒤 하나의 목록으로 합친다.
 * 중복은 호텔 안에서만 판정된다 — 다른 호텔의 같은 여행사 예약코드는 중복이 아니다.
 * (본사 계정만 읽을 수 있다. RLS 가 강제한다.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildIntegratedForHotels,
  type CellValue,
  type HotelSourceData,
  type NormalizedReservation,
  type RawBsRow,
  type RawHanjinRow,
  type RawHisRow,
  type SourceType,
} from '@travel/domain';
import type { Hotel } from './supabaseClient';

interface RawRowRecord {
  id: string;
  hotel_id: string;
  source: SourceType;
  source_order: number;
  data: Record<string, CellValue>;
}

export interface CentralSnapshot {
  hotels: Hotel[];
  reservations: NormalizedReservation[];
  /** 호텔별 원본 행 수 (진단용) */
  rawRowCount: number;
}

/** 원본 레코드를 앱의 원본 행으로 되돌린다 */
function toRow<T>(rec: RawRowRecord): T {
  return {
    ...rec.data,
    id: rec.id,
    sourceOrder: rec.source_order,
  } as unknown as T;
}

/**
 * 모든 호텔의 원본을 읽어 통합 예약을 계산한다.
 * @param referenceYear BS 의 연도 없는 MM/DD 파싱 기준 연도
 */
export async function loadCentralSnapshot(
  sb: SupabaseClient,
  referenceYear: number = new Date().getFullYear(),
): Promise<CentralSnapshot> {
  const { data: hotelRows, error: hErr } = await sb
    .from('hotels')
    .select('id, code, name')
    .order('name', { ascending: true });
  if (hErr) throw new Error(`호텔 목록을 읽지 못했습니다: ${hErr.message}`);
  const hotels = (hotelRows ?? []) as Hotel[];

  const { data: rawRows, error: rErr } = await sb
    .from('raw_rows')
    .select('id, hotel_id, source, source_order, data')
    .order('source_order', { ascending: true });
  if (rErr) throw new Error(`원본을 읽지 못했습니다: ${rErr.message}`);

  const records = (rawRows ?? []) as RawRowRecord[];

  // 호텔별로 원본 3종을 모은다 (원본 순서 유지)
  const byHotel = new Map<string, HotelSourceData>();
  for (const h of hotels) {
    byHotel.set(h.id, { 호텔: h.name, his: [], bs: [], hanjin: [] });
  }
  for (const rec of records) {
    const bucket = byHotel.get(rec.hotel_id);
    if (!bucket) continue; // 알 수 없는 호텔은 건너뛴다
    if (rec.source === 'HIS') bucket.his.push(toRow<RawHisRow>(rec));
    else if (rec.source === 'BS') bucket.bs.push(toRow<RawBsRow>(rec));
    else if (rec.source === 'HANJIN') bucket.hanjin.push(toRow<RawHanjinRow>(rec));
  }

  const reservations = buildIntegratedForHotels(
    Array.from(byHotel.values()),
    referenceYear,
  );

  return { hotels, reservations, rawRowCount: records.length };
}
