/**
 * 통합 DB 화면 (본사 전용, 읽기 전용).
 *
 * 모든 호텔의 원본을 읽어 호텔별로 통합한 결과를 한 화면에서 본다.
 * - 중복은 호텔 안에서만 판정된다(다른 호텔의 같은 여행사 코드는 중복이 아님).
 * - 이 화면은 데이터를 수정하지 않는다. 쓰기 권한은 RLS 로도 막혀 있다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSupabase,
  loadCentralSnapshot,
  type CentralSnapshot,
  type Session,
} from '@travel/data';
import { SupportView } from './SupportView';
import {
  countCheckIn,
  countCheckOut,
  countDuplicate,
  countTotal,
  dash,
  downloadCsv,
  filterIntegrated,
  fmtDate,
  integratedToCsv,
  sortIntegrated,
  todayDateOnly,
  type IntegratedFilter,
  type IntegratedSortKey,
  type SortDirection,
} from '@travel/domain';

const COLUMNS: { key: IntegratedSortKey; label: string }[] = [
  { key: '호텔', label: '호텔' },
  { key: 'DB', label: '여행사' },
  { key: '예약코드', label: '예약코드' },
  { key: '체크인', label: '체크인' },
  { key: '체크아웃', label: '체크아웃' },
  { key: '고객명', label: '고객명' },
  { key: '인원', label: '인원' },
  { key: '객실타입', label: '객실타입' },
  { key: '예약상태', label: '예약상태' },
  { key: '예약건수', label: '예약건수' },
  { key: '중복여부', label: '중복여부' },
];

function reservationStatusRowClass(status: string): string {
  if (status === '정상') return 'bg-emerald-50/70';
  if (status === '취소') return 'bg-red-50/70';
  return 'odd:bg-white even:bg-slate-50/40';
}

interface CentralAppProps {
  session: Session | null;
  onSignOut: () => void;
}

export function CentralApp({ session, onSignOut }: CentralAppProps): JSX.Element {
  const [view, setView] = useState<'db' | 'support'>('db');
  const [snapshot, setSnapshot] = useState<CentralSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(todayDateOnly());
  const [selectedMonth, setSelectedMonth] = useState('');
  const [filter, setFilter] = useState<IntegratedFilter>({});
  const [keyword, setKeyword] = useState('');
  const [sortKey, setSortKey] = useState<IntegratedSortKey>('체크인');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError(
        'Supabase 설정이 없습니다. .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 넣어주세요.',
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setSnapshot(await loadCentralSnapshot(sb, new Date().getFullYear()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = snapshot?.reservations ?? [];

  const kpi = useMemo(
    () => ({
      checkIn: countCheckIn(rows, selectedDate),
      checkOut: countCheckOut(rows, selectedDate),
      total: countTotal(rows),
      duplicate: countDuplicate(rows),
    }),
    [rows, selectedDate],
  );

  const visible = useMemo(() => {
    const monthlyRows = selectedMonth
      ? rows.filter((row) => row.체크인?.startsWith(selectedMonth))
      : rows;
    const f = filterIntegrated(monthlyRows, { ...filter, keyword });
    return sortIntegrated(f, sortKey, sortDir);
  }, [rows, selectedMonth, filter, keyword, sortKey, sortDir]);

  const toggleSort = (key: IntegratedSortKey): void => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleExport = (): void => {
    downloadCsv(
      `통합DB_${new Date().toISOString().slice(0, 10)}.csv`,
      integratedToCsv(visible),
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-base font-bold text-slate-800">통합 DB</span>
          <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
            조회 전용
          </span>
          <div className="ml-auto flex items-center gap-2">
            {view === 'db' && (
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? '불러오는 중…' : '새로고침'}
              </button>
            )}
            {session && (
              <>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {session.email}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4">
          <div className="flex gap-1">
            {(
              [
                ['db', '통합 DB'],
                ['support', '고객센터'],
              ] as [typeof view, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`border-b-2 px-3 py-2 text-sm ${
                  view === value
                    ? 'border-slate-800 font-semibold text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {view === 'support' ? (
          <SupportView hotels={snapshot?.hotels ?? []} />
        ) : (
          <>
        {/* 조회일 + KPI */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="cdate">
            조회일
          </label>
          <input
            id="cdate"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="ml-2 text-xs text-slate-500">
            호텔 {snapshot?.hotels.length ?? 0}곳 · 원본 {snapshot?.rawRowCount ?? 0}행
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="조회일 체크인" value={kpi.checkIn} />
          <Kpi label="조회일 체크아웃" value={kpi.checkOut} />
          <Kpi label="전체예약" value={kpi.total} />
          <Kpi
            label="중복예약"
            value={kpi.duplicate}
            accent={kpi.duplicate > 0 ? 'text-amber-600' : undefined}
          />
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="fm">
              체크인 월
            </label>
            <div className="flex gap-1">
              <input
                id="fm"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              {selectedMonth && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth('')}
                  className="rounded border border-slate-300 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  전체
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="fh">
              호텔
            </label>
            <select
              id="fh"
              value={filter.호텔 ?? ''}
              onChange={(e) =>
                setFilter((f) => ({ ...f, 호텔: e.target.value || null }))
              }
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              {(snapshot?.hotels ?? []).map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="fd">
              여행사
            </label>
            <select
              id="fd"
              value={filter.db ?? ''}
              onChange={(e) =>
                setFilter((f) => ({ ...f, db: e.target.value || null }))
              }
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              <option value="히스">히스</option>
              <option value="BS">BS</option>
              <option value="한진">한진</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="fk">
              검색(예약코드/고객명)
            </label>
            <input
              id="fk"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filter.중복만 ?? false}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, 중복만: e.target.checked }))
                }
              />
              중복만
            </label>
            <button
              type="button"
              onClick={handleExport}
              disabled={visible.length === 0}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-50"
            >
              CSV
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          표시 {visible.length} / 전체 {rows.length}행
        </div>

        {/* 표 */}
        {rows.length === 0 && !loading ? (
          <div className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            데이터가 없습니다. 호텔 사이트에서 예약을 등록하면 여기에 모입니다.
          </div>
        ) : (
          <div className="overflow-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        {c.label}
                        <span className="text-slate-400">
                          {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-100 ${reservationStatusRowClass(
                      r.예약상태,
                    )}`}
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-700">
                      {dash(r.호텔)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {r.DB}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-700">
                      {dash(r.예약코드)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {fmtDate(r.체크인)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {fmtDate(r.체크아웃)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {dash(r.고객명)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {dash(r.인원)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {dash(r.객실타입)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {r.예약상태}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {r.예약건수}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-amber-700">
                      {dash(r.중복여부)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent = 'text-slate-800',
}: {
  label: string;
  value: number;
  accent?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
