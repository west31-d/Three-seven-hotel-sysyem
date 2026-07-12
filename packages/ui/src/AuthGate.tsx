/**
 * 인증 게이트.
 *
 * - Supabase 가 설정되어 있지 않으면: 로그인 없이 '로컬 모드'로 바로 앱을 띄운다.
 *   (설정 전에도 바로 실행해 볼 수 있게)
 * - 설정되어 있으면: 로그인해야 앱이 열린다. 세션을 아래로 내려준다.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  getSupabase,
  isSupabaseConfigured,
  loadSession,
  signIn,
  signOut,
  type Session,
} from '@travel/data';

interface AuthGateProps {
  /** 본사(is_central) 계정만 허용할지 (통합 화면에서 사용) */
  requireCentral?: boolean;
  title: string;
  children: (ctx: { session: Session | null; onSignOut: () => void }) => ReactNode;
}

export function AuthGate({
  requireCentral = false,
  title,
  children,
}: AuthGateProps): JSX.Element {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSession(await loadSession());
      setError(null);
    } catch (e) {
      setSession(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    void reload();
    const sb = getSupabase();
    const sub = sb?.auth.onAuthStateChange(() => {
      void reload();
    });
    return () => sub?.data.subscription.unsubscribe();
  }, [configured, reload]);

  const handleSignOut = useCallback(() => {
    void signOut().then(() => setSession(null));
  }, []);

  // Supabase 미설정 → 로컬 모드
  if (!configured) {
    return <>{children({ session: null, onSignOut: handleSignOut })}</>;
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        확인 중…
      </div>
    );
  }

  if (session && requireCentral && !session.profile.is_central) {
    return (
      <Centered>
        <p className="text-sm text-slate-700">
          이 화면은 본사(통합) 계정만 볼 수 있습니다.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          다른 계정으로 로그인
        </button>
      </Centered>
    );
  }

  if (session && !requireCentral && !session.profile.hotel_id) {
    return (
      <Centered>
        <p className="text-sm text-slate-700">
          이 계정에는 호텔이 배정되어 있지 않습니다. (본사 계정은 통합 화면을
          사용하세요.)
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          다른 계정으로 로그인
        </button>
      </Centered>
    );
  }

  if (session) {
    return <>{children({ session, onSignOut: handleSignOut })}</>;
  }

  const handleLogin = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Centered>
      <h1 className="mb-1 text-lg font-semibold text-slate-800">{title}</h1>
      <p className="mb-4 text-sm text-slate-500">로그인이 필요합니다.</p>
      <form onSubmit={(e) => void handleLogin(e)} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6">
        {children}
      </div>
    </div>
  );
}
