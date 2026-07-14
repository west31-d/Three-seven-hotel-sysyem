/**
 * IndexedDB(Dexie) 기반 ReservationRepository 구현.
 *
 * - 원본 전체 교체/추가는 Dexie 트랜잭션으로 처리하여 저장 실패 시 부분 저장이 남지 않게 한다.
 * - 원본 행은 항상 sourceOrder 오름차순으로 반환하여 원본 순서를 보존한다.
 */

import { type Table } from 'dexie';
import { AppDatabase, db as defaultDb } from './database';
import type { SourceType } from '@travel/domain';
import {
  type RawRowMap,
  type ReservationRepository,
  SELECTED_DATE_KEY,
} from './ReservationRepository';

export class IndexedDbReservationRepository implements ReservationRepository {
  private readonly db: AppDatabase;

  constructor(database: AppDatabase = defaultDb) {
    this.db = database;
  }

  private table<S extends SourceType>(source: S): Table<RawRowMap[S], string> {
    switch (source) {
      case 'HIS':
        return this.db.his as unknown as Table<RawRowMap[S], string>;
      case 'BS':
        return this.db.bs as unknown as Table<RawRowMap[S], string>;
      case 'HANJIN':
        return this.db.hanjin as unknown as Table<RawRowMap[S], string>;
      default: {
        const never: never = source;
        throw new Error(`Unknown source: ${String(never)}`);
      }
    }
  }

  async listRows<S extends SourceType>(source: S): Promise<RawRowMap[S][]> {
    const rows = await this.table(source).orderBy('sourceOrder').toArray();
    return rows;
  }

  async putRow<S extends SourceType>(
    source: S,
    row: RawRowMap[S],
  ): Promise<void> {
    await this.table(source).put(row);
  }

  async deleteRow(source: SourceType, id: string): Promise<void> {
    await this.table(source).delete(id);
  }

  async replaceRows<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void> {
    const table = this.table(source);
    await this.db.transaction('rw', table, async () => {
      await table.clear();
      if (rows.length > 0) await table.bulkAdd(rows);
    });
  }

  async appendRows<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void> {
    if (rows.length === 0) return;
    const table = this.table(source);
    await this.db.transaction('rw', table, async () => {
      // 새로 추가되는 행의 sourceOrder 를 기존 최대값 뒤로 이어 붙여 순서를 유지한다.
      const existing = await table.toArray();
      const maxOrder = existing.reduce(
        (m, r) => Math.max(m, (r as { sourceOrder: number }).sourceOrder),
        -1,
      );
      const shifted = rows.map((r, i) => ({
        ...r,
        sourceOrder: maxOrder + 1 + i,
      })) as RawRowMap[S][];
      await table.bulkAdd(shifted);
    });
  }

  async clearSource(source: SourceType): Promise<void> {
    await this.table(source).clear();
  }

  async clearAllData(): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.his,
      this.db.bs,
      this.db.hanjin,
      async () => {
        await Promise.all([
          this.db.his.clear(),
          this.db.bs.clear(),
          this.db.hanjin.clear(),
        ]);
      },
    );
  }

  async getSelectedDate(): Promise<string | null> {
    const row = await this.db.settings.get(SELECTED_DATE_KEY);
    return row?.value ?? null;
  }

  async setSelectedDate(date: string): Promise<void> {
    await this.db.settings.put({ key: SELECTED_DATE_KEY, value: date });
  }

  async getCheckedIds(): Promise<Set<string>> {
    const rows = await this.db.checks.toArray();
    return new Set(rows.map((r) => r.id));
  }

  async setChecked(id: string, checked: boolean): Promise<void> {
    if (checked) {
      await this.db.checks.put({ id });
    } else {
      await this.db.checks.delete(id);
    }
  }
}
