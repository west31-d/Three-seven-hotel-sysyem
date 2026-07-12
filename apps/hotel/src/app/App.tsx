/** 앱 레이아웃 + 네비게이션 + 라우팅 */

import { NavLink, Route, Routes } from 'react-router-dom';
import { useApp } from './store';
import { Toasts } from '../components/common/Toasts';
import { LoadingState } from '../components/common/states';
import { DashboardPage } from '../pages/DashboardPage';
import { HisSourcePage } from '../pages/HisSourcePage';
import { BsSourcePage } from '../pages/BsSourcePage';
import { HanjinSourcePage } from '../pages/HanjinSourcePage';
import { IntegratedDbPage } from '../pages/IntegratedDbPage';

const TABS = [
  { to: '/', label: '대시보드', end: true },
  { to: '/source/his', label: '히스 원본', end: false },
  { to: '/source/bs', label: 'BS 원본', end: false },
  { to: '/source/hanjin', label: '한진 원본', end: false },
  { to: '/integrated', label: '통합 DB', end: false },
];

interface AppProps {
  /** 로그아웃 (로컬 모드면 사용하지 않음) */
  onSignOut?: () => void;
  /** 로그인 계정 (로컬 모드면 null) */
  email?: string | null;
}

export function App({ onSignOut, email }: AppProps): JSX.Element {
  const { state } = useApp();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-800">
              {state.hotel ?? '호텔'} 예약관리
            </span>
            {state.mode === 'local' ? (
              <span
                className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
                title="통합 DB 서버에 연결되어 있지 않습니다. 이 브라우저에만 저장됩니다."
              >
                로컬 모드
              </span>
            ) : (
              <span
                className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
                title="통합 DB 서버와 공유됩니다."
              >
                통합 DB 연결됨
              </span>
            )}
            {state.loading && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
                aria-label="처리 중"
              />
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {email && onSignOut && (
              <>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4">
          <ul className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `inline-block border-b-2 px-3 py-2 text-sm ${
                      isActive
                        ? 'border-slate-800 font-semibold text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!state.ready ? (
          <LoadingState message="초기화 중…" />
        ) : (
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/source/his" element={<HisSourcePage />} />
            <Route path="/source/bs" element={<BsSourcePage />} />
            <Route path="/source/hanjin" element={<HanjinSourcePage />} />
            <Route path="/integrated" element={<IntegratedDbPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        )}
      </main>

      <Toasts />
    </div>
  );
}
