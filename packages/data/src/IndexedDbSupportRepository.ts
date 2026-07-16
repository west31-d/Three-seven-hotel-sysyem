/** IndexedDB(Dexie) 기반 SupportRepository 구현(로컬 모드). */

import { newId } from '@travel/domain';
import { AppDatabase, db as defaultDb } from './database';
import type { SupportRepository, SupportTicket, TicketStatus } from './SupportRepository';

export class IndexedDbSupportRepository implements SupportRepository {
  private readonly db: AppDatabase;

  constructor(database: AppDatabase = defaultDb) {
    this.db = database;
  }

  async listTickets(): Promise<SupportTicket[]> {
    const rows = await this.db.tickets.orderBy('createdAt').reverse().toArray();
    return rows.map((r) => ({ ...r, status: r.status as TicketStatus }));
  }

  async createTicket(input: {
    title: string;
    content: string;
    reporter: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.tickets.put({
      id: newId('ticket'),
      title: input.title,
      content: input.content,
      status: '미해결',
      reporter: input.reporter,
      createdAt: now,
      updatedAt: now,
    });
  }

  async setTicketStatus(id: string, status: TicketStatus): Promise<void> {
    await this.db.tickets.update(id, { status, updatedAt: new Date().toISOString() });
  }

  async deleteTicket(id: string): Promise<void> {
    await this.db.tickets.delete(id);
  }
}
