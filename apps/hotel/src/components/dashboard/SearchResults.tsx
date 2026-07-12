/** 검색 결과 표 (열: DB/예약코드/체크인/체크아웃/고객명/객실타입) */

import type { SearchResult } from '@travel/domain';
import { dash, fmtDate } from '@travel/domain';
import { DbBadge } from '../common/Badge';

interface SearchResultsProps {
  result: SearchResult;
}

export function SearchResults({ result }: SearchResultsProps): JSX.Element | null {
  // 검색어가 없으면 표를 감춘다.
  if (result.state === 'EMPTY_QUERY') return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-800">검색 결과</h3>
      </div>
      {result.state === 'NO_RESULT' ? (
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          검색 결과 없음
        </div>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {['DB', '예약코드', '체크인', '체크아웃', '고객명', '객실타입'].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-b border-slate-200 px-3 py-1.5 text-left text-xs font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40"
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
                    {dash(r.객실타입)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
