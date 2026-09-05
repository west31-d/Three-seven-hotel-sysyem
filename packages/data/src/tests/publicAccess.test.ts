import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRepository } from '../createRepository';
import { createSupportRepository } from '../createSupportRepository';
import { SupabaseReservationRepository } from '../SupabaseReservationRepository';
import { SupabaseSupportRepository } from '../SupabaseSupportRepository';
import { IndexedDbReservationRepository } from '../IndexedDbReservationRepository';

const clients = vi.hoisted(() => ({ publicClient: null as unknown, sessionClient: null as unknown }));
vi.mock('../supabaseClient', () => ({
  getPublicSupabase: () => clients.publicClient,
  getSupabase: () => clients.sessionClient,
}));
const hotel = { id: '7d2b4633-4873-4a47-aef1-55979e3de151', code: 'THREE_SEVEN', name: 'Hotel' };

beforeEach(() => { clients.publicClient = null; clients.sessionClient = null; });

describe('public reservation access', () => {
  it('opens both shared repositories without a login session', () => {
    clients.publicClient = {};
    const handle = createRepository(null, hotel);
    expect(handle.mode).toBe('supabase');
    expect(handle.hotel).toBe(hotel.name);
    expect(handle.repo).toBeInstanceOf(SupabaseReservationRepository);
    expect(createSupportRepository(null, hotel)).toBeInstanceOf(SupabaseSupportRepository);
  });

  it('keeps local storage when Supabase is not configured', () => {
    expect(createRepository(null).repo).toBeInstanceOf(IndexedDbReservationRepository);
  });

  it('passes the hotel to both bulk operations and propagates server failures', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const repo = new SupabaseReservationRepository({ rpc } as unknown as SupabaseClient, hotel.id);
    await repo.replaceRows('HIS', []);
    await repo.appendRows('BS', []);
    expect(rpc).toHaveBeenNthCalledWith(1, 'replace_source', { p_hotel_id: hotel.id, p_source: 'HIS', p_rows: [] });
    expect(rpc).toHaveBeenNthCalledWith(2, 'append_source', { p_hotel_id: hotel.id, p_source: 'BS', p_rows: [] });
    rpc.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(repo.replaceRows('HIS', [])).rejects.toThrow('permission denied');
  });
});
