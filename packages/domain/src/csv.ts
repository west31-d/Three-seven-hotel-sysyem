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
 * 구분자 텍스트(CSV/TSV) -> 셀 행렬.
 * 따옴표로 감싼 필드 및 이스케이프("")를 처리하고, 빈 필드는 null 로 만든다.
 */
export function parseDelimited(text: string, delimiter?: string): CellMatrix {
  const delim = delimiter ?? detectDelimiter(text);
  const rows: CellValue[][] = [];
  let field = '';
  let row: CellValue[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;
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
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
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
      if (text[i + 1] === '\n') i += 2;
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
