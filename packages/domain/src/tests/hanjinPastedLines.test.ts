/**
 * 한진 관리화면 붙여넣기: 동반자/추가 객실 줄이 no./Tour-No 없이 끼어드는 경우 인식 테스트.
 */
import { describe, it, expect } from 'vitest';
import { parsePastedRows } from '../importText';
import { normalizeHanjinRows } from '../normalizeHanjin';

const PASTED_TEXT = `no.   Tour-No   Period   Nights   Room   Name   Remark
1   IJ-202608180037-TYO   2026-08-18 ~ 2026-08-20   2   1 DBL   SAKAMOTO / KAZUE


2 TWN   SAKAMOTO / NAOKI
SAKAMOTO / ITSUKI


2   IJ-202608280011-BBB   2026-08-28 ~ 2026-08-30   2   4 TWN   KANEKO MAYU
KIM CHOONDAN
SEKI MASAYOSHI
NAGASE MASAKI
NAKASE MARINA
TAKAKURA YUUKA
YEUNG WINGYAN
LAI SUIMAN
3   IJ-202609130010-BBB   2026-09-13 ~ 2026-09-16   3   1 TWN   INOUE RISAKO
KITAMURA YUA

4   IJ-202610170028-BBB   2026-10-17 ~ 2026-10-19   2   1 TWN   KOBAYASHI REMI
YAMAGUCHI MIKA   `;

describe('한진 붙여넣기(동반자 줄 포함) 인식', () => {
  it('동반자/추가 객실 줄에 흔들리지 않고 4건만 매핑한다', () => {
    const result = parsePastedRows(PASTED_TEXT, 'HANJIN', 2026);
    expect(result.headerFailed).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((r) => r['Tour-No'])).toEqual([
      'IJ-202608180037-TYO',
      'IJ-202608280011-BBB',
      'IJ-202609130010-BBB',
      'IJ-202610170028-BBB',
    ]);
  });

  it('정규화 결과가 올바르다(체크인/체크아웃/객실타입/고객명)', () => {
    const result = parsePastedRows(PASTED_TEXT, 'HANJIN', 2026);
    const normalized = normalizeHanjinRows(result.rows, 2026);
    expect(normalized).toHaveLength(4);

    expect(normalized[0]).toMatchObject({
      예약코드: 'IJ-202608180037-TYO',
      체크인: '2026-08-18',
      체크아웃: '2026-08-20',
      객실타입: '1 DBL',
      고객명: 'SAKAMOTO / KAZUE',
    });

    expect(normalized[1]).toMatchObject({
      예약코드: 'IJ-202608280011-BBB',
      체크인: '2026-08-28',
      체크아웃: '2026-08-30',
      객실타입: '4 TWN',
      고객명: 'KANEKO MAYU',
    });
  });
});
