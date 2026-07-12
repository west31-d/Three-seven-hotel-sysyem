/** 조회일 컨트롤 + 새로고침 + 검색 */

interface DateControlsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  onRefresh: () => void;
  loading: boolean;
  query: string;
  onQuery: (q: string) => void;
}

export function DateControls({
  selectedDate,
  onDateChange,
  onPrev,
  onToday,
  onNext,
  onRefresh,
  loading,
  query,
  onQuery,
}: DateControlsProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          aria-label="이전 날짜"
        >
          ← 이전
        </button>
        <label className="sr-only" htmlFor="view-date">
          조회일
        </label>
        <input
          id="view-date"
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button
          type="button"
          onClick={onNext}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          aria-label="다음 날짜"
        >
          다음 →
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          오늘
        </button>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? '새로고침 중…' : '새로고침'}
      </button>

      <div className="ml-auto">
        <label className="sr-only" htmlFor="dash-search">
          검색
        </label>
        <input
          id="dash-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="예약코드/고객명 검색"
          className="w-60 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>
    </div>
  );
}
