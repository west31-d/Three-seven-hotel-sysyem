/** 표시용 포매팅 헬퍼 */

import type { CellValue } from './types';

/** 빈 값은 '-' 로 표시 (임의 문자열로 채우지 않음) */
export function dash(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' && value.length === 0) return '-';
  return String(value);
}

/** 날짜 문자열 표시 (이미 YYYY-MM-DD). null 이면 '-' */
export function fmtDate(value: string | null): string {
  return value ?? '-';
}
