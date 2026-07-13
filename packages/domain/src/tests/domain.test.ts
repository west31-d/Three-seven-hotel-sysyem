import { describe, it, expect } from 'vitest';
import type {
  RawHisRow,
  RawBsRow,
  RawHanjinRow,
} from '../types';
import { normalizeHisRows } from '../normalizeHis';
import { normalizeBsRows } from '../normalizeBs';
import { normalizeHanjinRows } from '../normalizeHanjin';
import {
  buildIntegratedReservations,
  buildIntegratedForHotels,
} from '../buildIntegratedReservations';
import {
  countCheckIn,
  countCheckOut,
  countDuplicate,
  checkInList,
  checkOutList,
  searchReservations,
  filterIntegrated,
  sortIntegrated,
} from '../selectors';

const REF = 2026;

function his(partial: Partial<RawHisRow>, i = 0): RawHisRow {
  return {
    id: `his-${i}`,
    sourceOrder: i,
    NO: 1,
    'Group Code': 'H1',
    'CHK-IN': '2026-07-10',
    'CHK-OUT': '2026-07-12',
    단체명: '홍길동',
    인원: '2',
    'Bed Type': 'TWN',
    'Bed Type2': null,
    열3: null,
    Status: '',
    예약번호: null,
    ...partial,
  };
}

function bs(partial: Partial<RawBsRow>, i = 0): RawBsRow {
  return {
    id: `bs-${i}`,
    sourceOrder: i,
    단체번호: 'B1',
    대표명: '김철수',
    인원수: '3',
    기간: '07/10~07/12',
    호텔: '호텔A',
    룸타입: 'DBL',
    박수: '2',
    전달사항: null,
    '요청 사항': '',
    ...partial,
  };
}

function hanjin(partial: Partial<RawHanjinRow>, i = 0): RawHanjinRow {
  return {
    id: `hj-${i}`,
    sourceOrder: i,
    'no.': 1,
    'Tour-No': 'T1',
    Period: '2026-07-10 ~ 2026-07-12',
    Nights: 2,
    Room: 'TWN',
    Name: '이영희',
    Remark: null,
    Status: null,
    ...partial,
  };
}

describe('normalizeHis', () => {
  it('NO 가 비어 있는 행은 제외', () => {
    const rows = normalizeHisRows([his({ NO: null })], REF);
    expect(rows).toHaveLength(0);
  });

  it("Status 정확히 '캔슬' 이면 취소, 공백 포함('캔슬 ')이면 정상", () => {
    const [cancel] = normalizeHisRows([his({ Status: '캔슬' })], REF);
    const [normal] = normalizeHisRows([his({ Status: '캔슬 ' })], REF);
    expect(cancel?.예약상태).toBe('취소');
    expect(normal?.예약상태).toBe('정상');
  });

  it('필드 매핑: Group Code→예약코드, 단체명→고객명, Bed Type→객실타입, 인원 원문 유지', () => {
    const [r] = normalizeHisRows(
      [his({ 'Group Code': 'G9', 단체명: '단체명X', 'Bed Type': 'OND', 인원: '05' })],
      REF,
    );
    expect(r?.예약코드).toBe('G9');
    expect(r?.고객명).toBe('단체명X');
    expect(r?.객실타입).toBe('OND');
    expect(r?.인원).toBe('05');
    expect(r?.DB).toBe('히스');
  });

  it('Excel serial 날짜 처리', () => {
    const [r] = normalizeHisRows(
      [his({ 'CHK-IN': 46203, 'CHK-OUT': 46205 })],
      REF,
    );
    expect(r?.체크인).toBe('2026-06-30');
    expect(r?.체크아웃).toBe('2026-07-02');
  });

  it('Bed Type2/열3 에 방타입처럼 보이는 값이 있으면 객실타입에 이어붙인다', () => {
    const [r] = normalizeHisRows(
      [his({ 'Bed Type': '1TWN', 'Bed Type2': '1DBL' })],
      REF,
    );
    expect(r?.객실타입).toBe('1TWN + 1DBL');
  });

  it('Bed Type2/열3 가 일자별 재실 내역(날짜/일련번호/금액)이면 무시한다', () => {
    const [r] = normalizeHisRows(
      [his({ 'Bed Type': '1TWN', 'Bed Type2': 46203, 열3: 55000 })],
      REF,
    );
    expect(r?.객실타입).toBe('1TWN');
  });
});

