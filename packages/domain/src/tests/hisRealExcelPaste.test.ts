/**
 * HIS 실제 엑셀 탭 구분 붙여넣기: 한 예약이 서로 다른 방타입 여러 개로
 * 나뉘어(마스터 행 + 이어지는 행) 들어올 때 둘 다 인식되는지 확인한다.
 */
import { describe, it, expect } from 'vitest';
import { parsePastedRows } from '../importText';
import { normalizeHisRows } from '../normalizeHis';

const REAL_TSV = `NO	Group Code	CHK-IN	CHK-OUT	단체명	인원	Bed Type	Bed Type			Status
							날짜	TWN	SGL
1	H20260721-069	2026-07-21	2026-07-23	NOHARA/EIKO MS	2+0	1TWN	2026-07-21	1	0	얼리체크인 특전
	36126004639							55,000
							2026-07-22	1	0
								55,000
2	H20260728-064	2026-07-28	2026-07-30	UEDA/KEIKO MS	3+0	1TWN	2026-07-28	1	1
	Y1026010144					1DBL		55,000	55,000
							2026-07-29	1	1
								55,000	55,000
3	H20260728-067	2026-07-28	2026-07-31	SHIOTA/HIRONORI MR	4+0	2TWN	2026-07-28	2	0
	54626047095							55,000
							2026-07-29	2	0
								55,000
							2026-07-30	2	0
								55,000`;

describe('HIS 실제 엑셀 탭 구분 붙여넣기(방타입 여러 개 포함)', () => {
  it('3건을 정확히 인식하고, 방타입이 여러 개인 예약은 모두 합쳐 담는다', () => {
    const result = parsePastedRows(REAL_TSV, 'HIS', 2026);
    expect(result.headerFailed).toBe(false);

    const normalized = normalizeHisRows(result.rows, 2026);
    expect(normalized).toHaveLength(3);

    expect(normalized[0]).toMatchObject({
      예약코드: 'H20260721-069',
      고객명: 'NOHARA/EIKO MS',
      객실타입: '1TWN',
    });

    // 2번(UEDA/KEIKO): 마스터 행 Bed Type=1TWN, 이어지는 행 Bed Type=1DBL -> 둘 다 담겨야 한다.
    expect(normalized[1]).toMatchObject({
      예약코드: 'H20260728-064',
      체크인: '2026-07-28',
      체크아웃: '2026-07-30',
      고객명: 'UEDA/KEIKO MS',
      인원: '3+0',
      객실타입: '1TWN + 1DBL',
    });

    expect(normalized[2]).toMatchObject({
      예약코드: 'H20260728-067',
      고객명: 'SHIOTA/HIRONORI MR',
      객실타입: '2TWN',
    });
  });
});
