/* 실제 첨부 파일에서 추출한 원시 데이터로 도메인 로직 전체를 검증하는 독립 스크립트.
 * (vitest 없이 node 로 직접 실행: `node scripts/verifyDomain.ts`)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { RawHisRow, RawBsRow, RawHanjinRow } from '../packages/domain/src/types.ts';
import { buildIntegratedReservations, buildIntegratedForHotels } from '../packages/domain/src/buildIntegratedReservations.ts';
import { normalizeHisRows } from '../packages/domain/src/normalizeHis.ts';
import { normalizeBsRows } from '../packages/domain/src/normalizeBs.ts';
import { normalizeHanjinRows } from '../packages/domain/src/normalizeHanjin.ts';
import {
  countCheckIn,
  countCheckOut,
  countTotal,
  countDuplicate,
  searchReservations,
} from '../packages/domain/src/selectors.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../packages/domain/src/tests/attachedFixture.json'), 'utf-8'),
) as { his: RawHisRow[]; bs: RawBsRow[]; hanjin: RawHanjinRow[] };

const REF_YEAR = 2026;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

console.log('== 정규화 행 수 ==');
const his = normalizeHisRows(fixture.his, REF_YEAR);
const bs = normalizeBsRows(fixture.bs, REF_YEAR);
const hj = normalizeHanjinRows(fixture.hanjin, REF_YEAR);
check('히스 정규화 행 수 = 3', his.length === 3, `got ${his.length}`);
check('BS 정규화 행 수 = 8', bs.length === 8, `got ${bs.length}`);
check('한진 정규화 행 수 = 13', hj.length === 13, `got ${hj.length}`);

console.log('== 통합 DB ==');
const all = buildIntegratedReservations(
  fixture.his,
  fixture.bs,
  fixture.hanjin,
  REF_YEAR,
);
check('통합 예약 행 수 = 24', all.length === 24, `got ${all.length}`);

// 체크인 오름차순 정렬 확인
let sortedOk = true;
for (let i = 1; i < all.length; i++) {
  const a = all[i - 1].체크인;
  const b = all[i].체크인;
  if (a !== null && b !== null && a > b) sortedOk = false;
}
check('체크인 오름차순 정렬', sortedOk);

console.log('== 상태 매핑 표본 ==');
const manabe = all.find((r) => r.고객명 === 'MANABE/MACHIKO MS');
check('히스 캔슬 -> 취소', manabe?.예약상태 === '취소', `got ${manabe?.예약상태}`);
const miyamoto = all.find((r) => r.고객명 === 'MIYAMOTO/RISA MS');
check('히스 빈 Status -> 정상', miyamoto?.예약상태 === '정상', `got ${miyamoto?.예약상태}`);
const mitsumori = all.find((r) => r.고객명 === 'MITSUMORI/HIROKO MS');
check('BS 캔슬요청 -> 취소', mitsumori?.예약상태 === '취소', `got ${mitsumori?.예약상태}`);
const yoshida = all.find((r) => r.고객명 === 'YOSHIDA/TATSUYA MR');
check('BS 신규요청 -> 정상', yoshida?.예약상태 === '정상', `got ${yoshida?.예약상태}`);
const nishigaki = all.find((r) => r.고객명 === 'NISHIGAKI ASUKA');
check('한진 Remark null -> 정상', nishigaki?.예약상태 === '정상', `got ${nishigaki?.예약상태}`);
check('한진 인원 = null', nishigaki?.인원 === null, `got ${nishigaki?.인원}`);

console.log('== 날짜 파싱 표본 ==');
check(
  'BS 06/30~07/02 -> 2026-06-30 / 2026-07-02',
  mitsumori?.체크인 === '2026-06-30' && mitsumori?.체크아웃 === '2026-07-02',
  `got ${mitsumori?.체크인} / ${mitsumori?.체크아웃}`,
);
check(
  '히스 Excel serial -> 2026-06-30 / 2026-07-02',
  manabe?.체크인 === '2026-06-30' && manabe?.체크아웃 === '2026-07-02',
  `got ${manabe?.체크인} / ${manabe?.체크아웃}`,
);
check(
  '한진 ISO Period -> 2026-06-26 / 2026-06-28',
  nishigaki?.체크인 === '2026-06-26' && nishigaki?.체크아웃 === '2026-06-28',
  `got ${nishigaki?.체크인} / ${nishigaki?.체크아웃}`,
);

console.log('== 중복 집계 ==');
const dupRows = all.filter((r) => r.중복여부 === '중복');
check('중복 표시 행 수 = 0(첨부 파일)', dupRows.length === 0, `got ${dupRows.length}`);
check('모든 예약건수 = 1', all.every((r) => r.예약건수 === 1));

console.log('== 대시보드 (조회일 2026-07-10) ==');
const D = '2026-07-10';
check('오늘 체크인 = 0', countCheckIn(all, D) === 0, `got ${countCheckIn(all, D)}`);
check('오늘 체크아웃 = 0', countCheckOut(all, D) === 0, `got ${countCheckOut(all, D)}`);
check('전체예약 = 24', countTotal(all) === 24, `got ${countTotal(all)}`);
check('중복예약 = 0', countDuplicate(all) === 0, `got ${countDuplicate(all)}`);

console.log('== 검색 ==');
const s = searchReservations(all, 'miyamoto');
check('miyamoto 검색 1행', s.state === 'RESULT' && s.rows.length === 1, `state=${s.state} n=${s.rows.length}`);
const empty = searchReservations(all, '   ');
check('빈 검색어 -> EMPTY_QUERY', empty.state === 'EMPTY_QUERY');
const none = searchReservations(all, 'zzzznotfound');
check('없는 검색어 -> NO_RESULT', none.state === 'NO_RESULT');


/* ------------------------------------------------------------------ */
/* 호텔 범위 중복 판정 (통합 DB 서버)                                    */
/* ------------------------------------------------------------------ */
console.log('== 호텔 범위 중복 판정 ==');

