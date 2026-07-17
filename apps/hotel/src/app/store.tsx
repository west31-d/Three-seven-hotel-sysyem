/**
 * 애플리케이션 데이터 스토어 (React Context).
 *
 * UI 와 저장소/도메인 사이의 유일한 접점.
 * - 원본 세 배열과 파생 통합 예약을 보관한다.
 * - 파생 예약은 저장하지 않고 원본 변경 시마다 재계산한다.
 * - 조회일(selectedDate)은 저장소에 보존/복원한다.
 *
 * 컴포넌트는 repository 를 직접 호출하지 않고 이 스토어의 actions 만 사용한다.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  NormalizedReservation,
  RawBsRow,
  RawHanjinRow,
  RawHisRow,
  SourceType,
} from '@travel/domain';
import type {
  RawRowMap,
  ReservationRepository,
  Session,
  StorageMode,
  SupportRepository,
  SupportTicket,
  TicketStatus,
} from '@travel/data';
import {
  createRepository,
  createSupportRepository,
  refreshReservations,
} from '@travel/data';
import { todayDateOnly, addDaysDateOnly } from '@travel/domain';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  detail?: string;
}

interface AppState {
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** 'supabase' = 통합 DB 서버와 공유, 'local' = 이 브라우저에만 저장 */
  mode: StorageMode;
  /** 이 사이트의 호텔 이름 (로컬 모드면 null) */
  hotel: string | null;
  reservations: NormalizedReservation[];
  his: RawHisRow[];
  bs: RawBsRow[];
  hanjin: RawHanjinRow[];
  /** 통합 DB 화면에서 수동으로 확인 체크한 예약 id(NormalizedReservation.id) 집합 */
  checkedIds: Set<string>;
  /** 고객센터(오류/문의) 기록, 최신순 */
  tickets: SupportTicket[];
  selectedDate: string;
  toasts: ToastMessage[];
}

interface AppActions {
  refresh(): Promise<void>;
  setSelectedDate(date: string): Promise<void>;
  prevDay(): Promise<void>;
  nextDay(): Promise<void>;
  today(): Promise<void>;
  addRow<S extends SourceType>(source: S, row: RawRowMap[S]): Promise<void>;
  updateRow<S extends SourceType>(source: S, row: RawRowMap[S]): Promise<void>;
  deleteRow(source: SourceType, id: string): Promise<void>;
  replaceSource<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void>;
  appendSource<S extends SourceType>(
    source: S,
    rows: RawRowMap[S][],
  ): Promise<void>;
  clearSource(source: SourceType): Promise<void>;
  setChecked(id: string, checked: boolean): Promise<void>;
  refreshTickets(): Promise<void>;
  createTicket(
    title: string,
    content: string,
    reporter: string | null,
    image: string | null,
  ): Promise<void>;
  setTicketStatus(id: string, status: TicketStatus): Promise<void>;
  deleteTicket(id: string): Promise<void>;
  pushToast(t: Omit<ToastMessage, 'id'>): void;
  dismissToast(id: number): void;
}

interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastSeq = 1;

