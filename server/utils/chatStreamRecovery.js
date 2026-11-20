export function shouldRetryChatStream({ attempt, maxRetries, emittedChunk }) {
  return !emittedChunk && attempt < maxRetries;
}

export function chatStreamErrorEvent(emittedChunk) {
  return emittedChunk
    ? { type: 'error', code: 'CHAT_STREAM_INTERRUPTED', message: 'The response was interrupted. Your prompt was kept so you can retry.' }
    : { type: 'error', code: 'CHAT_GENERATION_FAILED', message: 'The response could not be completed. Please try again.' };
}
