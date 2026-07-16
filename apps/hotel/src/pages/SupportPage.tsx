/**
 * 고객센터 화면.
 * 오류/문의를 기록하고, 처리 상태(미해결/해결됨)를 표시·변경한다.
 * 이 호텔의 기록만 보이며, 본사(central 앱)는 모든 호텔의 기록을 조회 전용으로 볼 수 있다.
 */

import { useMemo, useState, type FormEvent } from 'react';
import type { TicketStatus } from '@travel/data';
import { useApp } from '../app/store';
import { EmptyState } from '../components/common/states';

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

export function SupportPage(): JSX.Element {
  const { state, actions } = useApp();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reporter, setReporter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const visible = useMemo(() => {
    if (statusFilter === 'all') return state.tickets;
    return state.tickets.filter((t) => t.status === statusFilter);
  }, [state.tickets, statusFilter]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (trimmedTitle.length === 0 || trimmedContent.length === 0) return;

    setSubmitting(true);
    try {
      await actions.createTicket(
        trimmedTitle,
        trimmedContent,
        reporter.trim().length > 0 ? reporter.trim() : null,
      );
      setTitle('');
      setContent('');
      setReporter('');
    } catch {
      /* 오류 토스트는 store 에서 처리 */
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = (id: string, current: TicketStatus): void => {
    void actions.setTicketStatus(id, current === '해결됨' ? '미해결' : '해결됨');
  };

  const handleDelete = (id: string): void => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    void actions.deleteTicket(id);
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-800">고객센터</h2>
        <p className="text-sm text-slate-500">
          오류나 문의사항이 있으면 기록해두세요. 처리되면 상태를 '해결됨'으로 바꿀 수 있습니다.
        </p>
      </header>

      {/* 작성 폼 */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="ticket-title">
            제목
          </label>
          <input
            id="ticket-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 히스 붙여넣기 시 오류가 발생함"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="ticket-content">
            내용
          </label>
          <textarea
            id="ticket-content"
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="어떤 상황에서 어떤 문제가 있었는지 적어주세요."
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="ticket-reporter">
              작성자 (선택)
            </label>
            <input
              id="ticket-reporter"
              type="text"
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="이름"
              className="w-40 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? '등록 중…' : '기록 추가'}
          </button>
        </div>
      </form>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
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
        <div className="text-xs text-slate-500">
          전체 {state.tickets.length}건 · 미해결{' '}
          {state.tickets.filter((t) => t.status === '미해결').length}건
        </div>
        <button
          type="button"
          onClick={() => void actions.refreshTickets()}
          className="ml-auto rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      {/* 목록 */}
      {visible.length === 0 ? (
        <EmptyState message="기록이 없습니다." />
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                      t.status,
                    )}`}
                  >
                    {t.status}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800">{t.title}</h3>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleStatus(t.id, t.status)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {t.status === '해결됨' ? '미해결로 변경' : '해결됨으로 변경'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{t.content}</p>
              <div className="mt-2 text-xs text-slate-400">
                {t.reporter && <span>{t.reporter} · </span>}
                {fmtDateTime(t.createdAt)}
                {t.updatedAt !== t.createdAt && (
                  <span> (수정: {fmtDateTime(t.updatedAt)})</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
