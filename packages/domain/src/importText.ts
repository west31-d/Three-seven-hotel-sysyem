/**
 * 텍스트 기반 가져오기 (CSV / 붙여넣기) — 순수 로직이므로 도메인 패키지에 둔다.
 * (엑셀 통합문서 읽기는 xlsx 라이브러리가 필요하므로 호텔 앱에 남아 있다.)
 */

import type { CellValue, SourceType } from './types';
import { DB_LABEL } from './types';
import { SPECS, type ImportResult, type SourceSpec } from './importTypes';
import { mapMatrixToRows, sheetMatchesSpec, type CellMatrix } from './sheetMapping';
import { parseDelimited } from './csv';
import { reconstructHisCellLines } from './hisPastedLines';
import { filterHanjinPastedLines } from './hanjinPastedLines';

export { parseDelimited };

/** SourceType -> 사양 */
/** 사양이 만들어 내는 행 타입 */
export type RowFor<S extends SourceType> = S extends 'HIS'
  ? import('./types').RawHisRow
  : S extends 'BS'
    ? import('./types').RawBsRow
    : import('./types').RawHanjinRow;

function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * 다른 원본의 데이터를 넣었는지 확인하고, 그렇다면 안내 결과를 돌려준다.
 * (맞는 양식이면 null)
 */
function wrongSourceResult<S extends SourceType>(
  matrix: CellMatrix,
  source: S,
  spec: SourceSpec,
): ImportResult<RowFor<S>> | null {
  if (sheetMatchesSpec(matrix, spec)) return null;

  const other = (Object.keys(SPECS) as SourceType[]).find(
    (s) => s !== source && sheetMatchesSpec(matrix, SPECS[s]),
  );
  if (!other) return null;

  return {
    source,
    rows: [],
    errors: [
      {
        row: null,
        message: `이 파일은 ${DB_LABEL[other]} 양식으로 보입니다. ${DB_LABEL[other]} 원본 화면에서 가져오세요.`,
      },
    ],
    headerFailed: true,
    sheetName: null,
  };
}

/** 단일 원본용 CSV 텍스트 import */
export function importCsv<S extends SourceType>(
  text: string,
  source: S,
  referenceYear: number = currentYear(),
): ImportResult<RowFor<S>> {
  const matrix = parseDelimited(text);
  const spec = SPECS[source];

  const wrong = wrongSourceResult(matrix, source, spec);
  if (wrong) return wrong;

  return mapMatrixToRows<RowFor<S>>(matrix, spec, referenceYear, 0);
}

/**
 * 다중 행 붙여넣기 파싱.
 * 붙여넣은 텍스트에 헤더 행이 포함되어 있으면 매핑에 사용하고,
 * 없으면 사양의 헤더 순서를 가정한 헤더 행을 앞에 붙여 매핑한다.
 */
export function parsePastedRows<S extends SourceType>(
  text: string,
  source: S,
  referenceYear: number = currentYear(),
): ImportResult<RowFor<S>> {
  const spec = SPECS[source];

  // 한진은 헤더 인식 자체는 성공하더라도(공백 정렬 변환으로 헤더 줄은 파싱됨),
  // 동반자/추가 객실 줄이 no./Tour-No 없이 데이터 행 사이에 끼어들면 열이 밀려
  // 엉뚱한 값이 Tour-No 등으로 잘못 매핑될 수 있다. 그런 줄을 먼저 제거한다.
  // (제거된 줄은 정규화 단계에서도 Tour-No 가 비어 있어 어차피 버려지므로 결과에는 영향 없다.)
  const preprocessed =
    source === 'HANJIN' ? (filterHanjinPastedLines(text) ?? text) : text;

  let matrix = parseDelimited(preprocessed);

  // 탭/콤마/공백 정렬 어느 것도 아니면, HIS 관리화면에서 셀 하나당 한 줄로
  // 복사된 형태인지 시도해본다(일자별 재실 내역은 건너뛰고 예약 단위 필드만 추출).
  if (!sheetMatchesSpec(matrix, spec) && source === 'HIS') {
    const reconstructed = reconstructHisCellLines(text);
    if (reconstructed) matrix = reconstructed;
  }

  const finalMatrix: CellMatrix = sheetMatchesSpec(matrix, spec)
    ? matrix
    : [spec.columns.map((c) => c.header as CellValue), ...matrix];

  return mapMatrixToRows<RowFor<S>>(finalMatrix, spec, referenceYear, 0);
}
