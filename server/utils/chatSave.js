// Persist chat messages with bounded retry. The streaming chat handler saves
// the user+assistant messages AFTER the SSE stream has ended, so a fire-and-
// forget insert that fails would silently lose the exchange. This retries with
// exponential backoff and, on persistent failure, logs enough context to recover.

export async function saveChatMessagesWithRetry(supabase, rows, ctx, attempts = 3, baseDelayMs = 250) {
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.from('chat_conversations').insert(rows);
    if (!error) return true;
    console.error(`[Stream] save attempt ${i + 1}/${attempts} failed for ${ctx?.convId}:`, error);
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  // All attempts failed — log loudly with enough context to recover the message.
  console.error('[Stream] PERSISTENT save failure — message lost', {
    convId: ctx?.convId,
    userId: ctx?.userId,
    contentLen: ctx?.contentLen,
  });
  return false;
}
