/**
 * HIS 셀 하나당 한 줄 붙여넣기: 첫 밤 뒤에 이어지는 Status('캔슬'/'변경 ...' 등)를
 * 일자별 재실 내역과 함께 건너뛰지 않고 정확히 추출하는지 확인한다.
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
TPL

1
H20260603-047
53926000131
2026-06-03
2026-06-05
NAKAMURA/YAYO MS
0+0
1TWN
2026-06-03
1
0
캔슬
3/20 OK
55,000
2026-06-04
1
0
55,000

2
H20260603-076
54626033185
2026-06-03
2026-06-05
MATSUZAKA/KAZUO MR
1+0
1TWN
2026-06-03
1
0


55,000
2026-06-04
1
0
55,000

3
H20260615-086
Y1026005956
2026-06-15
2026-06-17
TAKAHASHI/MASAMI MS
0+0
1TWN
2026-06-15
1
0
캔슬
4/15 OK
55,000
2026-06-16
1
0
55,000

4
H20260615-141
54626032896
2026-06-15
2026-06-17
KAWAJI/MACHIKO MS
1+0
1TWN
2026-06-15
1
0
3번 대체신규

55,000
2026-06-16
1
0
55,000

5
H20260622-028
54626015103
2026-06-22
2026-06-24
YAMAGUCHI/MASAYOSHI MR
2+0
1TWN
2026-06-22
1
0
변경
3TWN>>1TWN
2/24 OK
55,000
2026-06-23
1
0
55,000

9
H20260629-087
Y1026007284
2026-06-29
2026-07-01
YAGUCHI/MARIKO MS
2+0
1TWN
2026-06-29
1
0
대표자명 변경
YAGUCHI/Y MARIKO MS>>
YAGUCHI/MARIKO MS
5/12 OK
55,000
2026-06-30
1
0
55,000
`;

describe('HIS 셀 하나당 한 줄 붙여넣기: Status(캔슬 등) 인식', () => {
  it('캔슬은 정확히 인식되고, 변경/대체신규 등은 정상으로 처리된다', () => {
    const result = parsePastedRows(PASTED_TEXT, 'HIS', 2026);
    expect(result.headerFailed).toBe(false);

    const normalized = normalizeHisRows(result.rows, 2026);
    const byCode = Object.fromEntries(normalized.map((r) => [r.예약코드, r]));

    // 1번, 3번: Status='캔슬' -> 취소로 인식
    expect(byCode['H20260603-047']).toMatchObject({
      고객명: 'NAKAMURA/YAYO MS',
      예약상태: '취소',
    });
    expect(byCode['H20260615-086']).toMatchObject({
      고객명: 'TAKAHASHI/MASAMI MS',
      예약상태: '취소',
    });

    // 2번: Status 없음 -> 정상
    expect(byCode['H20260603-076']).toMatchObject({
      고객명: 'MATSUZAKA/KAZUO MR',
      예약상태: '정상',
    });

    // 4번: '3번 대체신규' -> 캔슬이 아니므로 정상
    expect(byCode['H20260615-141']).toMatchObject({
      고객명: 'KAWAJI/MACHIKO MS',
      예약상태: '정상',
    });

    // 5번: 여러 줄짜리 '변경\n3TWN>>1TWN' -> 캔슬이 아니므로 정상
    expect(byCode['H20260622-028']).toMatchObject({
      고객명: 'YAMAGUCHI/MASAYOSHI MR',
      예약상태: '정상',
    });

    // 9번: 3줄짜리 '대표자명 변경...' -> 캔슬이 아니므로 정상
    expect(byCode['H20260629-087']).toMatchObject({
      고객명: 'YAGUCHI/MARIKO MS',
      예약상태: '정상',
    });
  });
});
