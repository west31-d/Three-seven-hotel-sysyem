/**
 * HIS 관리화면에서 셀 하나당 한 줄로 복사된(탭 구분이 아닌) 붙여넣기 텍스트 인식 테스트.
 */
import { describe, it, expect } from 'vitest';
import { parsePastedRows } from '../importText';
import { normalizeHisRows } from '../normalizeHis';

const PASTED_TEXT = `
NO
Group Code
CHK-IN
CHK-OUT
단체명
인원
Bed Type
Bed Type
Status
예약번호
날짜
TWN
SGL

1
H20260707-089
42626015137
2026-07-07
2026-07-09
HANAYAMA/TOMOE MS
1+0
1DBL
2026-07-07
0
1
변경
1TWN>>1DBL
6/2 OK
55,000
2026-07-08
0
1
55,000

2
H20260717-075
36126004421
2026-07-17
2026-07-19
FUJII/YUKI MS
2+0
1TWN
2026-07-17
1
0
얼리체크인 특전

80,000
2026-07-18
1
0
80,000

3
H20260729-069
05226001286
2026-07-29
2026-07-31
ENDO/MIYUKI MS
2+0
1TWN
2026-07-29
1
0


55,000
2026-07-30
1
0
55,000

12
H20260829-055
B5026000651
2026-08-29
2026-08-31
ASHIZAWA/HIROKI MR
4+0
2TWN
2026-08-29
2
0


80,000
2026-08-30
2
0
55,000

13
H20260919-099
36126004493
2026-09-19
2026-09-22
JINKAWA/KATSUOKI MR
2+0
1TWN
2026-09-19
1
0
얼리체크인 특전 추가
6/30 OK
80,000
2026-09-20
1
0
55,000
2026-09-21
1
0
55,000

14
H20261104-007
Y1026009868
2026-11-04
2026-11-06
NOSAKI/MEI MS
2+0
1TWN
2026-11-04
1
0


55,000
2026-11-05
1
0
55,000

33
H20261018-100
54626046271
2026-10-18
2026-10-20
YUM/SAWAFUJI MS
3+0
1TWN
1DBL
2026-10-18
1
1
55,000
55,000
2026-10-19
1
1
55,000
55,000
`;

describe('HIS 셀 하나당 한 줄 붙여넣기 인식', () => {
  it('예약 단위로 6건을 정확히 인식한다', () => {
    const result = parsePastedRows(PASTED_TEXT, 'HIS', 2026);
    expect(result.headerFailed).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.NO)).toEqual(['1', '2', '3', '12', '13', '14', '33']);
  });

  it('정규화 결과가 예약코드/체크인/체크아웃/고객명/인원/객실타입을 올바르게 담는다', () => {
    const result = parsePastedRows(PASTED_TEXT, 'HIS', 2026);
    const normalized = normalizeHisRows(result.rows, 2026);
    expect(normalized).toHaveLength(7);

    expect(normalized[0]).toMatchObject({
      예약코드: 'H20260707-089',
      체크인: '2026-07-07',
      체크아웃: '2026-07-09',
      고객명: 'HANAYAMA/TOMOE MS',
      인원: '1+0',
      객실타입: '1DBL',
      // Status='변경\n1TWN>>1DBL' -> 정확히 '캔슬'이 아니므로 정상으로 처리된다.
      예약상태: '정상',
    });

    // 3박(13번, JINKAWA)도 일자별 재실 내역에 흔들리지 않고 예약 1건으로 처리된다.
    expect(normalized[4]).toMatchObject({
      예약코드: 'H20260919-099',
      체크인: '2026-09-19',
      체크아웃: '2026-09-22',
      고객명: 'JINKAWA/KATSUOKI MR',
      객실타입: '1TWN',
    });

    // 2TWN, 4+0 인 12번(ASHIZAWA)도 정상 인식된다.
    expect(normalized[3]).toMatchObject({
      예약코드: 'H20260829-055',
      고객명: 'ASHIZAWA/HIROKI MR',
      인원: '4+0',
      객실타입: '2TWN',
    });

    // 33번(YUM/SAWAFUJI)은 서로 다른 방타입 2개(1TWN, 1DBL)를 예약했으므로
    // 맨 위 방타입만 남기지 않고 둘 다 객실타입에 담긴다.
    expect(normalized[6]).toMatchObject({
      예약코드: 'H20261018-100',
      체크인: '2026-10-18',
      체크아웃: '2026-10-20',
      고객명: 'YUM/SAWAFUJI MS',
      인원: '3+0',
      객실타입: '1TWN + 1DBL',
    });
  });

  it('기존 탭 구분 붙여넣기(엑셀 셀 복사)는 그대로 동작한다', () => {
    const tsv = [
      'NO\tGroup Code\tCHK-IN\tCHK-OUT\t단체명\t인원\tBed Type\tStatus\t예약번호',
      '1\tH20260707-089\t2026-07-07\t2026-07-09\tHANAYAMA/TOMOE MS\t1+0\t1DBL\t\t',
    ].join('\n');

    const result = parsePastedRows(tsv, 'HIS', 2026);
    expect(result.headerFailed).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['Group Code']).toBe('H20260707-089');
  });
});
