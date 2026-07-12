/**
 * 원본 세 화면(히스/BS/한진)이 공유하는 범용 테이블 페이지.
 * - 행 추가/수정/삭제, 검색, 단일 원본 import(파일/붙여넣기), CSV 내보내기
 * - 원본 순서(sourceOrder) 보존
 * - 통합 DB 에서 행 클릭으로 넘어온 경우(?rowId=) 해당 행을 강조/스크롤
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CellValue, SourceType } from '@travel/domain';
import { SPECS } from '@travel/domain';
import { rawRowsToCsv, downloadCsv } from '@travel/domain';
import { useApp } from '../../app/store';
import { dash } from '@travel/domain';
import { Modal } from '../common/Modal';
import { RowForm, type RowFormValues } from '../forms/RowForm';
import { ImportDialog } from '../import/ImportDialog';
import { WorkbookImportDialog } from '../import/WorkbookImportDialog';
import { EmptyState } from '../common/states';

type AnyRow = Record<string, CellValue> & { id: string; sourceOrder: number };

function useSourceRows(source: SourceType): AnyRow[] {
  const { state } = useApp();
  if (source === 'HIS') return state.his as unknown as AnyRow[];
  if (source === 'BS') return state.bs as unknown as AnyRow[];
  return state.hanjin as unknown as AnyRow[];
}

interface SourceTablePageProps {
  source: SourceType;
  title: string;
  description?: string;
}

export function SourceTablePage({
  source,
  title,
  description,
}: SourceTablePageProps): JSX.Element {
  const spec = SPECS[source];
  const rows = useSourceRows(source);
  const { actions } = useApp();

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<RowFormValues | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showWorkbook, setShowWorkbook] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('rowId');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // 통합 DB 에서 넘어온 경우 해당 행으로 스크롤 + 강조
  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current[highlightId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('rowId');
        setSearchParams(next, { replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (q.length === 0) return rows;
    return rows.filter((r) =>
      spec.columns.some((c) => {
        const v = r[c.field];
        return v !== null && v !== undefined && String(v).toLocaleLowerCase().includes(q);
      }),
    );
  }, [rows, query, spec]);

  /**
   * 표시할 열: 통합에 쓰이지 않는 부가 열(optional)이 이 파일에 아예 없으면 숨긴다.
   * (양식마다 Bed Type2/열3/예약번호 등이 없을 수 있음. 행 추가/수정 폼에는 계속 표시)
   */
  const visibleColumns = useMemo(() => {
    if (rows.length === 0) return spec.columns;
    return spec.columns.filter(
      (c) =>
        !c.optional ||
        rows.some((r) => r[c.field] !== null && r[c.field] !== undefined),
    );
  }, [rows, spec]);

  const nextSourceOrder = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.sourceOrder), -1) + 1,
    [rows],
  );

  const openAdd = (): void => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (row: AnyRow): void => {
    setEditing(row as RowFormValues);
    setShowForm(true);
  };

  const handleSubmit = async (values: RowFormValues): Promise<void> => {
    setShowForm(false);
    if (editing) {
      await actions.updateRow(source, values as never);
    } else {
      await actions.addRow(source, values as never);
    }
  };

  const handleDelete = async (row: AnyRow): Promise<void> => {
    if (!window.confirm('이 행을 삭제할까요?')) return;
    await actions.deleteRow(source, row.id);
  };

  const handleExport = (): void => {
    const csv = rawRowsToCsv(source, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${source}_원본_${stamp}.csv`, csv);
  };

  const handleClear = async (): Promise<void> => {
    setConfirmClear(false);
    await actions.clearSource(source);
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </header>

      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openAdd}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          + 행 추가
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          원본 가져오기
        </button>
        <button
          type="button"
          onClick={() => setShowWorkbook(true)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          통합문서 가져오기
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-50"
        >
          CSV 내보내기
        </button>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={rows.length === 0}
          className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 enabled:hover:bg-red-50 disabled:opacity-50"
        >
          원본 비우기
        </button>

        <div className="ml-auto">
          <label className="sr-only" htmlFor={`search-${source}`}>
            검색
          </label>
          <input
            id={`search-${source}`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색 (모든 열)"
            className="w-56 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
      </div>

      <div className="text-xs text-slate-500">
        전체 {rows.length}행{query && ` · 검색 ${filtered.length}행`}
      </div>

      {/* 표 */}
      {rows.length === 0 ? (
        <EmptyState message="데이터가 없습니다. 행을 추가하거나 파일을 가져오세요." />
      ) : (
        <div className="overflow-auto rounded border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold text-slate-500">
                  #
                </th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.field}
                    className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold text-slate-500"
                  >
                    {c.header}
                  </th>
                ))}
                <th className="sticky right-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-2 text-right text-xs font-semibold text-slate-500">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const highlighted = r.id === highlightId;
                return (
                  <tr
                    key={r.id}
                    ref={(el) => {
                      rowRefs.current[r.id] = el;
                    }}
                    className={`border-b border-slate-100 ${
                      highlighted
                        ? 'bg-amber-50 ring-2 ring-inset ring-amber-300'
                        : 'odd:bg-white even:bg-slate-50/40'
                    }`}
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-400">
                      {i + 1}
                    </td>
                    {visibleColumns.map((c) => (
                      <td
                        key={c.field}
                        className="whitespace-nowrap px-2 py-1.5 text-slate-700"
                      >
                        {dash(r[c.field] ?? null)}
                      </td>
                    ))}
                    <td className="sticky right-0 whitespace-nowrap bg-white px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="mr-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(r)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 폼 모달 */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        labelledBy={`rowform-${source}`}
      >
        <RowForm
          source={source}
          initial={editing}
          nextSourceOrder={nextSourceOrder}
          onSubmit={(v) => void handleSubmit(v)}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      {/* import 다이얼로그 */}
      <ImportDialog
        source={source}
        open={showImport}
        onClose={() => setShowImport(false)}
      />
      <WorkbookImportDialog
        open={showWorkbook}
        onClose={() => setShowWorkbook(false)}
      />

      {/* 원본 비우기 확인 */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">원본 비우기</h3>
          <p className="text-sm text-slate-600">
            {source} 원본의 모든 행을 삭제합니다. 계속할까요?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleClear()}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            >
              비우기
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