describe('normalizeBs', () => {
  it("예약코드가 null/빈문자/정확히 '*' 이면 제외", () => {
    expect(normalizeBsRows([bs({ 단체번호: null })], REF)).toHaveLength(0);
    expect(normalizeBsRows([bs({ 단체번호: '' })], REF)).toHaveLength(0);
    expect(normalizeBsRows([bs({ 단체번호: '*' })], REF)).toHaveLength(0);
    expect(normalizeBsRows([bs({ 단체번호: 'B2' })], REF)).toHaveLength(1);
  });

  it("요청 사항 '캔슬요청'→취소, 그 외→정상", () => {
    const [cancel] = normalizeBsRows([bs({ '요청 사항': '캔슬요청' })], REF);
    const [normal] = normalizeBsRows([bs({ '요청 사항': '신규' })], REF);
    expect(cancel?.예약상태).toBe('취소');
    expect(normal?.예약상태).toBe('정상');
  });

  it('기간 분리 및 referenceYear 적용 (연도 없는 MM/DD)', () => {
    const [r] = normalizeBsRows([bs({ 기간: '06/30~07/02' })], 2026);
    expect(r?.체크인).toBe('2026-06-30');
    expect(r?.체크아웃).toBe('2026-07-02');
  });

  it('필드 매핑: 단체번호→예약코드, 대표명→고객명, 인원수→인원, 룸타입→객실타입', () => {
    const [r] = normalizeBsRows(
      [bs({ 단체번호: 'BB', 대표명: '대표X', 인원수: '7', 룸타입: 'SGL' })],
      REF,
    );
    expect(r?.예약코드).toBe('BB');
    expect(r?.고객명).toBe('대표X');
    expect(r?.인원).toBe('7');
    expect(r?.객실타입).toBe('SGL');
    expect(r?.DB).toBe('BS');
  });
});

describe('normalizeHanjin', () => {
  it('Tour-No 가 비어 있으면 제외', () => {
    expect(normalizeHanjinRows([hanjin({ 'Tour-No': null })], REF)).toHaveLength(
      0,
    );
  });

  it('Remark 가 비어 있으면 정상, 있으면 원문 그대로(트림하지 않음)', () => {
    const [normal] = normalizeHanjinRows([hanjin({ Remark: null })], REF);
    const [empty] = normalizeHanjinRows([hanjin({ Remark: '   ' })], REF);
    const [text] = normalizeHanjinRows([hanjin({ Remark: ' 변경대기 ' })], REF);
    expect(normal?.예약상태).toBe('정상');
    expect(empty?.예약상태).toBe('정상');
    // 비어있지 않으면 원문 유지 (자동으로 취소로 바꾸지 않음)
    expect(text?.예약상태).toBe(' 변경대기 ');
  });

  it('인원은 항상 null, Period 분리', () => {
    const [r] = normalizeHanjinRows(
      [hanjin({ Period: '2026-06-26 ~ 2026-06-28' })],
      REF,
    );
    expect(r?.인원).toBeNull();
    expect(r?.체크인).toBe('2026-06-26');
    expect(r?.체크아웃).toBe('2026-06-28');
    expect(r?.DB).toBe('한진');
  });
});

