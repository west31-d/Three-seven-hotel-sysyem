/**
 * 히스 정규화 (원본 PQ_히스_정리 재현)
 *
 * 규칙:
 *  1. NO 가 null/빈 값인 행 제거 (예약의 추가 고객명만 있는 연속 행 및 빈 서식 행 제거).
 *  2. 제거 열: NO, Bed Type2, 열3, 예약번호
 *  3. 열 이름 매핑:
 *       Group Code -> 예약코드, CHK-IN -> 체크인, CHK-OUT -> 체크아웃,
 *       단체명 -> 고객명, Bed Type -> 객실타입
 *  4. DB = '히스'
 *  5. 예약상태: Status 가 정확히 '캔슬' 이면 '취소', 그 외 모든 값(빈 값 포함)은 '정상'.
 *     - '캔슬 '(공백 포함), '취소' 등 정확히 '캔슬'이 아닌 값은 '정상'. 유사어를 취소로 처리하지 않는다.
 *  6. 인원은 원본 문자열 그대로 유지.
 *  7. 체크인/체크아웃은 날짜 전용 문자열로 변환.
 */

import type { BaseReservation, RawHisRow } from './types';
import { parseDateOnly, toNullableString, isBlank } from './dateUtils';

export function normalizeHis(
  row: RawHisRow,
  referenceYear: number = new Date().getFullYear(),
): BaseReservation | null {
  // 규칙 1: NO 가 비어 있으면 제외
  if (isBlank(row.NO)) return null;

  const status = row.Status;
  const isCancel = status !== null && status !== undefined && String(status) === '캔슬';

  return {
    sourceType: 'HIS',
    sourceRowId: row.id,
    sourceOrder: row.sourceOrder,
    DB: '히스',
    예약코드: toNullableString(row['Group Code']),
    체크인: parseDateOnly(row['CHK-IN'], referenceYear),
    체크아웃: parseDateOnly(row['CHK-OUT'], referenceYear),
    고객명: toNullableString(row['단체명']),
    인원: toNullableString(row['인원']),
    객실타입: toNullableString(row['Bed Type']),
    예약상태: isCancel ? '취소' : '정상',
  };
}

/** 히스 원본 배열 -> 정규화 배열 (null 제거) */
export function normalizeHisRows(
  rows: RawHisRow[],
  referenceYear?: number,
): BaseReservation[] {
  const out: BaseReservation[] = [];
  for (const row of rows) {
    const n = normalizeHis(row, referenceYear);
    if (n) out.push(n);
  }
  return out;
}
