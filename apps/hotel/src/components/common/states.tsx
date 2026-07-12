/** 빈 상태 / 로딩 / 오류 표시 */

export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export function LoadingState({
  message = '불러오는 중…',
}: {
  message?: string;
}): JSX.Element {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

/** 인라인 셀 내용: 길면 tooltip(title) + 말줄임 */
export function Ellipsis({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}): JSX.Element {
  return (
    <span className={`block max-w-[16rem] truncate ${className}`} title={text}>
      {text}
    </span>
  );
}
