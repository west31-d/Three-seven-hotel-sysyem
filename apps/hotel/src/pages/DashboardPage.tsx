/** 예약관리 대시보드 페이지 */

import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import {
  countCheckIn,
  countCheckOut,
  countDuplicate,
  countTotal,
  checkInList,
  checkOutList,
  searchReservations,
} from '@travel/domain';
import { KpiCards } from '../components/dashboard/KpiCards';
import { DateControls } from '../components/dashboard/DateControls';
import { CheckList } from '../components/dashboard/CheckList';
import { SearchResults } from '../components/dashboard/SearchResults';

export function DashboardPage(): JSX.Element {
  const { state, actions } = useApp();
  const [query, setQuery] = useState('');

  const { reservations, selectedDate } = state;

  const kpi = useMemo(
    () => ({
      checkIn: countCheckIn(reservations, selectedDate),
      checkOut: countCheckOut(reservations, selectedDate),
      total: countTotal(reservations),
      duplicate: countDuplicate(reservations),
    }),
    [reservations, selectedDate],
  );

  const checkIns = useMemo(
    () => checkInList(reservations, selectedDate),
    [reservations, selectedDate],
  );
  const checkOuts = useMemo(
    () => checkOutList(reservations, selectedDate),
    [reservations, selectedDate],
  );
  const searchResult = useMemo(
    () => searchReservations(reservations, query),
    [reservations, query],
  );

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-800">예약관리 대시보드</h2>
        <p className="text-sm text-slate-500">
          조회일 <span className="font-medium text-slate-700">{selectedDate}</span>{' '}
          기준 체크인/체크아웃 현황
        </p>
      </header>

      <DateControls
        selectedDate={selectedDate}
        onDateChange={(d) => void actions.setSelectedDate(d)}
        onPrev={() => void actions.prevDay()}
        onToday={() => void actions.today()}
        onNext={() => void actions.nextDay()}
        onRefresh={() => void actions.refresh()}
        loading={state.loading}
        query={query}
        onQuery={setQuery}
      />

      <KpiCards {...kpi} />

      <SearchResults result={searchResult} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CheckList
          title="조회일 체크인"
          rows={checkIns}
          emptyMessage="조회일 체크인 없음"
        />
        <CheckList
          title="조회일 체크아웃"
          rows={checkOuts}
          emptyMessage="조회일 체크아웃 없음"
        />
      </div>
    </section>
  );
}
