/** 앱 레이아웃 + 네비게이션 + 라우팅 */

import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './store';
import { Toasts } from '../components/common/Toasts';
import { LoadingState } from '../components/common/states';
import { DashboardPage } from '../pages/DashboardPage';
import { HisSourcePage } from '../pages/HisSourcePage';
import { BsSourcePage } from '../pages/BsSourcePage';
import { HanjinSourcePage } from '../pages/HanjinSourcePage';
import { IntegratedDbPage } from '../pages/IntegratedDbPage';
import { SupportPage } from '../pages/SupportPage';

const SOURCE_TABS = [
  { to: '/source/his', label: '히스' },
  { to: '/source/bs', label: 'BS' },
  { to: '/source/hanjin', label: '한진' },
];

/** 히스/BS/한진 원본을 한데 묶은 드롭다운 메뉴 */
function DataMenu(): JSX.Element {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = location.pathname.startsWith('/source/');

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 border-b-2 px-3 py-2 text-sm ${
          active
            ? 'border-slate-800 font-semibold text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        데이터
        <span className="text-[10px] text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-10 mt-1 min-w-[7rem] rounded border border-slate-200 bg-white py-1 shadow-lg">
          {SOURCE_TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  `block px-3 py-1.5 text-sm ${
                    isActive
                      ? 'bg-slate-50 font-semibold text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function App(): JSX.Element {
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
            <NavLink
              to="/support"
              className={({ isActive }) =>
                `rounded border px-3 py-1.5 text-sm ${
                  isActive
                    ? 'border-slate-800 font-semibold text-slate-900'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              고객센터
            </NavLink>
            <a
              href="https://app.notion.com/p/3a0cc13e79b5806888a2e0bc3cce0885"
              target="_blank"
              rel="noreferrer"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              사용법
            </a>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4">
          <ul className="flex flex-wrap items-stretch gap-1">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `inline-block border-b-2 px-3 py-2 text-sm ${
                    isActive
                      ? 'border-slate-800 font-semibold text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                대시보드
              </NavLink>
            </li>
            <li>
              <DataMenu />
            </li>
            <li>
              <NavLink
                to="/integrated"
                className={({ isActive }) =>
                  `inline-block border-b-2 px-3 py-2 text-sm ${
                    isActive
                      ? 'border-slate-800 font-semibold text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                DB
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!state.ready ? (
          <LoadingState message="초기화 중…" />
        ) : (
          <Routes>
            <Route path="/support" element={<SupportPage />} />
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
