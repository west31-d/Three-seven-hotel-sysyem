/** 대시보드 KPI 카드 4종 */

interface KpiCardsProps {
  checkIn: number;
  checkOut: number;
  total: number;
  duplicate: number;
}

interface CardProps {
  label: string;
  value: number;
  accent?: string;
}

function Card({ label, value, accent = 'text-slate-800' }: CardProps): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export function KpiCards({
  checkIn,
  checkOut,
  total,
  duplicate,
}: KpiCardsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="오늘 체크인" value={checkIn} />
      <Card label="오늘 체크아웃" value={checkOut} />
      <Card label="전체예약" value={total} />
      <Card
        label="중복예약"
        value={duplicate}
        accent={duplicate > 0 ? 'text-amber-600' : 'text-slate-800'}
      />
    </div>
  );
}
