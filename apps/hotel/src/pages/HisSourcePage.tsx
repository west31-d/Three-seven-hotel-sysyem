/** 히스 원본 화면 */
import { SourceTablePage } from '../components/tables/SourceTablePage';

export function HisSourcePage(): JSX.Element {
  return (
    <SourceTablePage
      source="HIS"
      title="히스 원본"
      description="히스(HIS) 예약 원본. NO 가 비어 있는 서식/연속 행은 통합 시 제외되며, Status='캔슬'만 취소로 처리됩니다."
    />
  );
}
