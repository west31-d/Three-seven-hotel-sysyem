/**
 * 한진 붙여넣기: 'Remark' 대신 'Status'(신규/취소) 열이 오는 양식 인식 테스트.
 */
import { describe, it, expect } from 'vitest';
import { parsePastedRows } from '../importText';
import { normalizeHanjinRows } from '../normalizeHanjin';

const HANJIN_STATUS_TSV = `no.	Tour-No	Period	Nights	Room	Name	Status
1	IJ-202606260035-BBB	2026-06-26 ~ 2026-06-28	2	1 DBL	NISHIGAKI ASUKA	신규
2	IJ-202606270010-TYO	2026-06-27 ~ 2026-06-30	3	1 TWN	MIYAMOTO / NATSU	취소
					MIYAMOTO / MIDORI
3	IJ-202606270047-TYO	2026-06-27 ~ 2026-06-29	2	1 TWN	ADACHI / YUICHI	신규
					TEZUKA / MAMORU
4	IJ-202607010017-BBB	2026-07-01 ~ 2026-07-03	2	1 TWN	FUJIMOTO JUNKO	신규
					OKU KAORI
5	IJ-202607040022-TYO	2026-07-04 ~ 2026-07-05	1	1 TWN	AOYAMA / SERENA	신규
					SUZUKI / HARUTO
6	IJ-202607160014-TYO	2026-07-16 ~ 2026-07-17	1	1 DBL	MURAKAMI / YUKI	취소
7	IJ-202608020016-BBB	2026-08-02 ~ 2026-08-05	3	1 TWN	NAITO MAKIKO	신규
					MURASHIMA YUKA
8	IJ-202610160005-TYO	2026-10-16 ~ 2026-10-18	2	3 TWN	NAKAZAKI / MARIKO	신규
					NAKAZAKI / YUYA
					NAKAZAKI / KATSUNORI
					NAKAZAKI / NOBUO
					NAKAZAKI / AYA
					NAKAZAKI / HARUMI`;

describe("한진 붙여넣기: Status 열(신규/취소) 인식", () => {
  it('8건을 인식하고, 정확히 취소인 건만 취소로 표시한다', () => {
    const result = parsePastedRows(HANJIN_STATUS_TSV, 'HANJIN', 2026);
    expect(result.headerFailed).toBe(false);

    const normalized = normalizeHanjinRows(result.rows, 2026);
    expect(normalized).toHaveLength(8);

    const byCode = Object.fromEntries(normalized.map((r) => [r.예약코드, r]));

    expect(byCode['IJ-202606260035-BBB']).toMatchObject({
      고객명: 'NISHIGAKI ASUKA',
      예약상태: '정상',
    });

    // 2번, 6번: Status 가 정확히 '취소' -> 취소로 인식되어야 한다.
    expect(byCode['IJ-202606270010-TYO']).toMatchObject({
      고객명: 'MIYAMOTO / NATSU',
      예약상태: '취소',
    });
    expect(byCode['IJ-202607160014-TYO']).toMatchObject({
      고객명: 'MURAKAMI / YUKI',
      예약상태: '취소',
    });

    // 신규는 정상으로 인식(취소가 아님)되어야 한다.
    expect(byCode['IJ-202608020016-BBB']).toMatchObject({
      고객명: 'NAITO MAKIKO',
      예약상태: '정상',
    });

    // 동반자 여러 명(6명)이 있는 8번도 Tour-No 흔들리지 않고 1건으로 처리된다.
    expect(byCode['IJ-202610160005-TYO']).toMatchObject({
      고객명: 'NAKAZAKI / MARIKO',
      객실타입: '3 TWN',
      예약상태: '정상',
    });
  });
});
