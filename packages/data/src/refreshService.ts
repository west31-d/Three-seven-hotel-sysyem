/**
 * 새로고침 서비스: 저장소의 세 원본에서 통합 DB 와 모든 집계를 '재계산'한다.
 * 파생 데이터는 저장하지 않으므로, 같은 원본을 여러 번 새로고침해도
 * 결과가 중복 생성되지 않는다(항상 원본에서 재계산).
 */

import type {
  NormalizedReservation,
  RawBsRow,
  RawHanjinRow,
  RawHisRow,
} from '@travel/domain';
import { buildIntegratedReservations } from '@travel/domain';
import type { ReservationRepository } from './ReservationRepository';

export interface RefreshOutput {
  reservations: NormalizedReservation[];
  his: RawHisRow[];
  bs: RawBsRow[];
  hanjin: RawHanjinRow[];
}

/**
 * 세 원본을 읽어 통합 예약을 재계산한다.
 * @param referenceYear BS 연도 없는 MM/DD 파싱 기준 연도(기본: 현재 로컬 연도).
 * @param hotel 이 원본들이 속한 호텔(중복 판정 범위). 로컬 모드면 null.
 */
export async function refreshReservations(
  repo: ReservationRepository,
  referenceYear: number = new Date().getFullYear(),
  hotel: string | null = null,
): Promise<RefreshOutput> {
  const [his, bs, hanjin] = await Promise.all([
    repo.listRows('HIS'),
    repo.listRows('BS'),
    repo.listRows('HANJIN'),
  ]);

  const reservations = buildIntegratedReservations(
    his,
    bs,
    hanjin,
    referenceYear,
    hotel,
  );

  return { reservations, his, bs, hanjin };
}
