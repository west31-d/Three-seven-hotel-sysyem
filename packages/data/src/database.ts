/**
 * IndexedDB 스키마 (Dexie).
 *
 * 저장 대상은 '원본' 세 테이블과 설정(settings)뿐이다.
 * 파생 통합 예약/집계는 저장하지 않고 항상 원본에서 재계산한다
 * (같은 원본을 여러 번 새로고침해도 중복 생성되지 않도록).
 *
 * DB+예약코드 에는 unique 제약을 걸지 않는다 — 중복 예약 검출을 위해
 * 동일 키의 여러 행을 허용해야 하기 때문이다. (원본 테이블은 id 로만 식별)
 */

import Dexie, { type Table } from 'dexie';
import type { RawHisRow, RawBsRow, RawHanjinRow } from '@travel/domain';

export interface SettingRow {
  key: string;
  value: string;
}

export class AppDatabase extends Dexie {
  his!: Table<RawHisRow, string>;
  bs!: Table<RawBsRow, string>;
  hanjin!: Table<RawHanjinRow, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = 'travel-reservation-db') {
    super(name);
    this.version(1).stores({
      // 기본키 id, 정렬용 인덱스 sourceOrder
      his: 'id, sourceOrder',
      bs: 'id, sourceOrder',
      hanjin: 'id, sourceOrder',
      settings: 'key',
    });
  }
}

export const db = new AppDatabase();
