/** BS 원본 화면 */
import { SourceTablePage } from '../components/tables/SourceTablePage';

export function BsSourcePage(): JSX.Element {
  return (
    <SourceTablePage
      source="BS"
      title="BS 원본"
      description="BS 예약 원본. 기간은 'MM/DD~MM/DD' 형식으로 분리되며 연도는 가져온 시점의 연도를 사용합니다. 예약코드가 비어 있거나 '*' 인 행은 통합에서 제외됩니다."
    />
  );
}
