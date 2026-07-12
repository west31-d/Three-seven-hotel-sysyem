/** 체크인/체크아웃 명단 패널 (열: 예약코드/고객명/객실타입/인원/예약상태) */

import type { NormalizedReservation } from '@travel/domain';
import { dash } from '@travel/domain';
import { StatusBadge } from '../common/Badge';
import { EmptyState } from '../common/states';

interface CheckListProps {
  title: string;
  rows: NormalizedReservation[];
  emptyMessage: string;
}

export function CheckList({
  title,
  rows,
  emptyMessage,
}: CheckListProps): JSX.Element {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400">{rows.length}건</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-3">
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {['예약코드', '고객명', '객실타입', '인원', '예약상태'].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-slate-200 px-3 py-1.5 text-left text-xs font-semibold text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40"
                >
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-700">
                    {dash(r.예약코드)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                    {dash(r.고객명)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                    {dash(r.객실타입)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                    {dash(r.인원)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <StatusBadge status={r.예약상태} />
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
