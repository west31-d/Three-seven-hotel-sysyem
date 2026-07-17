/**
 * HIS 셀 하나당 한 줄 붙여넣기: TWN/SGL 외에 TPL(트리플) 인원수 칸이 추가되어
 * 인원수 칸이 3개로 늘어난 양식에서도 Status('캔슬' 등)를 정확히 추출하는지 확인한다.
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
TPL

1
H20260614-071
Y1026005952
2026-06-14
2026-06-17
TAKAHASHI/MASAMI MS
0+0
1TWN
2026-06-14
1
0
0
캔슬
4/15 OK
55,000
2026-06-15
1
0
0
55,000
2026-06-16
1
0
0
55,000

2
H20260615-142
54626032764
2026-06-15
2026-06-17
WARNAKULASURIYA/MAMI MS
2+0
1TWN
2026-06-15
1
0
0
1번 대체신규

55,000
2026-06-16
1
0
0
55,000

14
H20260712-048
42626014042
2026-07-12
2026-07-14
ONO/MIKAKO MS
3+0
1TRP
2026-07-12
0
0
1


80,000
2026-07-13
0
0
1
80,000

19
H20260827-013
36126003672
2026-08-27
2026-08-28
KOJIMA/ASUKA MS
3+0
1TWN
1DBL
2026-08-27
1
1
0


55,000
55,000
`;

describe('HIS 셀 하나당 한 줄 붙여넣기: 인원수 칸이 3개(TWN/SGL/TPL)인 양식', () => {
  it('캔슬을 정확히 인식하고, TPL 방타입과 2방타입 예약도 올바르게 처리한다', () => {
    const result = parsePastedRows(PASTED_TEXT, 'HIS', 2026);
    expect(result.headerFailed).toBe(false);

    const normalized = normalizeHisRows(result.rows, 2026);
    const byCode = Object.fromEntries(normalized.map((r) => [r.예약코드, r]));

    // 1번: Status='캔슬' -> 인원수 칸이 3개(TWN/SGL/TPL)여도 정확히 취소로 인식
    expect(byCode['H20260614-071']).toMatchObject({
      고객명: 'TAKAHASHI/MASAMI MS',
      객실타입: '1TWN',
      예약상태: '취소',
    });

    // 2번: '1번 대체신규' -> 캔슬이 아니므로 정상
    expect(byCode['H20260615-142']).toMatchObject({
      고객명: 'WARNAKULASURIYA/MAMI MS',
      예약상태: '정상',
    });

    // 14번: TPL 칸에 값이 있는 1TRP(트리플룸) 예약도 정상 인식
    expect(byCode['H20260712-048']).toMatchObject({
      고객명: 'ONO/MIKAKO MS',
      객실타입: '1TRP',
      예약상태: '정상',
    });

    // 19번: 방타입 2개(1TWN+1DBL), 하룻밤짜리 예약도 정상 인식
    expect(byCode['H20260827-013']).toMatchObject({
      고객명: 'KOJIMA/ASUKA MS',
      체크인: '2026-08-27',
      체크아웃: '2026-08-28',
      객실타입: '1TWN + 1DBL',
      예약상태: '정상',
    });
  });
});
