/**
 * BS 정규화 (원본 PQ_BS_정리 재현)
 *
 * 규칙:
 *  1. `기간` 문자열을 '~' 기준으로 분리, 왼쪽=체크인, 오른쪽=체크아웃, 각 트림.
 *  2. 연도가 없는 MM/DD 는 새로고침/import 시점의 로컬 연도(referenceYear)를 양쪽에 적용.
 *     - 예) referenceYear=2026, '06/30~07/02' -> '2026-06-30', '2026-07-02'
 *     - 체크아웃 월/일이 체크인보다 작아도 다음 해로 자동 보정하지 않는다.
 *  3. 이름 매핑: 단체번호 -> 예약코드, 대표명 -> 고객명, 인원수 -> 인원, 룸타입 -> 객실타입
 *  4. 제거 열: 호텔, 박수, 전달사항
 *  5. 예약상태: `요청 사항` 이 정확히 '캔슬요청' 이면 '취소', 그 외 모든 값은 '정상'.
 *  6. 예약코드가 null / 빈 값 / 정확히 '*' 인 행은 제거.
 *  7. DB = 'BS'
 */

import type { BaseReservation, RawBsRow } from './types';
import { parseBsPeriod, toNullableString, trimToNull } from './dateUtils';

export function normalizeBs(
  row: RawBsRow,
  referenceYear: number = new Date().getFullYear(),
): BaseReservation | null {
  // 규칙 6: 예약코드(단체번호) 필터
  const code = trimToNull(row['단체번호']);
  if (code === null || code === '*') return null;

  const [checkIn, checkOut] = parseBsPeriod(row['기간'], referenceYear);

  const req = row['요청 사항'];
  const isCancel = req !== null && req !== undefined && String(req) === '캔슬요청';

  return {
    sourceType: 'BS',
    sourceRowId: row.id,
    sourceOrder: row.sourceOrder,
    DB: 'BS',
    예약코드: code,
    체크인: checkIn,
    체크아웃: checkOut,
    고객명: toNullableString(row['대표명']),
    인원: toNullableString(row['인원수']),
    객실타입: toNullableString(row['룸타입']),
    예약상태: isCancel ? '취소' : '정상',
  };
}

/** BS 원본 배열 -> 정규화 배열 (null 제거) */
export function normalizeBsRows(
  rows: RawBsRow[],
  referenceYear?: number,
): BaseReservation[] {
  const out: BaseReservation[] = [];
  for (const row of rows) {
    const n = normalizeBs(row, referenceYear);
    if (n) out.push(n);
  }
  return out;
}
