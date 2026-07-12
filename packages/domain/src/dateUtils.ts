/**
 * 날짜 및 값 정규화 유틸리티 (순수 함수)
 *
 * 핵심 원칙:
 * - 저장/비교에는 항상 'YYYY-MM-DD' 로컬 캘린더 문자열을 사용하여
 *   시간대(UTC↔local) 이동으로 날짜가 하루 밀리는 문제를 원천 차단한다.
 * - Excel serial 은 Excel 1900 date system(1900 윤년 버그 포함) 기준으로 변환한다.
 * - 유효하지 않은 날짜를 임의로 보정하지 않는다. 파싱 실패는 null 로 돌려주고,
 *   import 계층이 행 번호와 함께 오류로 표시하도록 한다.
 */

import type { CellValue } from './types';

/** 두 자리 0 패딩 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 값이 비어 있는지(null/undefined/공백 문자열) */
export function isBlank(value: CellValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

/**
 * 값을 문자열 또는 null 로 변환한다(내용은 트림하지 않음 — 고객명 등 원문 보존).
 * 빈 문자열은 null 로 취급한다.
 */
export function toNullableString(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length === 0 ? null : value;
  if (value instanceof Date) return formatDateOnly(value);
  return String(value);
}

/** 트림 후 빈 값이면 null, 아니면 트림된 문자열 (예약코드 등 키 정규화용) */
export function trimToNull(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

/**
 * 헤더 문자열 정규화: non-breaking space(U+00A0)를 일반 공백으로 바꾸고 트림한다.
 * '요청 사항' 과 '요청\u00A0사항' 을 같은 헤더로 인식하기 위함.
 */
export function normalizeHeader(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 값 비교용 정규화: nbsp -> 공백 후 트림. (예: 요청 사항 값 비교)
 * 문자열이 아니면 String() 후 처리.
 */
export function normalizeHeaderValue(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value).replace(/\u00A0/g, ' ').trim();
}

/** JS Date -> 'YYYY-MM-DD' (UTC 구성요소 기준: Excel serial 변환 결과 및 UTC-자정 Date 와 호환) */
export function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Excel serial(1900 date system) -> 'YYYY-MM-DD'.
 * epoch 를 1899-12-30 로 잡으면 1900 윤년 버그가 자동 보정된다.
 */
export function excelSerialToDateOnly(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  // 정수 일수만 사용(시간 분수는 날짜에 영향 없음)
  const whole = Math.floor(serial);
  const ms = Date.UTC(1899, 11, 30) + whole * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateOnly(d);
}

/** 'YYYY-M-D' 3요소를 유효성 검사 후 정규 문자열로. 유효하지 않으면 null(자동 보정하지 않음) */
function buildDateOnly(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  // 실제 달력상 유효한 날짜인지 확인 (예: 2/30 거부). 자동 보정하지 않고 거부만 한다.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * 공통 날짜 파서.
 *
 * 허용 입력:
 * - JS Date
 * - Excel serial (number)
 * - 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD'
 * - 'YYYY-MM-DD HH:MM:SS' (ISO 유사) — 날짜 부분만 사용
 * - 'MM/DD' (연도 없음) — referenceYear 를 적용
 *
 * 반환: 'YYYY-MM-DD' 문자열, 또는 파싱 불가/빈 값이면 null.
 * (빈 값과 유효하지 않은 값을 구분해야 하는 import 검증은 parseDateResult 를 사용)
 */
export function parseDateOnly(
  value: CellValue | undefined,
  referenceYear: number = new Date().getFullYear(),
): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatDateOnly(value);
  }

  if (typeof value === 'number') {
    return excelSerialToDateOnly(value);
  }

  if (typeof value === 'boolean') return null;

  const raw = value.trim();
  if (raw.length === 0) return null;

  // 날짜 부분만 취함 (공백/ T 로 시간 분리)
  const datePart = raw.split(/[ T]/)[0];

  // YYYY[-/.]MM[-/.]DD
  let m = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    return buildDateOnly(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // MM[-/.]DD  (연도 없음) -> referenceYear 적용
  m = datePart.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    return buildDateOnly(referenceYear, Number(m[1]), Number(m[2]));
  }

  // 숫자만 있는 문자열은 Excel serial 로 간주
  if (/^\d+$/.test(datePart)) {
    return excelSerialToDateOnly(Number(datePart));
  }

  return null;
}

/** parseDateOnly 결과를 빈 값/유효/무효로 구분 (import 검증용) */
export type DateParseResult =
  | { kind: 'empty' }
  | { kind: 'ok'; value: string }
  | { kind: 'invalid'; raw: string };

export function parseDateResult(
  value: CellValue | undefined,
  referenceYear: number = new Date().getFullYear(),
): DateParseResult {
  if (isBlank(value)) return { kind: 'empty' };
  const parsed = parseDateOnly(value, referenceYear);
  if (parsed === null) {
    return { kind: 'invalid', raw: String(value) };
  }
  return { kind: 'ok', value: parsed };
}

/**
 * BS 의 `기간` 문자열을 '~' 기준으로 분리하여 [체크인, 체크아웃] 반환.
 * 연도가 없는 MM/DD 는 referenceYear 를 양쪽에 적용한다.
 * 체크아웃이 체크인보다 앞서더라도 자동으로 다음 해로 보정하지 않는다.
 */
export function parseBsPeriod(
  value: CellValue | undefined,
  referenceYear: number,
): [string | null, string | null] {
  if (isBlank(value)) return [null, null];
  const parts = String(value).split('~');
  const left = parts[0]?.trim() ?? '';
  const right = parts[1]?.trim() ?? '';
  const checkIn = left ? parseDateOnly(left, referenceYear) : null;
  const checkOut = right ? parseDateOnly(right, referenceYear) : null;
  return [checkIn, checkOut];
}

/**
 * 한진의 `Period` 문자열을 ' ~ ' 구분자로 분리하여 [체크인, 체크아웃] 반환.
 * 주변 공백이 달라도 인식하되(결과 동일), 우선 ' ~ ' 의미를 사용한다.
 */
export function parseHanjinPeriod(
  value: CellValue | undefined,
  referenceYear: number = new Date().getFullYear(),
): [string | null, string | null] {
  if (isBlank(value)) return [null, null];
  const parts = String(value).split(/\s*~\s*/);
  const left = parts[0]?.trim() ?? '';
  const right = parts[1]?.trim() ?? '';
  const checkIn = left ? parseDateOnly(left, referenceYear) : null;
  const checkOut = right ? parseDateOnly(right, referenceYear) : null;
  return [checkIn, checkOut];
}

/**
 * 두 날짜(문자열)가 같은 로컬 캘린더 날짜인지.
 * 모든 값이 이미 'YYYY-MM-DD' 로 저장되므로 문자열 동등 비교로 충분하다.
 * 한쪽이라도 null 이면 false.
 */
export function sameDate(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return a === b;
}

/** 오늘(로컬) 날짜를 'YYYY-MM-DD' 로 */
export function todayDateOnly(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 'YYYY-MM-DD' 에 days(±) 를 더한 로컬 날짜 문자열 (시간대 무관) */
export function addDaysDateOnly(dateStr: string, days: number): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}
