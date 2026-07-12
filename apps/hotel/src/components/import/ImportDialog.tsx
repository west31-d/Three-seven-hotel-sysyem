/**
 * 단일 원본 import 다이얼로그.
 * - 파일(.csv/.xlsx/.xlsm/.xls) 또는 붙여넣기 텍스트를 매핑 → 미리보기/오류 → 교체/추가.
 */

import { useState } from 'react';
import type { CellValue, SourceType } from '@travel/domain';
import type {
  ImportError,
  ImportResult,
} from '@travel/domain';
import {
  importCsv,
  importSingleSheetFile,
  parsePastedRows,
} from '../../services/importWorkbook';
import { Modal } from '../common/Modal';
import { ImportPreview } from './ImportPreview';
import { useApp } from '../../app/store';

type Tab = 'file' | 'paste';
type Mode = 'replace' | 'append';

interface ImportDialogProps<S extends SourceType> {
  source: S;
  open: boolean;
  onClose: () => void;
}

interface Parsed {
  rows: Array<Record<string, CellValue>>;
  errors: ImportError[];
  headerFailed: boolean;
  /** 엑셀 파일에서 실제로 읽은 시트명 (CSV/붙여넣기는 null) */
  sheetName: string | null;
}

export function ImportDialog<S extends SourceType>({
  source,
  open,
  onClose,
}: ImportDialogProps<S>): JSX.Element {
  const { actions } = useApp();
  const [tab, setTab] = useState<Tab>('file');
  const [mode, setMode] = useState<Mode>('replace');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const reset = (): void => {
    setParsed(null);
    setPasteText('');
    setFileName('');
  };

  const store = (r: ImportResult<Record<string, CellValue> & { id: string; sourceOrder: number }>): void => {
    setParsed({
      rows: r.rows,
      errors: r.errors,
      headerFailed: r.headerFailed,
      sheetName: r.sheetName ?? null,
    });
  };

  const handleFile = async (file: File): Promise<void> => {
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.csv')) {
        const text = await file.text();
        store(importCsv(text, source) as never);
      } else {
        const buf = await file.arrayBuffer();
        store(importSingleSheetFile(buf, source) as never);
      }
    } catch (e) {
      actions.pushToast({
        type: 'error',
        message: '파일을 읽는 중 오류가 발생했습니다.',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleParsePaste = (): void => {
    if (pasteText.trim().length === 0) {
      setParsed(null);
      return;
    }
    store(parsePastedRows(pasteText, source) as never);
  };

  const canCommit = parsed !== null && !parsed.headerFailed && parsed.rows.length > 0;

  const commit = async (): Promise<void> => {
    if (!parsed || !canCommit) return;
    setBusy(true);
    try {
      const rows = parsed.rows as never[];
      if (mode === 'replace') {
        await actions.replaceSource(source, rows);
      } else {
        await actions.appendSource(source, rows);
      }
      actions.pushToast({
        type: 'success',
        message: `${source} 원본 ${mode === 'replace' ? '교체' : '추가'} 완료 (${parsed.rows.length}행)`,
      });
      reset();
      onClose();
    } catch {
      /* 오류 토스트는 store 에서 처리 */
    } finally {
      setBusy(false);
    }
  };

  const labelId = `import-${source}`;

  return (
    <Modal open={open} onClose={onClose} labelledBy={labelId} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id={labelId} className="text-base font-semibold text-slate-800">
            {source} 원본 가져오기
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

        {/* 탭 */}
        <div className="flex gap-1 border-b border-slate-200">
          {(['file', 'paste'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                reset();
              }}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                tab === t
                  ? 'border-slate-800 font-medium text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'file' ? '파일 업로드' : '붙여넣기'}
            </button>
          ))}
        </div>

        {tab === 'file' ? (
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-slate-600">
                CSV / XLSX / XLSM 파일 선택
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xlsm,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
                className="text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-slate-700"
              />
            </label>
            {fileName && (
              <div className="text-xs text-slate-500">
                선택된 파일: {fileName}
                {parsed?.sheetName && (
                  <> · 읽은 시트: <b>{parsed.sheetName}</b></>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onBlur={handleParsePaste}
              rows={5}
              placeholder="스프레드시트에서 복사한 행을 붙여넣으세요 (탭 또는 콤마 구분). 헤더 행이 있으면 자동 인식합니다."
              className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <button
              type="button"
              onClick={handleParsePaste}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              미리보기
            </button>
          </div>
        )}

        {parsed && (
          <>
            {parsed.headerFailed && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                헤더를 인식하지 못해 가져올 수 없습니다. 필수 헤더가 포함되어 있는지
                확인하세요.
              </div>
            )}
            <ImportPreview
              source={source}
              rows={parsed.rows}
              errors={parsed.errors}
            />

            <fieldset className="flex items-center gap-4 text-sm">
              <legend className="sr-only">가져오기 방식</legend>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                기존 데이터 교체
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                />
                기존 데이터에 추가
              </label>
            </fieldset>
          </>
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
            disabled={!canCommit || busy}
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
