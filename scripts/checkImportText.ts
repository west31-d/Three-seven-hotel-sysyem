import { importCsv, parsePastedRows } from '../packages/domain/src/importText.ts';
import { buildIntegratedReservations } from '../packages/domain/src/buildIntegratedReservations.ts';

import { buildIntegratedReservations as B2 } from '../packages/domain/src/buildIntegratedReservations.ts';
const res0 = (r: any) => B2([], [], r.rows, 2026, 'H')[0]?.체크인;
let pass = 0, fail = 0;
const check = (n: string, ok: boolean, d = '') => {
  if (ok) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n, d); }
};

// 한진 CSV
const csv = 'no.,Tour-No,Period,Nights,Room,Name,Remark\n1,IJ-1,2026-07-18 ~ 2026-07-20,2,TWN,홍길동,\n';
const r = importCsv(csv, 'HANJIN', 2026);
check('한진 CSV 1행 파싱', r.rows.length === 1 && r.errors.length === 0, JSON.stringify(r.errors));
check('체크인 파싱', res0(r) === '2026-07-18');

// 잘못된 원본에 넣으면 안내
const wrong = importCsv(csv, 'BS', 2026);
check('다른 양식 감지 → 안내', wrong.headerFailed === true && wrong.errors[0]!.message.includes('한진'), wrong.errors[0]?.message);

// 헤더 없는 붙여넣기
const pasted = parsePastedRows('2\tIJ-2\t2026-07-19 ~ 2026-07-21\t2\tDBL\t김철수\t', 'HANJIN', 2026);
check('헤더 없는 붙여넣기', pasted.rows.length === 1, JSON.stringify(pasted.errors));

// 통합까지 연결
const res = buildIntegratedReservations([], [], r.rows, 2026, '쓰리세븐호텔');
check('통합 1행 + 호텔 태깅', res.length === 1 && res[0]!.호텔 === '쓰리세븐호텔' && res[0]!.DB === '한진');
console.log(`\n결과: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
