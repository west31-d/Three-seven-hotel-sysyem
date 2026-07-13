/**
 * 도메인 타입 정의
 *
 * 원본 세 양식(히스 / BS / 한진)의 원시(raw) 행 타입과,
 * 이를 정규화(normalize)한 통합 예약 타입을 분리한다.
 *
 * - Raw* 타입: 각 원본 시트/입력 화면이 그대로 보관하는 값. 원본 순서(sourceOrder)를 유지한다.
 * - BaseReservation: 정규화 직후의 공통 필드(집계 전).
 * - NormalizedReservation: 중복 집계(예약건수/중복여부)까지 부착된 최종 통합 행.
 *
 * 원본 엑셀의 Power Query 결과와 동일한 스키마/값을 목표로 한다.
 */

/** 정규화 소스 구분자 */
export type SourceType = 'HIS' | 'BS' | 'HANJIN';

/** 대시보드/통합 DB에 표시되는 한글 DB 라벨 */
export type DbLabel = '히스' | 'BS' | '한진';

/**
 * 예약상태.
 * - 히스/BS 는 정확히 '정상' 또는 '취소'.
 * - 한진은 Remark 원본 텍스트가 그대로 상태가 될 수 있으므로 임의 문자열을 허용한다.
 */
export type ReservationStatus = string;

/** 중복 여부 표기 */
export type DuplicateFlag = '중복' | null;

/** 셀 원시 값: 문자열 / 숫자 / JS Date / Excel serial(number) / 빈 값(null) */
export type CellValue = string | number | Date | boolean | null;

/* ------------------------------------------------------------------ */
/* 원본(raw) 행 타입                                                    */
/* ------------------------------------------------------------------ */

/** 히스 원본 행 (`히스DB` 시트) */
export interface RawHisRow {
  /** 애플리케이션 내부 안정 식별자 */
  id: string;
  /** 원본 파일/입력 상의 0-based 행 순서 */
  sourceOrder: number;

  NO: CellValue;
  'Group Code': CellValue;
  'CHK-IN': CellValue;
  'CHK-OUT': CellValue;
  단체명: CellValue;
  인원: CellValue;
  'Bed Type': CellValue;
  'Bed Type2': CellValue;
  열3: CellValue;
  Status: CellValue;
  예약번호: CellValue;
}

/** BS 원본 행 (`비에스DB` 시트) */
export interface RawBsRow {
  id: string;
  sourceOrder: number;

  단체번호: CellValue;
  대표명: CellValue;
  인원수: CellValue;
  기간: CellValue;
  호텔: CellValue;
  룸타입: CellValue;
  박수: CellValue;
  전달사항: CellValue;
  /**
   * 원본 마지막 헤더에는 non-breaking space(U+00A0)가 들어 있을 수 있다.
   * import 시 '요청 사항'(일반 공백)과 '요청\u00A0사항'(nbsp)을 동일 필드로 인식하여
   * 항상 이 일반-공백 키에 저장한다.
   */
  '요청 사항': CellValue;
}

/** 한진 원본 행 (`한진DB` 시트) */
export interface RawHanjinRow {
  id: string;
  sourceOrder: number;

  'no.': CellValue;
  'Tour-No': CellValue;
  Period: CellValue;
  Nights: CellValue;
  Room: CellValue;
  Name: CellValue;
  Remark: CellValue;
  /**
   * 양식에 따라 'Remark' 대신 별도의 상태 열(신규/취소 등)로 오는 경우가 있다.
   * Remark 와 달리 정확히 '취소'일 때만 취소로 인식하고, 그 외 값(신규 등)은 정상으로 본다.
   */
  Status: CellValue;
}

/** 세 원본을 하나로 다루기 위한 유니온 및 키 */
export type RawRow = RawHisRow | RawBsRow | RawHanjinRow;

/* ------------------------------------------------------------------ */
/* 정규화 결과 타입                                                     */
/* ------------------------------------------------------------------ */

/** 정규화 직후 공통 필드(중복 집계 전) */
export interface BaseReservation {
  sourceType: SourceType;
  /** 원본 행 id (파생 id 생성 및 원본 화면 역추적에 사용) */
  sourceRowId: string;
  /** 원본 내 0-based 순서 */
  sourceOrder: number;

  DB: DbLabel;
  예약코드: string | null;
  /** 'YYYY-MM-DD' 또는 null */
  체크인: string | null;
  /** 'YYYY-MM-DD' 또는 null */
  체크아웃: string | null;
  고객명: string | null;
  /** 원본 문자열을 그대로 유지, 없으면 null */
  인원: string | null;
  객실타입: string | null;
  예약상태: ReservationStatus;
}

/** 중복 집계까지 부착된 최종 통합 예약 행 */
export interface NormalizedReservation extends BaseReservation {
  /** `sourceType:sourceRowId` 기반 안정 식별자 */
  id: string;
  /**
   * 이 예약이 속한 호텔 (예: '쓰리세븐호텔').
   * 호텔 사이트에서는 자기 호텔 이름, 단일 호텔만 다룰 때는 null.
   * 중복 판정은 이 값까지 포함한 {호텔, DB, 예약코드} 로 이루어진다.
   */
  호텔: string | null;
  /** 같은 호텔+DB+예약코드 그룹의 행 수 */
  예약건수: number;
  /** 예약건수 > 1 이면 '중복', 아니면 null */
  중복여부: DuplicateFlag;
}

/** 조회일 기준 검색 결과 상태 */
export type SearchState = 'EMPTY_QUERY' | 'RESULT' | 'NO_RESULT';

export interface SearchResult {
  state: SearchState;
  rows: NormalizedReservation[];
}

/** SourceType -> DbLabel 매핑 (표시에 사용) */
export const DB_LABEL: Record<SourceType, DbLabel> = {
  HIS: '히스',
  BS: 'BS',
  HANJIN: '한진',
};
