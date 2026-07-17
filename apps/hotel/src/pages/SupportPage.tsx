/**
 * 고객센터 화면.
 * 오류/문의를 기록하고, 처리 상태(미해결/해결됨)를 표시·변경한다.
 * 이 호텔의 기록만 보이며, 본사(central 앱)는 모든 호텔의 기록을 조회 전용으로 볼 수 있다.
 */

import { useMemo, useState, type ClipboardEvent, type FormEvent } from 'react';
import type { TicketStatus } from '@travel/data';
import { useApp } from '../app/store';
import { EmptyState } from '../components/common/states';
import { Modal } from '../components/common/Modal';

type StatusFilter = 'all' | TicketStatus;

/** 붙여넣은 이미지를 리사이즈/압축해 data URL 로 변환한다(용량이 그대로 저장되지 않도록). */
async function imageFileToDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

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
  const [image, setImage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (statusFilter === 'all') return state.tickets;
    return state.tickets.filter((t) => t.status === statusFilter);
  }, [state.tickets, statusFilter]);

  const selected = selectedId
    ? (state.tickets.find((t) => t.id === selectedId) ?? null)
    : null;

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
        image,
      );
      setTitle('');
      setContent('');
      setReporter('');
      setImage(null);
    } catch {
      /* 오류 토스트는 store 에서 처리 */
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasteImage = async (e: ClipboardEvent<HTMLTextAreaElement>): Promise<void> => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
      i.type.startsWith('image/'),
    );
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    e.preventDefault();
    setImageBusy(true);
    try {
      setImage(await imageFileToDataUrl(file));
    } catch {
      actions.pushToast({ type: 'error', message: '이미지를 첨부하지 못했습니다.' });
    } finally {
      setImageBusy(false);
    }
  };

  const toggleStatus = (id: string, current: TicketStatus): void => {
    void actions.setTicketStatus(id, current === '해결됨' ? '미해결' : '해결됨');
  };

  const handleDelete = (id: string): void => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    void actions.deleteTicket(id);
    setSelectedId((cur) => (cur === id ? null : cur));
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
            onPaste={(e) => void handlePasteImage(e)}
            placeholder="어떤 상황에서 어떤 문제가 있었는지 적어주세요. 스크린샷은 이 안에 Ctrl+V로 붙여넣을 수 있습니다."
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          {imageBusy && <p className="text-xs text-slate-400">이미지 처리 중…</p>}
          {image && (
            <div className="relative w-fit">
              <img
                src={image}
                alt="첨부 미리보기"
                className="max-h-40 rounded border border-slate-200"
              />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-white hover:bg-slate-700"
                aria-label="첨부 이미지 제거"
              >
                ✕
              </button>
            </div>
          )}
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

      {/* 목록: 제목/상태만 간단히 보여주고, 클릭하면 자세히 본다 */}
      {visible.length === 0 ? (
        <EmptyState message="기록이 없습니다." />
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

      {/* 상세 보기 */}
      <Modal open={selected !== null} onClose={() => setSelectedId(null)} labelledBy="ticket-detail-title">
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                    selected.status,
                  )}`}
                >
                  {selected.status}
                </span>
                <h3 id="ticket-detail-title" className="text-sm font-semibold text-slate-800">
                  {selected.title}
                </h3>
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

            <p className="whitespace-pre-wrap text-sm text-slate-600">{selected.content}</p>

            {selected.image && (
              <a href={selected.image} target="_blank" rel="noreferrer">
                <img
                  src={selected.image}
                  alt="첨부 이미지"
                  className="max-h-96 w-full rounded border border-slate-200 object-contain"
                />
              </a>
            )}

            <div className="text-xs text-slate-400">
              {selected.reporter && <span>{selected.reporter} · </span>}
              {fmtDateTime(selected.createdAt)}
              {selected.updatedAt !== selected.createdAt && (
                <span> (수정: {fmtDateTime(selected.updatedAt)})</span>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => handleDelete(selected.id)}
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(selected.id, selected.status)}
                className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                {selected.status === '해결됨' ? '미해결로 변경' : '해결됨으로 변경'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
