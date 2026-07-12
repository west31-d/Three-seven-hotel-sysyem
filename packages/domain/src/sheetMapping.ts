/**
 * 셀 행렬 -> 원본 행 매핑 (순수 함수).
 *
 * SheetJS 등으로 만들어진 셀 행렬(any[][])과 원본 사양(SourceSpec)을 받아:
 *   - 헤더 행을 이름으로 탐지 (nbsp/공백 정규화)
 *   - 열 -> 필드 매핑
 *   - 빈 서식 행 제외
 *   - 날짜/기간 파싱 실패를 행 번호와 함께 오류로 수집
 * 를 수행한다. 매크로는 실행하지 않고 값만 사용한다.
 */

import type { CellValue } from './types';
import {
  normalizeHeader,
  parseDateResult,
  isBlank,
} from './dateUtils';
import { newId } from './id';
import {
  type ColumnSpec,
  type ImportError,
  type ImportResult,
  type SourceSpec,
  isRowEmpty,
} from './importTypes';

/** 셀 행렬 타입 */
export type CellMatrix = CellValue[][];

interface HeaderMatch {
  headerRowIndex: number; // 0-based, 행렬 기준
  /** 필드명 -> 열 인덱스 */
  fieldToCol: Map<string, number>;
  missingRequired: string[];
}

/** 헤더 비교 키: nbsp/공백 정규화 + 대소문자 무시 */
function headerKey(value: string): string {
  return normalizeHeader(value).toLocaleLowerCase();
}

/** 사양의 헤더/별칭들을 정규화하여 어떤 필드에 매핑되는지 룩업 테이블 생성 */
function buildHeaderLookup(spec: SourceSpec): Map<string, ColumnSpec> {
  const lookup = new Map<string, ColumnSpec>();
  for (const col of spec.columns) {
    lookup.set(headerKey(col.header), col);
    for (const alias of col.aliases ?? []) {
      lookup.set(headerKey(alias), col);
    }
  }
  return lookup;
}

/** 이 셀 행렬이 해당 사양의 시트인지 (헤더 내용으로 판별) */
export function sheetMatchesSpec(matrix: CellMatrix, spec: SourceSpec): boolean {
  return detectHeaderRow(matrix, spec) !== null;
}

/** 헤더 행 탐지: 식별(identify) 헤더를 모두 포함하는 첫 행을 찾는다. */
export function detectHeaderRow(
  matrix: CellMatrix,
  spec: SourceSpec,
): HeaderMatch | null {
  const lookup = buildHeaderLookup(spec);
  const identifyFields = spec.columns
    .filter((c) => c.identify)
    .map((c) => c.field);

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const fieldToCol = new Map<string, number>();
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== 'string') continue;
      const norm = headerKey(cell);
      if (norm.length === 0) continue;
      const col = lookup.get(norm);
      if (col && !fieldToCol.has(col.field)) {
        fieldToCol.set(col.field, c);
      }
    }
    const foundIdentify = identifyFields.filter((f) => fieldToCol.has(f));
    // 식별 헤더가 모두 있으면 헤더 행으로 확정
    if (foundIdentify.length === identifyFields.length) {
      const missingRequired = identifyFields.filter((f) => !fieldToCol.has(f));
      return { headerRowIndex: r, fieldToCol, missingRequired };
    }
  }
  return null;
}

/**
 * 셀 행렬을 원본 행으로 매핑.
 * @param matrix 셀 행렬
 * @param spec 원본 사양
 * @param referenceYear BS MM/DD 파싱용 기준 연도
 * @param rowOffset 원본 파일 기준 행 번호 보정(미리보기 표시용, 기본 0 -> 행렬 인덱스+1)
 */
export function mapMatrixToRows<Row extends { id: string; sourceOrder: number }>(
  matrix: CellMatrix,
  spec: SourceSpec,
  referenceYear: number,
  rowOffset = 0,
): ImportResult<Row> {
  const errors: ImportError[] = [];
  const header = detectHeaderRow(matrix, spec);

  if (!header) {
    const required = spec.columns.filter((c) => c.identify).map((c) => c.header);
    errors.push({
      row: null,
      message: `필수 헤더를 찾지 못했습니다. 필요한 헤더: ${required.join(', ')}`,
    });
    return { source: spec.source, rows: [], errors, headerFailed: true };
  }

  if (header.missingRequired.length > 0) {
    errors.push({
      row: header.headerRowIndex + 1 + rowOffset,
      message: `필수 헤더 누락: ${header.missingRequired.join(', ')}`,
    });
  }

  const rows: Row[] = [];
  let order = 0;

  for (let r = header.headerRowIndex + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? [];
    const values: Record<string, CellValue> = {};
    for (const col of spec.columns) {
      const c = header.fieldToCol.get(col.field);
      const cell = c === undefined ? null : (raw[c] ?? null);
      // 빈 값(빈 문자열/공백만)은 null 로 보존한다.
      values[col.field] =
        cell === undefined || cell === null
          ? null
          : typeof cell === 'string' && cell.trim() === ''
            ? null
            : cell;
    }

    // 빈 서식 행은 데이터로 만들지 않는다.
    if (isRowEmpty(values)) continue;

    const fileRowNumber = r + 1 + rowOffset;

    // 날짜/기간 유효성 검사 (빈 값은 허용, 비어있지 않은 파싱 실패만 오류)
    for (const col of spec.columns) {
      if (col.date) {
        const res = parseDateResult(values[col.field], referenceYear);
        if (res.kind === 'invalid') {
          errors.push({
            row: fileRowNumber,
            field: col.header,
            message: `날짜 파싱 실패: '${res.raw}'`,
          });
        } else if (res.kind === 'ok') {
          // 엑셀 일련번호(예: 46203)나 날짜형 문자열을 'YYYY-MM-DD' 로 정규화하여
          // 원본 화면/편집/CSV 에서 실제 날짜로 표시되게 한다. (빈 값은 그대로 null)
          values[col.field] = res.value;
        }
      } else if (col.period) {
        validatePeriod(
          values[col.field],
          col,
          referenceYear,
          fileRowNumber,
          errors,
        );
      }
    }

    const row = {
      ...values,
      id: newId(spec.source.toLowerCase()),
      sourceOrder: order,
    } as unknown as Row;
    rows.push(row);
    order += 1;
  }

  return { source: spec.source, rows, errors, headerFailed: false };
}

/** 기간 문자열의 양쪽 날짜 유효성 검사 */
function validatePeriod(
  value: CellValue,
  col: ColumnSpec,
  referenceYear: number,
  fileRowNumber: number,
  errors: ImportError[],
): void {
  if (isBlank(value)) return;
  const text = String(value);
  const parts =
    col.period === 'hanjin' ? text.split(/\s*~\s*/) : text.split('~');
  const left = (parts[0] ?? '').trim();
  const right = (parts[1] ?? '').trim();
  for (const part of [left, right]) {
    if (part.length === 0) continue;
    const res = parseDateResult(part, referenceYear);
    if (res.kind === 'invalid') {
      errors.push({
        row: fileRowNumber,
        field: col.header,
        message: `기간 날짜 파싱 실패: '${part}'`,
      });
    }
  }
  // 구분자가 없어 한쪽만 파싱된 경우 경고성 오류(치명적 아님)
  if (right.length === 0 && left.length > 0 && !text.includes('~')) {
    errors.push({
      row: fileRowNumber,
      field: col.header,
      message: `기간 구분자('~')를 찾지 못했습니다: '${text}'`,
    });
  }
}
