/**
 * 본사(central) 전용 고객센터 조회 화면. 모든 호텔의 기록을 읽기 전용으로 본다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSupabase,
  loadCentralSupportTickets,
  type CentralSupportTicket,
  type Hotel,
  type TicketStatus,
} from '@travel/data';

type StatusFilter = 'all' | TicketStatus;

function statusBadgeClass(status: TicketStatus): string {
  return status === '해결됨'
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function SupportView({ hotels }: { hotels: Hotel[] }): JSX.Element {
  const [tickets, setTickets] = useState<CentralSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotelFilter, setHotelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    try {
      setTickets(await loadCentralSupportTickets(sb, hotels));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [hotels]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (hotelFilter === '' || t.hotel === hotelFilter) &&
          (statusFilter === 'all' || t.status === statusFilter),
      ),
    [tickets, hotelFilter, statusFilter],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (tickets.find((t) => t.id === selectedId) ?? null) : null;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={hotelFilter}
          onChange={(e) => setHotelFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">전체 호텔</option>
          {hotels.map((h) => (
            <option key={h.id} value={h.name}>
              {h.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded border border-slate-200 bg-white p-0.5 text-sm">
          {(
            [
              ['all', '전체'],
              ['미해결', '미해결'],
              ['해결됨', '해결됨'],
            ] as [StatusFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded px-3 py-1 ${
                statusFilter === value
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>

      <div className="text-xs text-slate-500">표시 {visible.length}건</div>

      {visible.length === 0 && !loading ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          기록이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {visible.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                    t.status,
                  )}`}
                >
                  {t.status}
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {t.hotel}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {t.title}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {t.reporter && <span>{t.reporter} · </span>}
                  {fmtDateTime(t.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 상세 보기 (조회 전용) */}
      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="mt-10 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                    selected.status,
                  )}`}
                >
                  {selected.status}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {selected.hotel}
                </span>
                <h3 className="text-sm font-semibold text-slate-800">{selected.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="닫기"
                className="rounded px-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{selected.content}</p>
            {selected.image && (
              <a href={selected.image} target="_blank" rel="noreferrer" className="mt-3 block">
                <img
                  src={selected.image}
                  alt="첨부 이미지"
                  className="max-h-96 w-full rounded border border-slate-200 object-contain"
                />
              </a>
            )}
            <div className="mt-3 text-xs text-slate-400">
              {selected.reporter && <span>{selected.reporter} · </span>}
              {fmtDateTime(selected.createdAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
