import { describe, it, expect } from 'vitest';
import type { CellValue } from '../types';
import {
  detectHeaderRow,
  mapMatrixToRows,
  sheetMatchesSpec,
  type CellMatrix,
} from '../sheetMapping';
import { BS_SPEC, HIS_SPEC, HANJIN_SPEC } from '../importTypes';
import {
  parseDelimited,
  importCsv,
  parsePastedRows,
} from '../importText';
import type { RawHisRow, RawHanjinRow } from '../types';

const REF = 2026;

describe('sheetMapping · 헤더 탐지', () => {
  it('BS 마지막 헤더의 nbsp(요청\\u00A0사항)를 일반 공백 필드로 인식', () => {
    const matrix: CellMatrix = [
      [
        '단체번호',
        '대표명',
        '인원수',
        '기간',
        '호텔',
        '룸타입',
        '박수',
        '전달사항',
        '요청\u00A0사항', // nbsp
      ],
    ];
    const header = detectHeaderRow(matrix, BS_SPEC);
    expect(header).not.toBeNull();
    expect(header?.fieldToCol.has('요청 사항')).toBe(true);
  });

  it('앞에 빈 열/빈 행이 있어도 헤더 행을 찾는다', () => {
    const matrix: CellMatrix = [
      [null, null, null],
      [null, 'no.', 'Tour-No', 'Period', 'Nights', 'Room', 'Name', 'Remark'],
    ];
    const header = detectHeaderRow(matrix, HANJIN_SPEC);
    expect(header?.headerRowIndex).toBe(1);
    // 'no.' 는 인덱스 1(0번은 빈 칸)
    expect(header?.fieldToCol.get('no.')).toBe(1);
  });

  it('필수 헤더가 없으면 null 반환', () => {
    const matrix: CellMatrix = [['전혀', '다른', '헤더']];
    expect(detectHeaderRow(matrix, HIS_SPEC)).toBeNull();
  });
});

describe('sheetMapping · 행 매핑/검증', () => {
  it('빈 서식 행은 데이터로 만들지 않는다', () => {
    const matrix: CellMatrix = [
      ['NO', 'Group Code', 'CHK-IN', 'CHK-OUT', '단체명', 'Bed Type', 'Status'],
      [1, 'G1', '2026-07-10', '2026-07-12', '홍길동', 'TWN', ''],
      [null, null, null, null, null, null, null], // 빈 행
    ];
    const res = mapMatrixToRows<RawHisRow>(matrix, HIS_SPEC, REF);
    expect(res.rows).toHaveLength(1);
    expect(res.headerFailed).toBe(false);
  });

  it('날짜 파싱 실패를 행 번호와 함께 오류로 수집(빈 값은 오류 아님)', () => {
    const matrix: CellMatrix = [
      ['NO', 'Group Code', 'CHK-IN', 'CHK-OUT', '단체명', 'Bed Type', 'Status'],
      [1, 'G1', 'not-a-date', '', '홍길동', 'TWN', ''],
    ];
    const res = mapMatrixToRows<RawHisRow>(matrix, HIS_SPEC, REF);
    const err = res.errors.find((e) => e.field === 'CHK-IN');
    expect(err).toBeTruthy();
    expect(err?.row).toBe(2); // 헤더가 1행, 데이터가 2행
    // 빈 CHK-OUT 은 오류가 아니어야 함
    expect(res.errors.some((e) => e.field === 'CHK-OUT')).toBe(false);
  });

  it('헤더를 못 찾으면 headerFailed=true 와 오류', () => {
    const matrix: CellMatrix = [['x', 'y']];
    const res = mapMatrixToRows<RawHisRow>(matrix, HIS_SPEC, REF);
    expect(res.headerFailed).toBe(true);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('sourceOrder 는 0-based 로 부여', () => {
    const matrix: CellMatrix = [
      ['no.', 'Tour-No', 'Period', 'Nights', 'Room', 'Name', 'Remark'],
      [1, 'T1', '2026-07-10 ~ 2026-07-12', 2, 'TWN', 'A', null],
      [2, 'T2', '2026-07-11 ~ 2026-07-13', 2, 'TWN', 'B', '대기'],
    ];
    const res = mapMatrixToRows<RawHanjinRow>(matrix, HANJIN_SPEC, REF);
    expect(res.rows.map((r) => r.sourceOrder)).toEqual([0, 1]);
  });
});

describe('parseDelimited', () => {
  it('콤마 구분 + 따옴표로 감싼 콤마 필드 처리', () => {
    const m = parseDelimited('a,"b,c",d');
    expect(m[0]).toEqual(['a', 'b,c', 'd']);
  });

  it('이스케이프된 따옴표("")', () => {
    const m = parseDelimited('"a""b",c');
    expect(m[0]).toEqual(['a"b', 'c']);
  });

  it('탭 구분 자동 감지(TSV)', () => {
    const m = parseDelimited('a\tb\tc');
    expect(m[0]).toEqual(['a', 'b', 'c']);
  });

  it('빈 필드는 null', () => {
    const m = parseDelimited('a,,c');
    expect(m[0]).toEqual(['a', null, 'c']);
  });
});

describe('importCsv / parsePastedRows', () => {
  const csv = [
    'no.,Tour-No,Period,Nights,Room,Name,Remark',
    '1,T1,2026-07-10 ~ 2026-07-12,2,TWN,홍길동,',
    '2,T2,2026-07-11 ~ 2026-07-13,2,DBL,김철수,대기',
  ].join('\n');

  it('CSV 를 한진 원본 행으로 매핑', () => {
    const res = importCsv(csv, 'HANJIN', REF);
    expect(res.headerFailed).toBe(false);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[1]?.['Tour-No']).toBe('T2');
    expect(res.rows[1]?.Remark).toBe('대기');
  });

  it('헤더 없는 붙여넣기는 사양 헤더 순서를 가정', () => {
    const pasted = '1\tT9\t2026-07-10 ~ 2026-07-12\t2\tTWN\t홍길동\t';
    const res = parsePastedRows(pasted, 'HANJIN', REF);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.['Tour-No']).toBe('T9');
  });

  it('헤더 포함 붙여넣기는 그대로 인식', () => {
    const res = parsePastedRows(csv.replace(/\n/g, '\n'), 'HANJIN', REF);
    expect(res.rows).toHaveLength(2);
  });
});

