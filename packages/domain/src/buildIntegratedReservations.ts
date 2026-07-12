/**
 * 통합 DB 생성 + 예약코드 중복 집계
 * (원본 PQ_통합DB -> PQ_예약코드집계 -> PQ_통합DB_최종 파이프라인 재현)
 *
 * 순서:
 *  1. 정규화 결과를 히스 -> BS -> 한진 순서로 합친다(Table.Combine 순서).
 *  2. 히스의 임시 인덱스는 최종 결과에서 사용하지 않는다(정렬 안정화에만 활용).
 *  3. 모든 체크인/체크아웃을 날짜 전용 문자열로 통일(정규화 단계에서 이미 완료).
 *  4. 체크인 오름차순으로 정렬한다. 체크인이 같으면 '합치기 전 순서'(병합 인덱스)와
 *     sourceOrder 를 유지하도록 안정 정렬한다.
 *  5. DB + 예약코드 로 그룹화하여 예약건수를 세고, >1 이면 중복여부='중복', 아니면 null.
 *     이 결과를 같은 DB+예약코드 의 모든 행에 부착한다(LeftOuter 확장과 동일).
 *
 * 주의:
 *  - 같은 예약코드라도 DB 가 다르면 중복이 아니다.
 *  - 중복 행을 삭제/병합하지 않는다.
 *  - '중복예약' 개수는 그룹 수가 아니라 중복여부='중복' 인 '행'의 수다.
 */

import type {
  BaseReservation,
  NormalizedReservation,
  RawBsRow,
  RawHanjinRow,
  RawHisRow,
} from './types';
import { normalizeHisRows } from './normalizeHis';
import { normalizeBsRows } from './normalizeBs';
import { normalizeHanjinRows } from './normalizeHanjin';

/** 그룹 키 구분자 (예약코드/DB 문자열에 나타나지 않을 제어문자) */
const KEY_SEP = '\u0000';

function groupKey(hotel: string | null, db: string, code: string | null): string {
  const h = hotel === null ? '\u0001NULL' : hotel;
  return `${h}${KEY_SEP}${db}${KEY_SEP}${code === null ? '\u0001NULL' : code}`;
}

/** 파생 행의 안정 식별자 */
function derivedId(sourceType: string, sourceRowId: string): string {
  return `${sourceType}:${sourceRowId}`;
}

/** 체크인 오름차순 안정 정렬 (null 은 뒤로, 동률은 원래 순서 유지) */
function sortByCheckInStable<T extends { 체크인: string | null }>(rows: T[]): T[] {
  const decorated = rows.map((row, mergeIndex) => ({ row, mergeIndex }));
  decorated.sort((x, y) => {
    const ax = x.row.체크인;
    const ay = y.row.체크인;
    if (ax === null && ay === null) return x.mergeIndex - y.mergeIndex;
    if (ax === null) return 1;
    if (ay === null) return -1;
    if (ax < ay) return -1;
    if (ax > ay) return 1;
    return x.mergeIndex - y.mergeIndex;
  });
  return decorated.map((d) => d.row);
}

/**
 * 정규화된 BaseReservation 배열을 정렬 + 중복 집계하여 최종 통합 행으로 만든다.
 * (정규화가 이미 끝난 값에 대해 동작하므로 테스트/재사용이 쉽다.)
 *
 * hotel 을 넘기면 중복 판정이 {호텔, DB, 예약코드} 로 이루어진다.
 * 단일 호텔 데이터에 대해서는 호텔 값이 상수이므로 기존 {DB, 예약코드} 판정과 결과가 같다.
 */
export function integrateBaseReservations(
  bases: BaseReservation[],
  hotel: string | null = null,
): NormalizedReservation[] {
  // 4) 체크인 오름차순 안정 정렬 (동률이면 병합 전 순서 유지)
  const sorted = sortByCheckInStable(bases);

  // 5) 호텔 + DB + 예약코드 그룹 집계
  const counts = new Map<string, number>();
  for (const b of sorted) {
    const key = groupKey(hotel, b.DB, b.예약코드);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return sorted.map((b) => {
    const count = counts.get(groupKey(hotel, b.DB, b.예약코드)) ?? 1;
    return {
      ...b,
      id: derivedId(b.sourceType, b.sourceRowId),
      호텔: hotel,
      예약건수: count,
      중복여부: count > 1 ? '중복' : null,
    };
  });
}

/**
 * 세 원본을 받아 통합 예약 목록을 생성한다.
 * referenceYear 는 BS 의 연도 없는 MM/DD 파싱에 사용된다(기본: 현재 로컬 연도).
 * hotel 은 이 원본들이 속한 호텔(중복 판정 범위). 단일 호텔이면 생략 가능.
 */
export function buildIntegratedReservations(
  his: RawHisRow[],
  bs: RawBsRow[],
  hanjin: RawHanjinRow[],
  referenceYear: number = new Date().getFullYear(),
  hotel: string | null = null,
): NormalizedReservation[] {
  // 1) 히스 -> BS -> 한진 순서로 합친다.
  const bases: BaseReservation[] = [
    ...normalizeHisRows(his, referenceYear),
    ...normalizeBsRows(bs, referenceYear),
    ...normalizeHanjinRows(hanjin, referenceYear),
  ];
  return integrateBaseReservations(bases, hotel);
}

/** 통합 DB 서버가 받는 호텔 단위 원본 묶음 */
export interface HotelSourceData {
  /** 호텔 이름 (중복 판정 범위) */
  호텔: string;
  his: RawHisRow[];
  bs: RawBsRow[];
  hanjin: RawHanjinRow[];
}

/**
 * 여러 호텔의 원본을 하나의 통합 목록으로 만든다 (통합 DB 화면용).
 *
 * 중복은 호텔 안에서만 판정한다 — 다른 호텔의 같은 여행사 예약코드는 중복이 아니다.
 * 따라서 호텔별로 각각 통합한 뒤 합치고, 전체를 체크인 오름차순으로 다시 안정 정렬한다.
 * (호텔 하나만 넘기면 buildIntegratedReservations 와 결과가 동일하다.)
 */
export function buildIntegratedForHotels(
  hotels: HotelSourceData[],
  referenceYear: number = new Date().getFullYear(),
): NormalizedReservation[] {
  const merged: NormalizedReservation[] = [];
  for (const h of hotels) {
    merged.push(
      ...buildIntegratedReservations(h.his, h.bs, h.hanjin, referenceYear, h.호텔),
    );
  }
  return sortByCheckInStable(merged);
}
