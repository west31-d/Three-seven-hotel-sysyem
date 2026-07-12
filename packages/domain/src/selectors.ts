/**
 * 대시보드 파생값 계산 (순수 함수)
 *
 * 조회일을 selectedDate('YYYY-MM-DD')라 한다.
 *
 * 중요한 비대칭 규칙(원본 업무 규칙 그대로 유지):
 *  - 체크인 KPI/명단: 취소 예약도 '포함'한다.
 *  - 체크아웃 KPI: 취소 예약도 '포함'한다.
 *  - 체크아웃 명단: 예약상태가 '정확히' 취소인 행만 '제외'한다(다른 텍스트 상태는 포함).
 */

import type { NormalizedReservation, SearchResult } from './types';
import { sameDate } from './dateUtils';

/* -------------------------- KPI -------------------------- */

/** 오늘(=조회일) 체크인 수 — 취소 포함 */
export function countCheckIn(
  rows: NormalizedReservation[],
  selectedDate: string,
): number {
  return rows.filter((r) => sameDate(r.체크인, selectedDate)).length;
}

/** 오늘(=조회일) 체크아웃 수 — 취소 포함 (명단과 다르므로 반드시 유지) */
export function countCheckOut(
  rows: NormalizedReservation[],
  selectedDate: string,
): number {
  return rows.filter((r) => sameDate(r.체크아웃, selectedDate)).length;
}

/** 전체 예약 수 */
export function countTotal(rows: NormalizedReservation[]): number {
  return rows.length;
}

/** 중복 예약 수 — 중복여부='중복' 인 '행'의 개수(그룹 수 아님) */
export function countDuplicate(rows: NormalizedReservation[]): number {
  return rows.filter((r) => r.중복여부 === '중복').length;
}

/* -------------------------- 명단 -------------------------- */

/** 조회일 체크인 명단 — 취소 제외하지 않음 */
export function checkInList(
  rows: NormalizedReservation[],
  selectedDate: string,
): NormalizedReservation[] {
  return rows.filter((r) => sameDate(r.체크인, selectedDate));
}

/** 조회일 체크아웃 명단 — 예약상태가 정확히 '취소'인 행만 제외 */
export function checkOutList(
  rows: NormalizedReservation[],
  selectedDate: string,
): NormalizedReservation[] {
  return rows.filter(
    (r) => sameDate(r.체크아웃, selectedDate) && r.예약상태 !== '취소',
  );
}

/* -------------------------- 검색 -------------------------- */

/**
 * 검색 (예약코드/고객명 대상, 부분 문자열, 대소문자 무시, 앞뒤 공백 제거).
 * - 검색어가 비어 있으면 EMPTY_QUERY.
 * - 취소 여부와 관계없이 통합 DB 전체에서 검색.
 * - 결과는 입력 배열의 현재 정렬 순서를 유지.
 */
export function searchReservations(
  rows: NormalizedReservation[],
  keyword: string,
): SearchResult {
  const q = keyword.trim().toLocaleLowerCase();
  if (q.length === 0) return { state: 'EMPTY_QUERY', rows: [] };

  const matched = rows.filter((row) => {
    const code = (row.예약코드 ?? '').toLocaleLowerCase();
    const name = (row.고객명 ?? '').toLocaleLowerCase();
    return code.includes(q) || name.includes(q);
  });

  return matched.length > 0
    ? { state: 'RESULT', rows: matched }
    : { state: 'NO_RESULT', rows: [] };
}

/* ---------------------- 통합 DB 필터 ---------------------- */

export interface IntegratedFilter {
  /** 호텔 필터 (통합 DB 화면 전용) */
  호텔?: string | null;
  db?: string | null;
  예약상태?: string | null;
  체크인From?: string | null;
  체크인To?: string | null;
  체크아웃From?: string | null;
  체크아웃To?: string | null;
  keyword?: string;
  중복만?: boolean;
}

/** 통합 DB 화면용 표시 필터 — 원본 데이터/집계값은 바꾸지 않고 표시만 거른다. */
export function filterIntegrated(
  rows: NormalizedReservation[],
  f: IntegratedFilter,
): NormalizedReservation[] {
  const q = (f.keyword ?? '').trim().toLocaleLowerCase();
  return rows.filter((r) => {
    if (f.호텔 && r.호텔 !== f.호텔) return false;
    if (f.db && r.DB !== f.db) return false;
    if (f.예약상태 && r.예약상태 !== f.예약상태) return false;
    if (f.중복만 && r.중복여부 !== '중복') return false;
    if (f.체크인From && (r.체크인 === null || r.체크인 < f.체크인From)) return false;
    if (f.체크인To && (r.체크인 === null || r.체크인 > f.체크인To)) return false;
    if (f.체크아웃From && (r.체크아웃 === null || r.체크아웃 < f.체크아웃From))
      return false;
    if (f.체크아웃To && (r.체크아웃 === null || r.체크아웃 > f.체크아웃To))
      return false;
    if (q) {
      const code = (r.예약코드 ?? '').toLocaleLowerCase();
      const name = (r.고객명 ?? '').toLocaleLowerCase();
      if (!code.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });
}

export type SortDirection = 'asc' | 'desc';
export type IntegratedSortKey =
  | '호텔'
  | 'DB'
  | '예약코드'
  | '체크인'
  | '체크아웃'
  | '고객명'
  | '인원'
  | '객실타입'
  | '예약상태'
  | '예약건수'
  | '중복여부';

/** 통합 DB 표시 정렬 (안정 정렬, 표시 전용) */
export function sortIntegrated(
  rows: NormalizedReservation[],
  key: IntegratedSortKey,
  dir: SortDirection,
): NormalizedReservation[] {
  const factor = dir === 'asc' ? 1 : -1;
  const decorated = rows.map((r, i) => ({ r, i }));
  decorated.sort((a, b) => {
    const va = a.r[key];
    const vb = b.r[key];
    let cmp: number;
    if (va === null && vb === null) cmp = 0;
    else if (va === null) cmp = 1; // null 은 항상 뒤로
    else if (vb === null) cmp = -1;
    else if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb));
    if (cmp !== 0) return cmp * factor;
    return a.i - b.i; // 안정성
  });
  return decorated.map((d) => d.r);
}
