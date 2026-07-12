import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../database';
import { IndexedDbReservationRepository } from '../IndexedDbReservationRepository';
import type { RawHisRow } from '@travel/domain';

function hisRow(id: string, order: number, code: string): RawHisRow {
  return {
    id,
    sourceOrder: order,
    NO: 1,
    'Group Code': code,
    'CHK-IN': '2026-07-10',
    'CHK-OUT': '2026-07-12',
    단체명: '홍길동',
    인원: '2',
    'Bed Type': 'TWN',
    'Bed Type2': null,
    열3: null,
    Status: '',
    예약번호: null,
  };
}

let repo: IndexedDbReservationRepository;

beforeEach(async () => {
  // 테스트마다 새 DB 로 격리
  const db = new AppDatabase(`test-db-${Math.random().toString(36).slice(2)}`);
  repo = new IndexedDbReservationRepository(db);
});

describe('IndexedDbReservationRepository', () => {
  it('replaceRows 후 listRows 는 sourceOrder 오름차순 반환', async () => {
    await repo.replaceRows('HIS', [
      hisRow('a', 1, 'A'),
      hisRow('b', 0, 'B'),
    ]);
    const rows = await repo.listRows('HIS');
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('replaceRows 는 기존 데이터를 교체', async () => {
    await repo.replaceRows('HIS', [hisRow('a', 0, 'A')]);
    await repo.replaceRows('HIS', [hisRow('c', 0, 'C')]);
    const rows = await repo.listRows('HIS');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('c');
  });

  it('appendRows 는 기존 최대 sourceOrder 뒤로 이어 붙인다', async () => {
    await repo.replaceRows('HIS', [hisRow('a', 0, 'A'), hisRow('b', 1, 'B')]);
    await repo.appendRows('HIS', [hisRow('c', 0, 'C')]);
    const rows = await repo.listRows('HIS');
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows[2]?.sourceOrder).toBe(2);
  });

  it('putRow 는 upsert, deleteRow 는 삭제', async () => {
    await repo.putRow('HIS', hisRow('a', 0, 'A'));
    await repo.putRow('HIS', hisRow('a', 0, 'A2')); // 같은 id 업데이트
    let rows = await repo.listRows('HIS');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['Group Code']).toBe('A2');
    await repo.deleteRow('HIS', 'a');
    rows = await repo.listRows('HIS');
    expect(rows).toHaveLength(0);
  });

  it('clearSource 는 해당 원본만 비운다', async () => {
    await repo.replaceRows('HIS', [hisRow('a', 0, 'A')]);
    await repo.clearSource('HIS');
    expect(await repo.listRows('HIS')).toHaveLength(0);
  });

  it('selectedDate 저장/복원', async () => {
    expect(await repo.getSelectedDate()).toBeNull();
    await repo.setSelectedDate('2026-07-10');
    expect(await repo.getSelectedDate()).toBe('2026-07-10');
  });
});