describe('통합 + 중복 집계', () => {
  it('결합 순서(히스→BS→한진) 후 체크인 오름차순 정렬', () => {
    const rows = buildIntegratedReservations(
      [his({ 'CHK-IN': '2026-07-12' })],
      [bs({ 기간: '07/10~07/12' })],
      [hanjin({ Period: '2026-07-11 ~ 2026-07-13' })],
      REF,
    );
    expect(rows.map((r) => r.체크인)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('같은 DB+예약코드 는 중복, 예약건수 부여', () => {
    const rows = buildIntegratedReservations(
      [his({ 'Group Code': 'DUP' }, 0), his({ 'Group Code': 'DUP' }, 1)],
      [],
      [],
      REF,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.중복여부 === '중복')).toBe(true);
    expect(rows.every((r) => r.예약건수 === 2)).toBe(true);
    expect(countDuplicate(rows)).toBe(2);
  });

  it('같은 예약코드라도 DB 가 다르면 중복 아님', () => {
    const rows = buildIntegratedReservations(
      [his({ 'Group Code': 'X' })],
      [bs({ 단체번호: 'X' })],
      [],
      REF,
    );
    expect(rows.every((r) => r.중복여부 === null)).toBe(true);
    expect(countDuplicate(rows)).toBe(0);
  });
});

describe('selectors (대시보드 비대칭 규칙)', () => {
  const D = '2026-07-12';

  it('체크아웃 KPI 는 취소 포함, 체크아웃 명단은 정확히 취소만 제외', () => {
    const rows = buildIntegratedReservations(
      [
        his({ 'CHK-OUT': '2026-07-12', Status: '캔슬' }, 0), // 취소, 체크아웃 당일
        his({ 'CHK-OUT': '2026-07-12', Status: '' }, 1), // 정상, 체크아웃 당일
      ],
      [],
      [],
      REF,
    );
    expect(countCheckOut(rows, D)).toBe(2); // KPI: 취소 포함
    expect(checkOutList(rows, D)).toHaveLength(1); // 명단: 취소 제외
  });

  it('체크인 KPI/명단 은 취소 포함', () => {
    const rows = buildIntegratedReservations(
      [
        his({ 'CHK-IN': '2026-07-12', Status: '캔슬' }, 0),
        his({ 'CHK-IN': '2026-07-12', Status: '' }, 1),
      ],
      [],
      [],
      REF,
    );
    expect(countCheckIn(rows, D)).toBe(2);
    expect(checkInList(rows, D)).toHaveLength(2);
  });

  it('검색 상태: 빈값=EMPTY_QUERY, 매칭=RESULT, 미매칭=NO_RESULT', () => {
    const rows = buildIntegratedReservations(
      [his({ 단체명: 'MIYAMOTO/RISA' })],
      [],
      [],
      REF,
    );
    expect(searchReservations(rows, '   ').state).toBe('EMPTY_QUERY');
    expect(searchReservations(rows, 'miyamoto').state).toBe('RESULT');
    expect(searchReservations(rows, 'zzz').state).toBe('NO_RESULT');
  });
});

describe('통합 DB 필터/정렬 (표시 전용)', () => {
  const rows = buildIntegratedReservations(
    [his({ 'Group Code': 'A', 단체명: '가' }, 0)],
    [bs({ 단체번호: 'B', 대표명: '나' }, 0)],
    [hanjin({ 'Tour-No': 'C', Name: '다' }, 0)],
    REF,
  );

  it('DB 필터', () => {
    expect(filterIntegrated(rows, { db: 'BS' })).toHaveLength(1);
    expect(filterIntegrated(rows, { db: 'BS' })[0]?.DB).toBe('BS');
  });

  it('검색 필터(예약코드/고객명)', () => {
    expect(filterIntegrated(rows, { keyword: '나' })).toHaveLength(1);
  });

  it('정렬(예약코드 desc) 은 표시만 변경하고 원본 배열 불변', () => {
    const before = rows.map((r) => r.예약코드);
    const sorted = sortIntegrated(rows, '예약코드', 'desc');
    expect(sorted.map((r) => r.예약코드)).toEqual(['C', 'B', 'A']);
    expect(rows.map((r) => r.예약코드)).toEqual(before);
  });
});

/* ------------------------------------------------------------------ */
/* 호텔 범위 중복 판정 (통합 DB 서버로 여러 호텔을 모을 때)              */
/* ------------------------------------------------------------------ */
describe('호텔 범위 중복 판정', () => {
  it('같은 호텔 · 같은 여행사 · 같은 코드 → 중복', () => {
    const rows = buildIntegratedReservations(
      [his({ 'Group Code': 'DUP' }, 0), his({ 'Group Code': 'DUP' }, 1)],
      [],
      [],
      REF,
      '쓰리세븐호텔',
    );
    expect(countDuplicate(rows)).toBe(2);
    expect(rows[0]?.호텔).toBe('쓰리세븐호텔');
  });

  it('다른 호텔의 같은 예약코드는 중복이 아니다', () => {
    const rows = buildIntegratedForHotels(
      [
        { 호텔: '쓰리세븐호텔', his: [his({ 'Group Code': 'SAME' }, 0)], bs: [], hanjin: [] },
        { 호텔: '다른호텔', his: [his({ 'Group Code': 'SAME' }, 0)], bs: [], hanjin: [] },
      ],
      REF,
    );
    expect(rows).toHaveLength(2);
    expect(countDuplicate(rows)).toBe(0);
  });

  it('호텔 하나만 모으면 기존 통합 결과와 동일', () => {
    const src = [his({ 'Group Code': 'A' }, 0), his({ 'Group Code': 'A' }, 1)];
    const viaHotels = buildIntegratedForHotels(
      [{ 호텔: 'H', his: src, bs: [], hanjin: [] }],
      REF,
    );
    const direct = buildIntegratedReservations(src, [], [], REF, 'H');
    expect(viaHotels.map((r) => r.id)).toEqual(direct.map((r) => r.id));
    expect(countDuplicate(viaHotels)).toBe(countDuplicate(direct));
  });
});