// 매핑 결과가 도메인 값 규칙과 일치하는지(경계) 간단 확인
describe('매핑 → CellValue 보존', () => {
  it('빈 문자열은 null 로 저장', () => {
    const matrix: CellMatrix = [
      ['no.', 'Tour-No', 'Period', 'Nights', 'Room', 'Name', 'Remark'],
      [1, 'T1', '2026-07-10 ~ 2026-07-12', 2, 'TWN', 'A', ''],
    ];
    const res = mapMatrixToRows<RawHanjinRow>(matrix, HANJIN_SPEC, REF);
    const remark: CellValue = res.rows[0]?.Remark ?? null;
    expect(remark).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 신규 양식(시트 his/bis/한진, 히스 헤더 'O', 2줄 헤더) 인식 회귀      */
/* ------------------------------------------------------------------ */
describe('신규 양식 인식', () => {
  const newHis: CellMatrix = [
    ['O', 'Group Code', 'CHK-IN', 'CHK-OUT', '단체명', '인원', 'Bed Type', 'Bed Type', null, null, 'Status'],
    [null, null, null, null, null, null, null, '날짜', 'TWN', 'SGL', null],
    [1, 'H20260721-069', 46224, 46226, 'NOHARA/EIKO MS', '2+0', '1TWN', 46224, 1, 0, '얼리체크인 특전'],
    [null, 36126004639, null, null, null, null, null, null, 55000, null, null],
  ];

  it("히스 첫 헤더가 'O' 여도 NO 로 인식", () => {
    const res = mapMatrixToRows<RawHisRow>(newHis, HIS_SPEC, 2026);
    expect(res.headerFailed).toBe(false);
    expect(res.rows[0]?.NO).toBe(1);
  });

  it('2줄 헤더의 하위헤더 행(날짜/TWN/SGL)은 데이터로 만들지 않음', () => {
    const res = mapMatrixToRows<RawHisRow>(newHis, HIS_SPEC, 2026);
    // 예약행 + 연속행 = 2행 (하위헤더 행 제외)
    expect(res.rows).toHaveLength(2);
  });

  it('엑셀 일련번호 날짜를 YYYY-MM-DD 로 변환', () => {
    const res = mapMatrixToRows<RawHisRow>(newHis, HIS_SPEC, 2026);
    expect(res.rows[0]?.['CHK-IN']).toBe('2026-07-21');
    expect(res.rows[0]?.['CHK-OUT']).toBe('2026-07-23');
    expect(res.errors).toHaveLength(0);
  });

  it('헤더 대소문자/공백 변형 허용', () => {
    const m: CellMatrix = [
      ['no', 'group code', 'chk-in', 'chk-out', '단체명', '인원', 'bed type', 'status'],
      [1, 'G1', '2026-07-10', '2026-07-12', '홍길동', '2', 'TWN', null],
    ];
    expect(mapMatrixToRows<RawHisRow>(m, HIS_SPEC, 2026).headerFailed).toBe(false);
  });

  it('원본 양식 판별(단일 원본 화면에 잘못 넣은 경우 안내에 사용)', () => {
    const hj: CellMatrix = [
      ['no.', 'Tour-No', 'Period', 'Nights', 'Room', 'Name', 'Remark'],
      [1, 'T1', '2026-07-10 ~ 2026-07-12', 2, 'TWN', 'A', null],
    ];
    expect(sheetMatchesSpec(hj, HANJIN_SPEC)).toBe(true);
    expect(sheetMatchesSpec(hj, HIS_SPEC)).toBe(false);
  });
});
