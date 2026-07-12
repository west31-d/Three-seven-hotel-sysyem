/** 한진 원본 화면 */
import { SourceTablePage } from '../components/tables/SourceTablePage';

export function HanjinSourcePage(): JSX.Element {
  return (
    <SourceTablePage
      source="HANJIN"
      title="한진 원본"
      description="한진 예약 원본. Period 는 ' ~ ' 로 분리되며, Remark 가 있으면 그 텍스트가 그대로 예약상태가 됩니다(빈 값이면 '정상')."
    />
  );
}
