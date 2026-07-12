/**
 * 원본 사양(SourceSpec) 기반 범용 행 편집 폼.
 * 각 열을 라벨-입력으로 렌더링한다. 빈 입력은 null 로 저장한다.
 */

import { useMemo, useState, type FormEvent } from 'react';
import type { CellValue, SourceType } from '@travel/domain';
import { SPECS } from '@travel/domain';
import { newId } from '@travel/domain';

export interface RowFormValues {
  id: string;
  sourceOrder: number;
  [field: string]: CellValue | number;
}

interface RowFormProps {
  source: SourceType;
  /** 편집 대상(없으면 신규) */
  initial?: RowFormValues | null;
  nextSourceOrder: number;
  onSubmit: (values: RowFormValues) => void;
  onCancel: () => void;
}

function toInputString(v: CellValue | number | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function RowForm({
  source,
  initial,
  nextSourceOrder,
  onSubmit,
  onCancel,
}: RowFormProps): JSX.Element {
  const spec = SPECS[source];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const col of spec.columns) {
      init[col.field] = toInputString(initial?.[col.field]);
    }
    return init;
  });

  const isEdit = Boolean(initial);
  const titleId = useMemo(() => `rowform-${source}`, [source]);

  const handleChange = (field: string, v: string): void => {
    setValues((s) => ({ ...s, [field]: v }));
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const out: RowFormValues = {
      id: initial?.id ?? newId(source.toLowerCase()),
      sourceOrder: initial?.sourceOrder ?? nextSourceOrder,
    };
    for (const col of spec.columns) {
      const raw = values[col.field] ?? '';
      out[col.field] = raw.length === 0 ? null : raw;
    }
    onSubmit(out);
  };

  return (
    <form onSubmit={handleSubmit} aria-labelledby={titleId} className="space-y-3">
      <h3 id={titleId} className="text-sm font-semibold text-slate-800">
        {isEdit ? '행 수정' : '행 추가'} — {spec.source}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {spec.columns.map((col) => {
          const inputId = `${titleId}-${col.field}`;
          const hint = col.date
            ? 'YYYY-MM-DD'
            : col.period === 'bs'
              ? 'MM/DD~MM/DD'
              : col.period === 'hanjin'
                ? 'YYYY-MM-DD ~ YYYY-MM-DD'
                : undefined;
          return (
            <div key={col.field} className="flex flex-col gap-1">
              <label
                htmlFor={inputId}
                className="text-xs font-medium text-slate-600"
              >
                {col.header}
                {hint && (
                  <span className="ml-1 font-normal text-slate-400">({hint})</span>
                )}
              </label>
              <input
                id={inputId}
                type="text"
                value={values[col.field] ?? ''}
                onChange={(e) => handleChange(col.field, e.target.value)}
                placeholder={hint}
                className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          저장
        </button>
      </div>
    </form>
  );
}
