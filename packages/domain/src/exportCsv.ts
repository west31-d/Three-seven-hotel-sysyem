/**
 * CSV 내보내기.
 * - 원본 데이터(현재 화면) 및 통합 DB 를 CSV 로 내보낸다.
 * - 빈 값은 빈 칸으로 둔다(임의 문자열로 채우지 않음).
 */

import type { CellValue, NormalizedReservation, SourceType } from './types';
import { SPECS } from './importTypes';

/** 값 하나를 CSV 필드로 escape */
function csvField(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 행렬을 CSV 문자열로 (BOM 포함하여 Excel 한글 호환) */
export function toCsv(headers: string[], rows: CellValue[][]): string {
  const lines = [headers.map(csvField).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvField).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** 원본 행 배열을 CSV 로 (사양의 헤더 순서 사용, id/sourceOrder 제외) */
export function rawRowsToCsv(
  source: SourceType,
  rows: Array<Record<string, CellValue>>,
): string {
  const spec = SPECS[source];
  const headers = spec.columns.map((c) => c.header);
  const matrix = rows.map((r) => spec.columns.map((c) => r[c.field] ?? null));
  return toCsv(headers, matrix);
}

/** 통합 DB 열 순서 */
export const INTEGRATED_HEADERS = [
  '호텔',
  'DB',
  '예약코드',
  '체크인',
  '체크아웃',
  '고객명',
  '인원',
  '객실타입',
  '예약상태',
  '예약건수',
  '중복여부',
] as const;

/** 통합 예약 배열을 CSV 로 */
export function integratedToCsv(rows: NormalizedReservation[]): string {
  const matrix: CellValue[][] = rows.map((r) => [
    r.호텔,
    r.DB,
    r.예약코드,
    r.체크인,
    r.체크아웃,
    r.고객명,
    r.인원,
    r.객실타입,
    r.예약상태,
    r.예약건수,
    r.중복여부,
  ]);
  return toCsv([...INTEGRATED_HEADERS], matrix);
}

/** 브라우저에서 CSV 파일 다운로드 트리거 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
