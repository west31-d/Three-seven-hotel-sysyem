/** import 미리보기: 매핑된 행 표본 + 오류 목록 */

import type { CellValue, SourceType } from '@travel/domain';
import type { ImportError } from '@travel/domain';
import { SPECS } from '@travel/domain';
import { dash } from '@travel/domain';

interface ImportPreviewProps {
  source: SourceType;
  rows: Array<Record<string, CellValue>>;
  errors: ImportError[];
  maxRows?: number;
}

export function ImportPreview({
  source,
  rows,
  errors,
  maxRows = 8,
}: ImportPreviewProps): JSX.Element {
  const spec = SPECS[source];
  const preview = rows.slice(0, maxRows);

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-600">
        매핑된 행 <span className="font-semibold">{rows.length}</span>개
        {rows.length > maxRows && ` (상위 ${maxRows}개 미리보기)`}
      </div>

      {errors.length > 0 && (
        <div className="max-h-32 overflow-auto rounded border border-amber-200 bg-amber-50 p-2">
          <div className="mb-1 text-xs font-semibold text-amber-800">
            오류/경고 {errors.length}건
          </div>
          <ul className="space-y-0.5 text-xs text-amber-800">
            {errors.slice(0, 50).map((e, i) => (
              <li key={i}>
                {e.row !== null ? `행 ${e.row}` : '헤더'}
                {e.field ? ` · ${e.field}` : ''} : {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.length > 0 ? (
        <div className="max-h-64 overflow-auto rounded border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {spec.columns.map((c) => (
                  <th
                    key={c.field}
                    className="whitespace-nowrap border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600"
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-slate-50/50">
                  {spec.columns.map((c) => (
                    <td
                      key={c.field}
                      className="whitespace-nowrap border-b border-slate-100 px-2 py-1 text-slate-700"
                    >
                      {dash(r[c.field] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          매핑된 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
