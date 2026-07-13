/**
 * 웹 화면 표를 복사하면 탭 대신 정렬용 공백(2칸 이상)으로 붙여넣기되는 경우를 재현한다.
 * (BS 붙여넣기에서 전체 줄이 한 셀로 뭉쳐 매핑되던 버그의 회귀 테스트)
 */
import { describe, it, expect } from 'vitest';
import { parsePastedRows } from '../importText';
import { normalizeBsRows } from '../normalizeBs';

const SPACE_ALIGNED_TEXT = [
  '단체번호            대표명            인원수   기간            호텔       룸타입   박수   전달사항   요청 사항',
  'TYOSEL-260825-094   ETO/KAYANO MS    4+0      08/25~08/27     SELJNPD    2TWN     2박    55INC      신규요청',
  'TYOSEL-261021-049   ABE/YUKIKO MS    4+0      10/21~10/23     SELJNPD    2TWN     2박    60INC      신규요청',
].join('\n');

describe('공백 정렬 붙여넣기(탭 없음) 인식', () => {
  it('헤더를 데이터로 오인하지 않고 2건만 매핑한다', () => {
    const result = parsePastedRows(SPACE_ALIGNED_TEXT, 'BS', 2026);
    expect(result.headerFailed).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['단체번호']).toBe('TYOSEL-260825-094');
    expect(result.rows[0]['대표명']).toBe('ETO/KAYANO MS');
  });

  it('정규화 결과가 올바르다', () => {
    const result = parsePastedRows(SPACE_ALIGNED_TEXT, 'BS', 2026);
    const normalized = normalizeBsRows(result.rows, 2026);
    expect(normalized).toMatchObject([
      {
        예약코드: 'TYOSEL-260825-094',
        체크인: '2026-08-25',
        체크아웃: '2026-08-27',
        고객명: 'ETO/KAYANO MS',
      },
      {
        예약코드: 'TYOSEL-261021-049',
        체크인: '2026-10-21',
        체크아웃: '2026-10-23',
        고객명: 'ABE/YUKIKO MS',
      },
    ]);
  });
});