function hisRow(id: string, order: number, code: string): RawHisRow {
  return {
    id, sourceOrder: order,
    NO: 1, 'Group Code': code,
    'CHK-IN': '2026-07-10', 'CHK-OUT': '2026-07-12',
    단체명: '홍길동', 인원: '2', 'Bed Type': 'TWN',
    'Bed Type2': null, 열3: null, Status: null, 예약번호: null,
  } as RawHisRow;
}

// 같은 호텔 안에서 같은 여행사 + 같은 예약코드 → 중복
const sameHotel = buildIntegratedReservations(
  [hisRow('a', 0, 'DUP'), hisRow('b', 1, 'DUP')], [], [], 2026, '쓰리세븐호텔',
);
check('같은 호텔 · 같은 코드 → 중복 2행', countDuplicate(sameHotel) === 2, `got ${countDuplicate(sameHotel)}`);
check('호텔 값이 행에 부착됨', sameHotel[0]?.호텔 === '쓰리세븐호텔');

// 서로 다른 호텔의 같은 코드 → 중복 아님
const twoHotels = buildIntegratedForHotels([
  { 호텔: '쓰리세븐호텔', his: [hisRow('a', 0, 'SAME')], bs: [], hanjin: [] },
  { 호텔: '다른호텔',     his: [hisRow('b', 0, 'SAME')], bs: [], hanjin: [] },
], 2026);
check('다른 호텔 · 같은 코드 → 중복 아님', countDuplicate(twoHotels) === 0, `got ${countDuplicate(twoHotels)}`);
check('두 호텔 합계 2행', twoHotels.length === 2);
check('호텔별로 태깅됨',
  twoHotels.some((r) => r.호텔 === '쓰리세븐호텔') && twoHotels.some((r) => r.호텔 === '다른호텔'));

// 호텔 하나만 넘기면 기존 결과와 동일해야 한다 (기존 동작 보존)
const viaHotels = buildIntegratedForHotels(
  [{ 호텔: 'H', his: fixture.his, bs: fixture.bs, hanjin: fixture.hanjin }], 2026,
);
const direct = buildIntegratedReservations(fixture.his, fixture.bs, fixture.hanjin, 2026, 'H');
check('단일 호텔이면 기존 통합과 동일(24행)', viaHotels.length === 24 && direct.length === 24);
check('단일 호텔이면 중복 집계도 동일',
  countDuplicate(viaHotels) === countDuplicate(direct));
check('단일 호텔이면 정렬 순서도 동일',
  viaHotels.map((r) => r.id).join('|') === direct.map((r) => r.id).join('|'));

console.log(`\n결과: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
