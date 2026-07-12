/**
 * 통합문서(.xlsm/.xlsx) 전체 가져오기 다이얼로그.
 * - 시트 히스DB → 히스, 비에스DB → BS, 한진DB → 한진 을 각각 읽는다.
 * - 매크로는 실행하지 않고 값만 읽으며, 빈 서식 행은 데이터로 만들지 않는다.
 * - 세 원본을 한 번에 교체(또는 추가)한다.
 */

import { useState } from 'react';
import { importWorkbook } from '../../services/importWorkbook';
import type { WorkbookImportResult } from '@travel/domain';
import { Modal } from '../common/Modal';
import { useApp } from '../../app/store';
import type { SourceType } from '@travel/domain';

type Mode = 'replace' | 'append';

const SOURCES: SourceType[] = ['HIS', 'BS', 'HANJIN'];
const SHEET_OF: Record<SourceType, string> = {
  HIS: '히스DB',
  BS: '비에스DB',
  HANJIN: '한진DB',
};

export function WorkbookImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const { actions } = useApp();
  const [result, setResult] = useState<WorkbookImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<Mode>('replace');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File): Promise<void> => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      setResult(importWorkbook(buf));
    } catch (e) {
      actions.pushToast({
        type: 'error',
        message: '통합문서를 읽는 중 오류가 발생했습니다.',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const totalRows = result
    ? result.his.rows.length + result.bs.rows.length + result.hanjin.rows.length
    : 0;

  const commit = async (): Promise<void> => {
    if (!result) return;
    setBusy(true);
    try {
      const perSource: Record<SourceType, { rows: unknown[] }> = {
        HIS: result.his,
        BS: result.bs,
        HANJIN: result.hanjin,
      };
      for (const s of SOURCES) {
        const rows = perSource[s].rows as never[];
        if (mode === 'replace') await actions.replaceSource(s, rows);
        else if (rows.length > 0) await actions.appendSource(s, rows);
      }
      actions.pushToast({
        type: 'success',
        message: `통합문서 가져오기 완료 (총 ${totalRows}행)`,
      });
      setResult(null);
      setFileName('');
      onClose();
    } catch {
      /* store 에서 오류 토스트 처리 */
    } finally {
      setBusy(false);
    }
  };

  const labelId = 'workbook-import';

  return (
    <Modal open={open} onClose={onClose} labelledBy={labelId} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id={labelId} className="text-base font-semibold text-slate-800">
            통합문서 전체 가져오기
          </h3>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="rounded px-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-500">
          히스 / BS / 한진 시트를 읽어 각 원본으로 가져옵니다. 시트 이름이{' '}
          <b>히스DB·비에스DB·한진DB</b> 가 아니어도(예: <b>his·bis·한진</b>) 이름과
          헤더로 자동 인식합니다. 엑셀 매크로는 실행하지 않습니다.
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">
            XLSM / XLSX 파일 선택
          </span>
          <input
            type="file"
            accept=".xlsm,.xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-slate-700"
          />
        </label>
        {fileName && (
          <div className="text-xs text-slate-500">선택된 파일: {fileName}</div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SOURCES.map((s) => {
                const r =
                  s === 'HIS' ? result.his : s === 'BS' ? result.bs : result.hanjin;
                return (
                  <div
                    key={s}
                    className="rounded border border-slate-200 p-2 text-sm"
                  >
                    <div className="font-medium text-slate-700">
                      {s} · {r.sheetName ?? SHEET_OF[s]}
                    </div>
                    {r.headerFailed ? (
                      <div className="text-xs text-red-600">
                        시트/헤더 인식 실패
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {r.rows.length}행
                        {r.errors.length > 0 && (
                          <span className="text-amber-700">
                            {' '}
                            · 오류 {r.errors.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 오류 상세 */}
            {[result.his, result.bs, result.hanjin].some(
              (r) => r.errors.length > 0,
            ) && (
              <div className="max-h-28 overflow-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {[result.his, result.bs, result.hanjin].flatMap((r) =>
                  r.errors.map((e, i) => (
                    <div key={`${r.source}-${i}`}>
                      [{r.source}] {e.row !== null ? `행 ${e.row}` : '헤더'}
                      {e.field ? ` · ${e.field}` : ''} : {e.message}
                    </div>
                  )),
                )}
              </div>
            )}

            <fieldset className="flex items-center gap-4 text-sm">
              <legend className="sr-only">가져오기 방식</legend>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="wb-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                기존 데이터 교체
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="wb-mode"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                />
                기존 데이터에 추가
              </label>
            </fieldset>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!result || totalRows === 0 || busy}
            onClick={commit}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'replace' ? '교체 저장' : '추가 저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