export function AppProvider({
  children,
  session = null,
  repository,
}: {
  children: ReactNode;
  /** 로그인 세션 (없으면 로컬 모드) */
  session?: Session | null;
  /** 테스트에서 저장소를 직접 주입할 때 사용 */
  repository?: ReservationRepository;
}): JSX.Element {
  // 세션에 맞는 저장소 선택: 로그인 + Supabase 설정 → 공유 DB, 아니면 로컬(IndexedDB)
  const handle = useMemo(() => createRepository(session), [session]);
  const repoRef = useRef<ReservationRepository>(repository ?? handle.repo);
  const hotelRef = useRef<string | null>(handle.hotel);
  const supportRepoRef = useRef<SupportRepository>(createSupportRepository(session));

  // 세션이 바뀌면(로그인/로그아웃) 저장소를 갈아끼운다
  useEffect(() => {
    repoRef.current = repository ?? handle.repo;
    hotelRef.current = handle.hotel;
    supportRepoRef.current = createSupportRepository(session);
  }, [handle, repository, session]);

  const [state, setState] = useState<AppState>({
    ready: false,
    loading: true,
    error: null,
    mode: repository ? 'local' : handle.mode,
    hotel: handle.hotel,
    reservations: [],
    his: [],
    bs: [],
    hanjin: [],
    checkedIds: new Set(),
    tickets: [],
    selectedDate: todayDateOnly(),
    toasts: [],
  });

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    setState((s) => ({ ...s, toasts: [...s.toasts, { ...t, id: toastSeq++ }] }));
  }, []);

  const dismissToast = useCallback((id: number) => {
    setState((s) => ({ ...s, toasts: s.toasts.filter((x) => x.id !== id) }));
  }, []);

  /** 저장소에서 원본을 읽어 파생 예약 재계산 후 상태 반영 */
  const recompute = useCallback(async () => {
    const repo = repoRef.current;
    const out = await refreshReservations(
      repo,
      new Date().getFullYear(),
      hotelRef.current,
    );
    setState((s) => ({
      ...s,
      reservations: out.reservations,
      his: out.his,
      bs: out.bs,
      hanjin: out.hanjin,
      checkedIds: out.checkedIds,
      error: null,
    }));
  }, []);

  const refresh = useCallback(async () => {
    // 성공 시작 toast (원본 규칙 문구 유지)
    pushToast({ type: 'success', message: '새로고침을 시작했습니다.' });
    setState((s) => ({ ...s, loading: true }));
    try {
      await recompute();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: detail }));
      pushToast({
        type: 'error',
        message: '새로고침 중 오류가 발생했습니다.',
        detail,
      });
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [recompute, pushToast]);

  const setSelectedDate = useCallback(async (date: string) => {
    setState((s) => ({ ...s, selectedDate: date }));
    try {
      await repoRef.current.setSelectedDate(date);
    } catch {
      /* 저장 실패는 조회에 영향 없음 */
    }
  }, []);

  const prevDay = useCallback(async () => {
    setState((s) => {
      const next = addDaysDateOnly(s.selectedDate, -1);
      void repoRef.current.setSelectedDate(next);
      return { ...s, selectedDate: next };
    });
  }, []);

  const nextDay = useCallback(async () => {
    setState((s) => {
      const next = addDaysDateOnly(s.selectedDate, 1);
      void repoRef.current.setSelectedDate(next);
      return { ...s, selectedDate: next };
    });
  }, []);

  const today = useCallback(async () => {
    const next = todayDateOnly();
    await setSelectedDate(next);
  }, [setSelectedDate]);

  /** 원본 변경 후 자동으로 파생값 최신화 */
  const mutateThenRecompute = useCallback(
    async (fn: () => Promise<void>) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        await fn();
        await recompute();
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, error: detail }));
        pushToast({ type: 'error', message: '작업 중 오류가 발생했습니다.', detail });
        throw e;
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    [recompute, pushToast],
  );

  const addRow = useCallback(
    <S extends SourceType>(source: S, row: RawRowMap[S]) =>
      mutateThenRecompute(() => repoRef.current.putRow(source, row)),
    [mutateThenRecompute],
  );

  const updateRow = useCallback(
    <S extends SourceType>(source: S, row: RawRowMap[S]) =>
      mutateThenRecompute(() => repoRef.current.putRow(source, row)),
    [mutateThenRecompute],
  );

  const deleteRow = useCallback(
    (source: SourceType, id: string) =>
      mutateThenRecompute(() => repoRef.current.deleteRow(source, id)),
    [mutateThenRecompute],
  );

  const replaceSource = useCallback(
    <S extends SourceType>(source: S, rows: RawRowMap[S][]) =>
      mutateThenRecompute(() => repoRef.current.replaceRows(source, rows)),
    [mutateThenRecompute],
  );

  const appendSource = useCallback(
    <S extends SourceType>(source: S, rows: RawRowMap[S][]) =>
      mutateThenRecompute(() => repoRef.current.appendRows(source, rows)),
    [mutateThenRecompute],
  );

  const clearSource = useCallback(
    (source: SourceType) =>
      mutateThenRecompute(() => repoRef.current.clearSource(source)),
    [mutateThenRecompute],
  );

  /** 확인 여부는 통합 예약 재계산에 영향을 주지 않으므로 낙관적으로 갱신하고, 실패 시에만 되돌린다. */
  const setChecked = useCallback(
    async (id: string, checked: boolean) => {
      setState((s) => {
        const next = new Set(s.checkedIds);
        if (checked) next.add(id);
        else next.delete(id);
        return { ...s, checkedIds: next };
      });
      try {
        await repoRef.current.setChecked(id, checked);
      } catch (e) {
        setState((s) => {
          const next = new Set(s.checkedIds);
          if (checked) next.delete(id);
          else next.add(id);
          return { ...s, checkedIds: next };
        });
        const detail = e instanceof Error ? e.message : String(e);
        pushToast({ type: 'error', message: '확인 여부 저장에 실패했습니다.', detail });
      }
    },
    [pushToast],
  );

  /** 고객센터 기록을 새로 불러온다. 실패해도 나머지 화면에는 영향을 주지 않는다. */
  const refreshTickets = useCallback(async () => {
    try {
      const tickets = await supportRepoRef.current.listTickets();
      setState((s) => ({ ...s, tickets }));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      pushToast({ type: 'error', message: '고객센터 기록을 불러오지 못했습니다.', detail });
    }
  }, [pushToast]);

  const createTicket = useCallback(
    async (
      title: string,
      content: string,
      reporter: string | null,
      image: string | null,
    ) => {
      try {
        await supportRepoRef.current.createTicket({ title, content, reporter, image });
        await refreshTickets();
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        pushToast({ type: 'error', message: '기록을 저장하지 못했습니다.', detail });
        throw e;
      }
    },
    [refreshTickets, pushToast],
  );

  const setTicketStatus = useCallback(
    async (id: string, status: TicketStatus) => {
      try {
        await supportRepoRef.current.setTicketStatus(id, status);
        await refreshTickets();
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        pushToast({ type: 'error', message: '상태를 변경하지 못했습니다.', detail });
      }
    },
    [refreshTickets, pushToast],
  );

  const deleteTicket = useCallback(
    async (id: string) => {
      try {
        await supportRepoRef.current.deleteTicket(id);
        await refreshTickets();
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        pushToast({ type: 'error', message: '기록을 삭제하지 못했습니다.', detail });
      }
    },
    [refreshTickets, pushToast],
  );

  // 최초 로드(및 로그인/로그아웃 시): 조회일 복원 + 원본 로드 + 파생 계산
  useEffect(() => {
    let cancelled = false;
    const repo = repository ?? handle.repo;
    const hotel = handle.hotel;
    setState((s) => ({
      ...s,
      ready: false,
      loading: true,
      mode: repository ? 'local' : handle.mode,
      hotel,
    }));
    (async () => {
      try {
        const saved = await repo.getSelectedDate();
        const date = saved ?? todayDateOnly();
        const out = await refreshReservations(
          repo,
          new Date().getFullYear(),
          hotel,
        );
        if (cancelled) return;
        setState((s) => ({
          ...s,
          ready: true,
          loading: false,
          selectedDate: date,
          reservations: out.reservations,
          his: out.his,
          bs: out.bs,
          hanjin: out.hanjin,
          checkedIds: out.checkedIds,
        }));
      } catch (e) {
        if (cancelled) return;
        const detail = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, ready: true, loading: false, error: detail }));
      }
      // 고객센터 기록은 별도 저장소이므로 예약 로드와 무관하게 독립적으로 불러온다.
      void refreshTickets();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, repository]);

  const actions = useMemo<AppActions>(
    () => ({
      refresh,
      setSelectedDate,
      prevDay,
      nextDay,
      today,
      addRow,
      updateRow,
      deleteRow,
      replaceSource,
      appendSource,
      clearSource,
      setChecked,
      refreshTickets,
      createTicket,
      setTicketStatus,
      deleteTicket,
      pushToast,
      dismissToast,
    }),
    [
      refresh,
      setSelectedDate,
      prevDay,
      nextDay,
      today,
      addRow,
      updateRow,
      deleteRow,
      replaceSource,
      appendSource,
      clearSource,
      setChecked,
      refreshTickets,
      createTicket,
      setTicketStatus,
      deleteTicket,
      pushToast,
      dismissToast,
    ],
  );

  const value = useMemo<AppContextValue>(() => ({ state, actions }), [state, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
