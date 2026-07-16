/**
 * 고객센터(오류/문의) 저장소 인터페이스.
 *
 * hotel 앱에서 작성/조회/상태변경/삭제하고, central 앱은 별도의
 * CentralSupportReader(loadCentralSupportTickets) 로 전체 호텔을 읽기 전용 조회한다.
 */

export type TicketStatus = '미해결' | '해결됨';

export interface SupportTicket {
  id: string;
  title: string;
  content: string;
  status: TicketStatus;
  /** 작성자가 직접 입력한 이름 등(선택, 로그인 계정과 무관) */
  reporter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportRepository {
  /** 최신순 조회 */
  listTickets(): Promise<SupportTicket[]>;

  /** 새 기록 추가 (상태는 항상 '미해결'로 시작) */
  createTicket(input: { title: string; content: string; reporter: string | null }): Promise<void>;

  /** 처리 상태 변경 */
  setTicketStatus(id: string, status: TicketStatus): Promise<void>;

  /** 기록 삭제 */
  deleteTicket(id: string): Promise<void>;
}
