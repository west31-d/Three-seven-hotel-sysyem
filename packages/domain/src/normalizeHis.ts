/**
 * 히스 정규화 (원본 PQ_히스_정리 재현)
 *
 * 규칙:
 *  1. NO 가 채워진 행을 예약 1건(마스터)로 본다. 그 뒤에 NO 없이 이어지는 행들은
 *     같은 예약의 추가 고객명/추가 객실 정보로, 다음 마스터 행(NO 채워짐) 전까지 묶는다.
 *     빈 서식 행도 자연히 여기 포함되어 제거된다.
 *  2. 제거 열: NO, 예약번호
 *  3. 열 이름 매핑:
 *       Group Code -> 예약코드, CHK-IN -> 체크인, CHK-OUT -> 체크아웃,
 *       단체명 -> 고객명, Bed Type(+Bed Type2, 열3, 그리고 이어지는 행들 중
 *       방타입처럼 보이는 값) -> 객실타입
 *     - Bed Type2/열3 및 이어지는 행들은 원본 시트에서 일자별 재실 내역(날짜/인원수/금액)이
 *       병합 헤더로 인해 같은 열 위치에 겹쳐 들어오는 경우가 대부분이라, 숫자/날짜처럼
 *       보이는 값은 무시한다. 다만 한 예약에 서로 다른 방타입이 여러 개 잡힌 경우
 *       (예: 마스터 행 'Bed Type'='1TWN', 다음 행 'Bed Type'='1DBL')는 그 값이 방타입
 *       형태(숫자+영문)이므로 객실타입에 이어붙인다.
 *  4. DB = '히스'
 *  5. 예약상태: 마스터 행 Status 가 정확히 '캔슬' 이면 '취소', 그 외 모든 값(빈 값 포함)은 '정상'.
 *     - '캔슬 '(공백 포함), '취소' 등 정확히 '캔슬'이 아닌 값은 '정상'. 유사어를 취소로 처리하지 않는다.
 *  6. 인원은 원본 문자열 그대로 유지.
 *  7. 체크인/체크아웃은 날짜 전용 문자열로 변환.
 */

import type { BaseReservation, CellValue, RawHisRow } from './types';
import { parseDateOnly, toNullableString, isBlank } from './dateUtils';

/** '1TWN', '2DBL', 'OND' 처럼 방타입으로 보이는 문자열인지 (날짜/일련번호/금액 등 숫자만은 제외) */
function looksLikeBedType(value: CellValue): value is string {
  if (typeof value !== 'string') return false;
  return /^\d*\s*[A-Za-z]{2,}$/.test(value.trim());
}

/** Bed Type / Bed Type2 / 열3 중 방타입처럼 보이는 값만 모아 배열로 돌려준다 */
function extractBedTypes(row: RawHisRow): string[] {
  return [row['Bed Type'], row['Bed Type2'], row['열3']].filter(looksLikeBedType);
}

type BaseWithoutBedType = Omit<BaseReservation, '객실타입'>;

function buildBase(row: RawHisRow, referenceYear: number): BaseWithoutBedType {
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
    예약상태: isCancel ? '취소' : '정상',
  };
}

/** 단일 행 정규화 (NO 가 비어 있으면 null). 이어지는 행의 추가 객실 정보는 반영하지 않는다. */
export function normalizeHis(
  row: RawHisRow,
  referenceYear: number = new Date().getFullYear(),
): BaseReservation | null {
  if (isBlank(row.NO)) return null;
  const bedTypes = extractBedTypes(row);
  return { ...buildBase(row, referenceYear), 객실타입: bedTypes.length > 0 ? bedTypes.join(' + ') : null };
}

/**
 * 히스 원본 배열 -> 정규화 배열.
 * NO 가 채워진 행을 예약 1건(마스터)로 보고, 뒤이어 NO 없이 나오는 행들(추가 고객명/추가 객실
 * 정보/빈 서식 행)은 다음 마스터 행이 나오기 전까지 같은 예약으로 묶어, 그중 방타입처럼 보이는
 * 값만 객실타입에 이어붙인다.
 */
export function normalizeHisRows(
  rows: RawHisRow[],
  referenceYear: number = new Date().getFullYear(),
): BaseReservation[] {
  const out: BaseReservation[] = [];
  let current: BaseWithoutBedType | null = null;
  let bedTypes: string[] = [];

  const flush = (): void => {
    if (current) {
      out.push({ ...current, 객실타입: bedTypes.length > 0 ? bedTypes.join(' + ') : null });
    }
    current = null;
    bedTypes = [];
  };

  for (const row of rows) {
    if (!isBlank(row.NO)) {
      flush();
      current = buildBase(row, referenceYear);
      bedTypes = extractBedTypes(row);
    } else if (current) {
      bedTypes.push(...extractBedTypes(row));
    }
  }
  flush();

  return out;
}
