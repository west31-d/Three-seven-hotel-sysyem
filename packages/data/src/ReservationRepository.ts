/**
 * 저장소(Repository) 인터페이스.
 *
 * UI 컴포넌트는 이 인터페이스만 사용하고 IndexedDB(Dexie)를 직접 호출하지 않는다.
 * 나중에 Supabase / REST API 로 교체하려면 이 인터페이스를 구현한 새 클래스만 제공하면 된다.
 */

import type {
  RawHisRow,
  RawBsRow,
  RawHanjinRow,
  SourceType,
} from '@travel/domain';

/** SourceType -> 원본 행 타입 매핑 (제네릭 메서드의 타입 안전성 확보) */
export interface RawRowMap {
  HIS: RawHisRow;
  BS: RawBsRow;
  HANJIN: RawHanjinRow;
}

export const SELECTED_DATE_KEY = 'selectedDate';

export interface ReservationRepository {
  /** 원본 행 목록 조회 (sourceOrder 오름차순, 원본 순서 유지) */
  listRows<S extends SourceType>(source: S): Promise<RawRowMap[S][]>;

  /** 단일 행 추가/수정 (id 기준 upsert) */
  putRow<S extends SourceType>(source: S, row: RawRowMap[S]): Promise<void>;

  /** 단일 행 삭제 */
  deleteRow(source: SourceType, id: string): Promise<void>;

  /** 원본 전체 교체 (기존 데이터 교체) — 트랜잭션으로 원자적 처리 */
  replaceRows<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void>;

  /** 원본에 추가 (기존 데이터에 추가) — 트랜잭션으로 원자적 처리 */
  appendRows<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void>;

  /** 특정 원본 비우기 */
  clearSource(source: SourceType): Promise<void>;

  /** 전체 비우기(설정 제외) */
  clearAllData(): Promise<void>;

  /** 조회일 조회 (없으면 null) */
  getSelectedDate(): Promise<string | null>;

  /** 조회일 저장 */
  setSelectedDate(date: string): Promise<void>;
}
