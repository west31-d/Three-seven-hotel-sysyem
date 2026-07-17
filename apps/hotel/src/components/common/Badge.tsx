/** 상태/중복 배지 */

interface StatusBadgeProps {
  status: string;
}

/** 예약상태 배지: 취소=붉은색, 변경=노란색, 정상=녹색, 그 외 텍스트=중립 */
export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  let cls =
    'bg-slate-100 text-slate-700 ring-slate-200'; // 기타 텍스트 상태(한진 Remark 등)
  if (status === '취소') {
    cls = 'bg-red-50 text-red-700 ring-red-200';
  } else if (status === '변경') {
    cls = 'bg-amber-50 text-amber-700 ring-amber-200';
  } else if (status === '정상') {
    cls = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

/** 중복 배지 (경고색) */
export function DuplicateBadge({
  flag,
}: {
  flag: '중복' | null;
}): JSX.Element | null {
  if (flag !== '중복') return null;
  return (
    <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-300">
      중복
    </span>
  );
}

/** DB 라벨 배지 (구분용 중립 색) */
export function DbBadge({ db }: { db: string }): JSX.Element {
  const map: Record<string, string> = {
    히스: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    BS: 'bg-sky-50 text-sky-700 ring-sky-200',
    한진: 'bg-teal-50 text-teal-700 ring-teal-200',
  };
  const cls = map[db] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {db}
    </span>
  );
}
