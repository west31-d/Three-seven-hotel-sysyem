/** 토스트 알림 표시 (스토어의 toasts 렌더링, 자동 소멸) */

import { useEffect } from 'react';
import { useApp, type ToastMessage } from '../../app/store';

const AUTO_DISMISS_MS = 4000;

function ToastItem({ toast }: { toast: ToastMessage }): JSX.Element {
  const { actions } = useApp();
  useEffect(() => {
    const t = setTimeout(() => actions.dismissToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast.id, actions]);

  const color =
    toast.type === 'error'
      ? 'border-red-300 bg-red-50 text-red-800'
      : toast.type === 'success'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
        : 'border-slate-300 bg-white text-slate-800';

  return (
    <div
      role="status"
      className={`pointer-events-auto w-80 rounded border px-3 py-2 text-sm shadow-sm ${color}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{toast.message}</div>
          {toast.detail && (
            <div className="mt-0.5 break-words text-xs opacity-80">
              {toast.detail}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="닫기"
          className="shrink-0 rounded px-1 text-xs opacity-60 hover:opacity-100"
          onClick={() => actions.dismissToast(toast.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function Toasts(): JSX.Element {
  const { state } = useApp();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
