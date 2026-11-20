import { describe, it, expect, vi } from 'vitest';
import { saveChatMessagesWithRetry } from '../utils/chatSave.js';

function supabaseWith(insertImpl) {
  const insert = vi.fn(insertImpl);
  return { client: { from: () => ({ insert }) }, insert };
}

const rows = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }];
const ctx = { convId: 'c1', userId: 'u1', contentLen: 5 };

describe('saveChatMessagesWithRetry', () => {
  it('returns true on first success and inserts once', async () => {
    const { client, insert } = supabaseWith(() => Promise.resolve({ error: null }));
    const ok = await saveChatMessagesWithRetry(client, rows, ctx, 3, 0);
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('retries then succeeds', async () => {
    let n = 0;
    const { client, insert } = supabaseWith(() => {
      n += 1;
      return Promise.resolve(n < 3 ? { error: { message: 'transient' } } : { error: null });
    });
    const ok = await saveChatMessagesWithRetry(client, rows, ctx, 3, 0);
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it('returns false after exhausting all attempts', async () => {
    const { client, insert } = supabaseWith(() => Promise.resolve({ error: { message: 'down' } }));
    const ok = await saveChatMessagesWithRetry(client, rows, ctx, 3, 0);
    expect(ok).toBe(false);
    expect(insert).toHaveBeenCalledTimes(3);
  });
});
