/**
 * 엑셀 통합문서 import (xlsx 라이브러리 필요) — 호텔 앱 전용.
 *
 * - 엑셀 매크로는 실행하지 않고 셀 값만 읽는다.
 * - 날짜 셀은 raw:true 로 읽어 Excel serial(숫자)로 받고, 도메인 파서가 처리한다.
 * - 통합문서 전체 import: 시트 히스DB/비에스DB/한진DB 를 각각 읽는다.
 *
 * CSV / 붙여넣기 파싱은 xlsx 가 필요 없으므로 @travel/domain 에 있다(여기서 재노출).
 */

import * as XLSX from 'xlsx';
import {
  DB_LABEL,
  mapMatrixToRows,
  sheetMatchesSpec,
  SPECS,
  type CellMatrix,
  type CellValue,
  type ImportResult,
  type RawBsRow,
  type RawHanjinRow,
  type RawHisRow,
  type RowFor,
  type SourceSpec,
  type SourceType,
  type WorkbookImportResult,
} from '@travel/domain';

// 기존 import 경로 호환: 화면 코드가 여기서 그대로 가져다 쓸 수 있게 재노출한다.
export {
  parseDelimited,
  detectDelimiter,
  importCsv,
  parsePastedRows,
} from '@travel/domain';

function currentYear(): number {
  return new Date().getFullYear();
}

/** 워크시트 -> 셀 행렬 + 원본 행 오프셋(0-based 시트 시작 행) */
function sheetToMatrix(ws: XLSX.WorkSheet): { matrix: CellMatrix; rowOffset: number } {
  const ref = ws['!ref'];
  let rowOffset = 0;
  if (ref) {
    try {
      rowOffset = XLSX.utils.decode_range(ref).s.r; // 0-based 시작 행
    } catch {
      rowOffset = 0;
    }
  }
  const matrix = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  }) as CellMatrix;
  return { matrix, rowOffset };
}

/** ArrayBuffer -> WorkBook */
export function readWorkbook(data: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(data, { type: 'array', cellDates: false });
}

/** 시트명 비교 키: 공백 제거 + 대소문자 무시 */
function sheetKey(name: string): string {
  return name.replace(/\s+/g, '').toLocaleLowerCase();
}

/**
 * 사양에 해당하는 시트명을 찾는다.
 *   1) 기본 시트명/별칭과 이름 매칭 (공백·대소문자 무시)
 *   2) 실패하면 헤더 내용으로 자동 탐지 (이미 다른 원본에 할당된 시트는 제외)
 * 시트명이 'his'/'bis'/'한진' 처럼 달라도 인식하기 위함.
 */
function resolveSheetName(
  wb: XLSX.WorkBook,
  spec: SourceSpec,
  taken: Set<string>,
): string | null {
  const candidates = [spec.sheetName, ...(spec.sheetAliases ?? [])].map(sheetKey);

  // 1) 이름(별칭) 매칭
  for (const name of wb.SheetNames) {
    if (taken.has(name)) continue;
    if (candidates.includes(sheetKey(name))) return name;
  }

  // 2) 헤더 내용으로 자동 탐지
  for (const name of wb.SheetNames) {
    if (taken.has(name)) continue;
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const { matrix } = sheetToMatrix(ws);
    if (sheetMatchesSpec(matrix, spec)) return name;
  }

  return null;
}

/** 통합문서(.xlsm 등) 전체를 읽어 세 원본으로 매핑 */
export function importWorkbook(
  data: ArrayBuffer,
  referenceYear: number = currentYear(),
): WorkbookImportResult {
  const wb = readWorkbook(data);
  const taken = new Set<string>();

  const readSheet = <Row extends { id: string; sourceOrder: number }>(
    source: SourceType,
  ): ImportResult<Row> => {
    const spec = SPECS[source];
    const sheetName = resolveSheetName(wb, spec, taken);
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!sheetName || !ws) {
      return {
        source,
        rows: [],
        errors: [
          {
            row: null,
            message:
              `'${spec.sheetName}' 에 해당하는 시트를 찾지 못했습니다. ` +
              `(문서의 시트: ${wb.SheetNames.join(', ') || '없음'})`,
          },
        ],
        headerFailed: true,
        sheetName: null,
      };
    }
    taken.add(sheetName);
    const { matrix, rowOffset } = sheetToMatrix(ws);
    const res = mapMatrixToRows<Row>(matrix, spec, referenceYear, rowOffset);
    return { ...res, sheetName };
  };

  return {
    his: readSheet<RawHisRow>('HIS'),
    bs: readSheet<RawBsRow>('BS'),
    hanjin: readSheet<RawHanjinRow>('HANJIN'),
  };
}


/**
 * 단일 원본용 .xlsx/.xlsm 파일 import.
 * 지정 시트명이 있으면 그것을, 없으면 첫 번째 시트를 읽는다.
 */
export function importSingleSheetFile<S extends SourceType>(
  data: ArrayBuffer,
  source: S,
  referenceYear: number = currentYear(),
): ImportResult<RowFor<S>> {
  const wb = readWorkbook(data);
  const spec = SPECS[source];

  // 1) 이 원본에 해당하는 시트를 이름/헤더로 찾는다.
  //    (시트가 하나뿐인 파일, 여러 시트가 든 통합문서 둘 다 지원)
  const resolved = resolveSheetName(wb, spec, new Set());
  const sheetName = resolved ?? wb.SheetNames[0] ?? null;
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;

  if (!sheetName || !ws) {
    return {
      source,
      rows: [],
      errors: [{ row: null, message: '읽을 수 있는 시트가 없습니다.' }],
      headerFailed: true,
      sheetName: null,
    };
  }

  const { matrix, rowOffset } = sheetToMatrix(ws);

  // 2) 이 원본 양식이 아니면(예: BS 화면에 히스 파일을 넣은 경우)
  //    어떤 원본 양식인지 알려주어 헤더 오류로 끝나지 않게 한다.
  if (!resolved) {
    const other = (Object.keys(SPECS) as SourceType[]).find(
      (s) => s !== source && sheetMatchesSpec(matrix, SPECS[s]),
    );
    if (other) {
      return {
        source,
        rows: [],
        errors: [
          {
            row: null,
            message:
              `이 파일은 ${DB_LABEL[other]} 양식으로 보입니다. ` +
              `${DB_LABEL[other]} 원본 화면에서 가져오세요.`,
          },
        ],
        headerFailed: true,
        sheetName,
      };
    }
  }

  const res = mapMatrixToRows<RowFor<S>>(matrix, spec, referenceYear, rowOffset);
  return { ...res, sheetName };
}
