/* xlsx 비의존 순수 로직 검증 (tsx 로 실행): CSV 파서 + 시트 매핑.
 * `tsx scripts/verifyServices.ts`
 */
import { parseDelimited } from '../packages/domain/src/csv.ts';
import {
  detectHeaderRow,
  mapMatrixToRows,
  sheetMatchesSpec,
  type CellMatrix,
} from '../packages/domain/src/sheetMapping.ts';
import {
  BS_SPEC,
  HIS_SPEC,
  HANJIN_SPEC,
} from '../packages/domain/src/importTypes.ts';
import type { RawHisRow, RawHanjinRow } from '../packages/domain/src/types.ts';

const REF = 2026;
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

console.log('== CSV/TSV 파서 ==');
check(
  '따옴표 감싼 콤마',
  JSON.stringify(parseDelimited('a,"b,c",d')[0]) ===
    JSON.stringify(['a', 'b,c', 'd']),
);
check(
  '이스케이프 따옴표',
  JSON.stringify(parseDelimited('"a""b",c')[0]) ===
    JSON.stringify(['a"b', 'c']),
);
check(
  '탭 자동감지',
  JSON.stringify(parseDelimited('a\tb\tc')[0]) ===
    JSON.stringify(['a', 'b', 'c']),
);
check(
  '빈 필드 null',
  JSON.stringify(parseDelimited('a,,c')[0]) === JSON.stringify(['a', null, 'c']),
);

console.log('== 헤더 탐지 ==');
const bsHeader = detectHeaderRow(
  [
    [
      '단체번호',
      '대표명',
      '인원수',
      '기간',
      '호텔',
      '룸타입',
      '박수',
      '전달사항',
      '요청\u00A0사항',
    ],
  ],
  BS_SPEC,
);
check('BS nbsp 헤더 인식', bsHeader?.fieldToCol.has('요청 사항') === true);

const hjHeader = detectHeaderRow(
  [
    [null, null, null],
    [null, 'no.', 'Tour-No', 'Period', 'Nights', 'Room', 'Name', 'Remark'],
  ],
  HANJIN_SPEC,
);
check('빈 열/행 건너뛰고 헤더 인식', hjHeader?.headerRowIndex === 1);
check('열 오프셋 반영(no.=1)', hjHeader?.fieldToCol.get('no.') === 1);
check('필수 헤더 없으면 null', detectHeaderRow([['x', 'y']], HIS_SPEC) === null);

console.log('== 행 매핑/검증 ==');
const hisMatrix: CellMatrix = [
  ['NO', 'Group Code', 'CHK-IN', 'CHK-OUT', '단체명', 'Bed Type', 'Status'],
  [1, 'G1', 'not-a-date', '', '홍길동', 'TWN', ''],
  [null, null, null, null, null, null, null],
];
const hisRes = mapMatrixToRows<RawHisRow>(hisMatrix, HIS_SPEC, REF);
check('빈 서식 행 제외 → 1행', hisRes.rows.length === 1, `got ${hisRes.rows.length}`);
check(
  'CHK-IN 날짜 오류를 행 2로 보고',
  hisRes.errors.some((e) => e.field === 'CHK-IN' && e.row === 2),
);
check(
  '빈 CHK-OUT 은 오류 아님',
  !hisRes.errors.some((e) => e.field === 'CHK-OUT'),
);
check('빈 문자열 Status → null', hisRes.rows[0]?.Status === null);

const hjMatrix: CellMatrix = [
  ['no.', 'Tour-No', 'Period', 'Nights', 'Room', 'Name', 'Remark'],
  [1, 'T1', '2026-07-10 ~ 2026-07-12', 2, 'TWN', 'A', ''],
  [2, 'T2', '2026-07-11 ~ 2026-07-13', 2, 'DBL', 'B', '대기'],
];
const hjRes = mapMatrixToRows<RawHanjinRow>(hjMatrix, HANJIN_SPEC, REF);
check(
  'sourceOrder 0-based',
  JSON.stringify(hjRes.rows.map((r) => r.sourceOrder)) ===
    JSON.stringify([0, 1]),
);
check('빈 Remark → null', hjRes.rows[0]?.Remark === null);
check('Remark 원문 유지', hjRes.rows[1]?.Remark === '대기');

console.log('== CSV import 조합(파서+매핑) ==');
const csv = [
  'no.,Tour-No,Period,Nights,Room,Name,Remark',
  '1,T1,2026-07-10 ~ 2026-07-12,2,TWN,홍길동,',
  '2,T2,2026-07-11 ~ 2026-07-13,2,DBL,김철수,대기',
].join('\n');
const csvRes = mapMatrixToRows<RawHanjinRow>(
  parseDelimited(csv),
  HANJIN_SPEC,
  REF,
);
check('CSV 2행 매핑', csvRes.rows.length === 2, `got ${csvRes.rows.length}`);
check('CSV Tour-No 보존', csvRes.rows[1]?.['Tour-No'] === 'T2');

/* ------------------------------------------------------------------ */
/* 신규 양식(시트 his/bis/한진, 히스 헤더 'O') 인식 회귀                */
/* ------------------------------------------------------------------ */
console.log('== 신규 양식 헤더/시트 인식 ==');

// 히스: 첫 헤더가 'NO' 가 아니라 'O', 헤더가 2줄(2행은 날짜/TWN/SGL 하위헤더)
const newHis: CellMatrix = [
  ['O','Group Code','CHK-IN','CHK-OUT','단체명','인원','Bed Type','Bed Type',null,null,'Status'],
  [null,null,null,null,null,null,null,'날짜','TWN','SGL',null],
  [1,'H20260721-069',46224,46226,'NOHARA/EIKO MS','2+0','1TWN',46224,1,0,'얼리체크인 특전'],
  [null,36126004639,null,null,null,null,null,null,55000,null,null],
];
const nh = mapMatrixToRows<RawHisRow>(newHis, HIS_SPEC, 2026);
check("히스 헤더 'O' 를 NO 로 인식", !nh.headerFailed);
check('히스 하위헤더 행은 데이터로 만들지 않음', nh.rows.length === 2, `got ${nh.rows.length}`);
check(
  '히스 날짜 → YYYY-MM-DD',
  nh.rows[0]?.['CHK-IN'] === '2026-07-21' && nh.rows[0]?.['CHK-OUT'] === '2026-07-23',
  `got ${nh.rows[0]?.['CHK-IN']}~${nh.rows[0]?.['CHK-OUT']}`,
);
check("취소가 아닌 Status 텍스트는 오류 아님", nh.errors.length === 0);

// 헤더 대소문자/공백 변형 허용
const caseVar: CellMatrix = [
  ['no','group code','chk-in','chk-out','단체명','인원','bed type','status'],
  [1,'G1','2026-07-10','2026-07-12','홍길동','2','TWN',null],
];
check('헤더 대소문자 무시 인식', !mapMatrixToRows<RawHisRow>(caseVar, HIS_SPEC, 2026).headerFailed);

// 다른 원본 양식 판별(단일 원본 화면에 잘못 넣은 경우 안내용)
check('한진 양식은 히스 스펙과 매칭되지 않음', !sheetMatchesSpec(hjMatrix, HIS_SPEC));
check('한진 양식은 한진 스펙과 매칭됨', sheetMatchesSpec(hjMatrix, HANJIN_SPEC));

console.log(`\n결과: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
