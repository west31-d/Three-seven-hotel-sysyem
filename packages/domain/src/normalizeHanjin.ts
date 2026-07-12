/**
 * 한진 정규화 (원본 PQ_한진_정리 재현)
 *
 * 규칙:
 *  1. `Period` 를 ' ~ ' 구분자로 분리(주변 공백 변동 허용), 왼쪽=체크인, 오른쪽=체크아웃.
 *  2. Tour-No 가 null/빈 값인 행 제거 (추가 고객명만 있는 연속 행 제거).
 *  3. 이름 매핑: Tour-No -> 예약코드, Room -> 객실타입, Name -> 고객명
 *  4. Nights 제거
 *  5. 인원 = null
 *  6. DB = '한진'
 *  7. 예약상태: Remark 를 '비고원본'으로 두고,
 *       null / 빈 문자열 / 공백만 있는 문자열이면 '정상',
 *       그렇지 않으면 Remark 를 문자열로 변환한 값을 '그대로'(트림하지 않음) 예약상태로 사용.
 *     - 즉, 비어 있지 않은 모든 Remark 를 무조건 '취소'로 바꾸지 않는다.
 */

import type { BaseReservation, RawHanjinRow } from './types';
import { parseHanjinPeriod, toNullableString, trimToNull } from './dateUtils';

export function normalizeHanjin(
  row: RawHanjinRow,
  referenceYear: number = new Date().getFullYear(),
): BaseReservation | null {
  // 규칙 2: Tour-No 필터
  const code = trimToNull(row['Tour-No']);
  if (code === null) return null;

  const [checkIn, checkOut] = parseHanjinPeriod(row.Period, referenceYear);

  // 규칙 7: Remark -> 예약상태
  const remarkStr =
    row.Remark === null || row.Remark === undefined ? null : String(row.Remark);
  const 예약상태 =
    remarkStr === null || remarkStr.trim() === '' ? '정상' : remarkStr;

  return {
    sourceType: 'HANJIN',
    sourceRowId: row.id,
    sourceOrder: row.sourceOrder,
    DB: '한진',
    예약코드: code,
    체크인: checkIn,
    체크아웃: checkOut,
    고객명: toNullableString(row.Name),
    인원: null,
    객실타입: toNullableString(row.Room),
    예약상태,
  };
}

/** 한진 원본 배열 -> 정규화 배열 (null 제거) */
export function normalizeHanjinRows(
  rows: RawHanjinRow[],
  referenceYear?: number,
): BaseReservation[] {
  const out: BaseReservation[] = [];
  for (const row of rows) {
    const n = normalizeHanjin(row, referenceYear);
    if (n) out.push(n);
  }
  return out;
}
