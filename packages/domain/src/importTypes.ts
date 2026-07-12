/**
 * import 관련 공유 타입 및 원본별 열 사양(spec).
 *
 * import 과정은 다음 단계로 분리한다:
 *   1) 파싱      : 파일 -> 셀 행렬(any[][])  (importWorkbook 에서 SheetJS 사용)
 *   2) 헤더 매핑 : 헤더 행 탐지 + 열 -> 필드 매핑  (sheetMapping, 순수 함수)
 *   3) 유효성검사: 필수 헤더 누락 / 날짜 파싱 실패 등을 행 번호와 함께 수집
 *   4) 저장      : repository 트랜잭션
 */

import type { CellValue, SourceType } from './types';

/** import 오류 (미리보기와 함께 표시) */
export interface ImportError {
  /** 원본 파일 기준 행 번호(1-based). 헤더 단계 오류는 null */
  row: number | null;
  /** 관련 필드/헤더 (없으면 undefined) */
  field?: string;
  message: string;
}

/** import 결과 (미리보기 + 오류) */
export interface ImportResult<Row> {
  source: SourceType;
  /** 매핑된 원본 행(미리보기/저장 대상). 빈 서식 행은 제외됨 */
  rows: Row[];
  errors: ImportError[];
  /** 헤더 단계에서 실패하여 데이터를 만들 수 없었는지 */
  headerFailed: boolean;
  /** 실제로 읽은 시트명 (CSV/붙여넣기는 null) */
  sheetName?: string | null;
}

/** 통합문서(.xlsm 등) 전체 import 결과 */
export interface WorkbookImportResult {
  his: ImportResult<import('./types').RawHisRow>;
  bs: ImportResult<import('./types').RawBsRow>;
  hanjin: ImportResult<import('./types').RawHanjinRow>;
}

/** 열 사양 항목 */
export interface ColumnSpec {
  /** 대상 필드명(Raw*Row 의 키) */
  field: string;
  /** 원본 헤더명 */
  header: string;
  /** 헤더의 별칭들(nbsp 변형 등) — normalizeHeader 후 대소문자 무시 비교 */
  aliases?: string[];
  /** 헤더 행 탐지에 사용되는 식별 헤더인지 */
  identify?: boolean;
  /** 이 필드가 날짜 열인지 (일반 단일 날짜) */
  date?: boolean;
  /** 이 필드가 기간 문자열(A~B 또는 'A ~ B')인지 */
  period?: 'bs' | 'hanjin';
  /**
   * 통합 정규화에서 사용하지 않는 부가 열(양식에 따라 없을 수 있음).
   * 값이 하나도 없으면 원본 표에서 열을 숨긴다(입력 폼에는 계속 표시).
   */
  optional?: boolean;
}

/** 원본 사양 */
export interface SourceSpec {
  source: SourceType;
  /** 통합문서에서 읽을 기본 시트명 */
  sheetName: string;
  /**
   * 허용되는 시트명 별칭. 대소문자/공백을 무시하고 비교한다.
   * 이름으로 못 찾으면 헤더 내용으로 시트를 자동 탐지한다.
   */
  sheetAliases?: string[];
  columns: ColumnSpec[];
}

/** 히스 사양 */
export const HIS_SPEC: SourceSpec = {
  source: 'HIS',
  sheetName: '히스DB',
  sheetAliases: ['히스DB', '히스', 'his', 'HIS DB'],
  columns: [
    // 양식에 따라 헤더가 'O'(NO 의 오타/잘림)로 되어 있는 경우가 있어 별칭 허용
    { field: 'NO', header: 'NO', aliases: ['O', 'NO.', 'No.', '번호'], identify: true },
    { field: 'Group Code', header: 'Group Code', aliases: ['GroupCode'], identify: true },
    { field: 'CHK-IN', header: 'CHK-IN', aliases: ['CHKIN', 'CHK IN'], identify: true, date: true },
    { field: 'CHK-OUT', header: 'CHK-OUT', aliases: ['CHKOUT', 'CHK OUT'], identify: true, date: true },
    { field: '단체명', header: '단체명', identify: true },
    { field: '인원', header: '인원' },
    { field: 'Bed Type', header: 'Bed Type', aliases: ['BedType'], identify: true },
    // 아래 3개는 통합 정규화에서 제거되는 부가 열 (양식에 없을 수 있음)
    { field: 'Bed Type2', header: 'Bed Type2', optional: true },
    { field: '열3', header: '열3', optional: true },
    { field: 'Status', header: 'Status', aliases: ['상태'], identify: true },
    { field: '예약번호', header: '예약번호', optional: true },
  ],
};

/** BS 사양 (요청 사항 헤더는 nbsp 변형 허용) */
export const BS_SPEC: SourceSpec = {
  source: 'BS',
  sheetName: '비에스DB',
  sheetAliases: ['비에스DB', '비에스', 'bis', 'bs', 'BS DB'],
  columns: [
    { field: '단체번호', header: '단체번호', identify: true },
    { field: '대표명', header: '대표명', identify: true },
    { field: '인원수', header: '인원수', identify: true },
    { field: '기간', header: '기간', identify: true, period: 'bs' },
    { field: '호텔', header: '호텔' },
    { field: '룸타입', header: '룸타입', identify: true },
    { field: '박수', header: '박수' },
    { field: '전달사항', header: '전달사항' },
    {
      field: '요청 사항',
      header: '요청 사항',
      // non-breaking space 변형 및 붙여쓰기 변형 허용
      aliases: ['요청\u00A0사항', '요청사항'],
      identify: true,
    },
  ],
};

/** 한진 사양 */
export const HANJIN_SPEC: SourceSpec = {
  source: 'HANJIN',
  sheetName: '한진DB',
  sheetAliases: ['한진DB', '한진', 'hanjin', 'HANJIN DB'],
  columns: [
    { field: 'no.', header: 'no.', aliases: ['no', 'No.'], identify: true },
    { field: 'Tour-No', header: 'Tour-No', aliases: ['TourNo', 'Tour No'], identify: true },
    { field: 'Period', header: 'Period', identify: true, period: 'hanjin' },
    { field: 'Nights', header: 'Nights' },
    { field: 'Room', header: 'Room', identify: true },
    { field: 'Name', header: 'Name', identify: true },
    { field: 'Remark', header: 'Remark' },
  ],
};

export const SPECS: Record<SourceType, SourceSpec> = {
  HIS: HIS_SPEC,
  BS: BS_SPEC,
  HANJIN: HANJIN_SPEC,
};

/** 빈 서식 행 판정을 위한 헬퍼 (모든 매핑 필드가 비어 있는지) */
export function isRowEmpty(values: Record<string, CellValue>): boolean {
  return Object.values(values).every(
    (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === ''),
  );
}
