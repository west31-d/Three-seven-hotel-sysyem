/**
 * 통합 DB 화면.
 * 열: DB/예약코드/체크인/체크아웃/고객명/인원/객실타입/예약상태/예약건수/중복여부
 * - 정렬(헤더 클릭), DB/상태 필터, 날짜 범위 필터, 검색, 중복만 보기
 * - CSV 내보내기
 * - 행 클릭 시 해당 원본 화면으로 이동(행 강조)
 * 필터/정렬은 표시에만 영향을 주며 원본 데이터/집계값은 바꾸지 않는다.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../app/store';
import {
  filterIntegrated,
  sortIntegrated,
  type IntegratedFilter,
  type IntegratedSortKey,
  type SortDirection,
} from '@travel/domain';
import { integratedToCsv, downloadCsv } from '@travel/domain';
import type { SourceType } from '@travel/domain';
import { dash, fmtDate } from '@travel/domain';
import { DbBadge, StatusBadge, DuplicateBadge } from '../components/common/Badge';
import { EmptyState } from '../components/common/states';

const COLUMNS: { key: IntegratedSortKey; label: string }[] = [
  { key: 'DB', label: 'DB' },
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

const SOURCE_ROUTE: Record<SourceType, string> = {
  HIS: '/source/his',
  BS: '/source/bs',
  HANJIN: '/source/hanjin',
};

function reservationStatusRowClass(status: string): string {
  if (status === '정상') {
    return 'bg-emerald-50/70 hover:bg-emerald-100/70';
  }
  if (status === '취소') {
    return 'bg-red-50/70 hover:bg-red-100/70';
  }
  return 'odd:bg-white even:bg-slate-50/40 hover:bg-sky-50';
}

export function IntegratedDbPage(): JSX.Element {
  const { state } = useApp();
  const navigate = useNavigate();

  const [sortKey, setSortKey] = useState<IntegratedSortKey>('체크인');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<IntegratedFilter>({});
  const [keyword, setKeyword] = useState('');

  const rows = state.reservations;

  // 상태 옵션(한진 Remark 등 임의 텍스트 포함)
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.예약상태));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visible = useMemo(() => {
    const filtered = filterIntegrated(rows, { ...filter, keyword });
    return sortIntegrated(filtered, sortKey, sortDir);
  }, [rows, filter, keyword, sortKey, sortDir]);

  const toggleSort = (key: IntegratedSortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleExport = (): void => {
    const csv = integratedToCsv(visible);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`통합DB_${stamp}.csv`, csv);
  };

  const resetFilters = (): void => {
    setFilter({});
    setKeyword('');
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-800">통합 DB</h2>
        <p className="text-sm text-slate-500">
          세 원본을 통합·정규화한 결과입니다. 행을 클릭하면 원본 화면으로 이동합니다.
        </p>
      </header>

      {/* 필터 바 */}
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="f-db">
            DB
          </label>
          <select
            id="f-db"
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
          <label className="text-xs font-medium text-slate-600" htmlFor="f-status">
            예약상태
          </label>
          <select
            id="f-status"
            value={filter.예약상태 ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, 예약상태: e.target.value || null }))
            }
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="f-search">
            검색(예약코드/고객명)
          </label>
          <input
            id="f-search"
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색어"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filter.중복만 ?? false}
              onChange={(e) =>
                setFilter((f) => ({ ...f, 중복만: e.target.checked }))
              }
            />
            중복만 보기
          </label>
        </div>

        {/* 날짜 범위 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="f-cin-from">
            체크인 From
          </label>
          <input
            id="f-cin-from"
            type="date"
            value={filter.체크인From ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, 체크인From: e.target.value || null }))
            }
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="f-cin-to">
            체크인 To
          </label>
          <input
            id="f-cin-to"
            type="date"
            value={filter.체크인To ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, 체크인To: e.target.value || null }))
            }
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="f-cout-from">
            체크아웃 From
          </label>
          <input
            id="f-cout-from"
            type="date"
            value={filter.체크아웃From ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, 체크아웃From: e.target.value || null }))
            }
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="f-cout-to">
            체크아웃 To
          </label>
          <input
            id="f-cout-to"
            type="date"
            value={filter.체크아웃To ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, 체크아웃To: e.target.value || null }))
            }
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resetFilters}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          필터 초기화
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={visible.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-50"
        >
          CSV 내보내기
        </button>
        <div className="ml-auto text-xs text-slate-500">
          표시 {visible.length} / 전체 {rows.length}행
        </div>
      </div>

      {/* 표 */}
      {rows.length === 0 ? (
        <EmptyState message="통합할 데이터가 없습니다. 원본을 가져오거나 추가한 뒤 새로고침하세요." />
      ) : (
        <div className="overflow-auto rounded border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {COLUMNS.map((c) => {
                  const active = sortKey === c.key;
                  return (
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
                          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    navigate(
                      `${SOURCE_ROUTE[r.sourceType]}?rowId=${encodeURIComponent(r.sourceRowId)}`,
                    )
                  }
                  className={`cursor-pointer border-b border-slate-100 ${reservationStatusRowClass(
                    r.예약상태,
                  )}`}
                  title="클릭하여 원본 보기"
                >
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <DbBadge db={r.DB} />
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
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <StatusBadge status={r.예약상태} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                    {r.예약건수}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <DuplicateBadge flag={r.중복여부} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
