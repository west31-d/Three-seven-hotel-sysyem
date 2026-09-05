import { useEffect, useState } from 'react';
import { getPublicSupabase, type Hotel } from '@travel/data';
import { AppProvider } from './store';
import { App } from './App';

/** 공개 호텔을 조회한 다음 공유 저장소를 연다. 서버 오류 시 로컬로 전환하지 않는다. */
export function PublicHotelApp(): JSX.Element {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sb = getPublicSupabase();

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const code = (import.meta.env.VITE_PUBLIC_HOTEL_CODE as string | undefined) || 'THREE_SEVEN';
        const { data, error: queryError } = await sb.from('hotels')
          .select('id, code, name').eq('code', code).maybeSingle<Hotel>();
        if (queryError) throw new Error(queryError.message);
        if (!data) throw new Error(`호텔 ${code}를 찾을 수 없습니다. Supabase 공개 접근 SQL 적용과 호텔 코드를 확인하세요.`);
        if (!cancelled) setHotel(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => { cancelled = true; };
  }, [sb, attempt]);

  if (sb && !hotel) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-slate-700">
      <p>{error ? '공유 예약 DB에 연결하지 못했습니다.' : '공유 예약 DB에 연결 중…'}</p>
      {error && <><p className="text-sm">{error}</p><button className="rounded border px-4 py-2" onClick={() => setAttempt((n) => n + 1)}>다시 연결</button></>}
    </div>
  );
  return <AppProvider publicHotel={hotel}><App /></AppProvider>;
}
