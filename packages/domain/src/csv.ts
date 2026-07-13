/** CSV/TSV 파싱 (xlsx 비의존, 순수 함수) */

import type { CellValue } from './types';
import type { CellMatrix } from './sheetMapping';

/** 구분자 자동 감지 (탭이 있으면 TSV, 아니면 CSV) */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  if (firstLine.includes('\t')) return '\t';
  return ',';
}

/**
 * 탭도 콤마도 없이 공백 여러 개로 열을 맞춘 텍스트인지 확인한다.
 * (웹페이지 표를 복사하면 탭 대신 정렬용 공백으로 붙여넣기되는 경우가 있다.)
 */
function looksSpaceAligned(firstLine: string): boolean {
  return !firstLine.includes('\t') && !firstLine.includes(',') && / {2,}/.test(firstLine);
}

/** 정렬용 공백(2칸 이상) 구간을 탭으로 치환해 TSV처럼 파싱할 수 있게 만든다. */
function convertSpaceAlignedToTabs(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/ {2,}/g, '\t'))
    .join('\n');
}

/**
 * 구분자 텍스트(CSV/TSV) -> 셀 행렬.
 * 따옴표로 감싼 필드 및 이스케이프("")를 처리하고, 빈 필드는 null 로 만든다.
 */
export function parseDelimited(text: string, delimiter?: string): CellMatrix {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const source = !delimiter && looksSpaceAligned(firstLine) ? convertSpaceAlignedToTabs(text) : text;
  const delim = delimiter ?? detectDelimiter(source);
  const rows: CellValue[][] = [];
  let field = '';
  let row: CellValue[] = [];
  let inQuotes = false;
  let i = 0;
  const n = source.length;
  const pushField = (): void => {
    row.push(field.length === 0 ? null : field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < n) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delim) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      pushRow();
      if (source[i + 1] === '\n') i += 2;
      else i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  return rows;
}
