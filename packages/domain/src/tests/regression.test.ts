/**
 * 첨부된 통합문서(.xlsm)에서 추출한 실제 원시 데이터에 대한 회귀 테스트.
 * 기대값은 원본 엑셀의 PQ_통합DB_최종 결과와 일치한다.
 */
import { describe, it, expect } from 'vitest';
import fixture from './attachedFixture.json';
import type { RawHisRow, RawBsRow, RawHanjinRow } from '../types';
import { normalizeHisRows } from '../normalizeHis';
import { normalizeBsRows } from '../normalizeBs';
import { normalizeHanjinRows } from '../normalizeHanjin';
import { buildIntegratedReservations } from '../buildIntegratedReservations';
import {
  countCheckIn,
  countCheckOut,
  countTotal,
  countDuplicate,
  searchReservations,
} from '../selectors';

const REF = 2026;
const data = fixture as unknown as {
  his: RawHisRow[];
  bs: RawBsRow[];
  hanjin: RawHanjinRow[];
};

const all = buildIntegratedReservations(data.his, data.bs, data.hanjin, REF);

describe('회귀: 정규화 행 수', () => {
  it('히스=3, BS=8, 한진=13', () => {
    expect(normalizeHisRows(data.his, REF)).toHaveLength(3);
    expect(normalizeBsRows(data.bs, REF)).toHaveLength(8);
    expect(normalizeHanjinRows(data.hanjin, REF)).toHaveLength(13);
  });
});

describe('회귀: 통합 DB', () => {
  it('통합 행 수 = 24', () => {
    expect(all).toHaveLength(24);
  });

  it('체크인 오름차순 정렬', () => {
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1]!.체크인;
      const b = all[i]!.체크인;
      if (a !== null && b !== null) expect(a <= b).toBe(true);
    }
  });

  it('중복 없음, 모든 예약건수=1', () => {
    expect(countDuplicate(all)).toBe(0);
    expect(all.every((r) => r.예약건수 === 1)).toBe(true);
  });
});

describe('회귀: 상태/날짜 매핑 표본', () => {
  it('히스 캔슬→취소, 빈 Status→정상', () => {
    expect(all.find((r) => r.고객명 === 'MANABE/MACHIKO MS')?.예약상태).toBe(
      '취소',
    );
    expect(all.find((r) => r.고객명 === 'MIYAMOTO/RISA MS')?.예약상태).toBe(
      '정상',
    );
  });

  it('BS 캔슬요청→취소, 기간 06/30~07/02 파싱', () => {
    const m = all.find((r) => r.고객명 === 'MITSUMORI/HIROKO MS');
    expect(m?.예약상태).toBe('취소');
    expect(m?.체크인).toBe('2026-06-30');
    expect(m?.체크아웃).toBe('2026-07-02');
  });

  it('한진 Remark 없음→정상, 인원 null, ISO Period 파싱', () => {
    const n = all.find((r) => r.고객명 === 'NISHIGAKI ASUKA');
    expect(n?.예약상태).toBe('정상');
    expect(n?.인원).toBeNull();
    expect(n?.체크인).toBe('2026-06-26');
    expect(n?.체크아웃).toBe('2026-06-28');
  });
});

describe('회귀: 대시보드 (조회일 2026-07-10)', () => {
  const D = '2026-07-10';
  it('체크인 0, 체크아웃 0, 전체 24, 중복 0', () => {
    expect(countCheckIn(all, D)).toBe(0);
    expect(countCheckOut(all, D)).toBe(0);
    expect(countTotal(all)).toBe(24);
    expect(countDuplicate(all)).toBe(0);
  });
});

describe('회귀: 검색', () => {
  it("'miyamoto' 검색 결과 1행", () => {
    const s = searchReservations(all, 'miyamoto');
    expect(s.state).toBe('RESULT');
    expect(s.rows).toHaveLength(1);
  });
});
