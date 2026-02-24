/**
 * SSE Stream Parser
 *
 * Extracts the Server-Sent Events parsing logic from ReMarketingChat
 * into a testable, reusable utility. Handles line-by-line buffering,
 * [DONE] sentinel detection, and JSON delta extraction.
 */

export interface SSEParserCallbacks {
  onContent: (content: string) => void;
  onDone: () => void;
  onError?: (error: Error) => void;
}

export interface SSEParserState {
  buffer: string;
  done: boolean;
}

/**
 * Process a chunk of raw SSE text and extract content deltas.
 *
 * Returns the updated parser state. When `state.done` is true,
 * the caller should stop reading from the stream.
 */
export function processSSEChunk(
  chunk: string,
  state: SSEParserState,
  callbacks: SSEParserCallbacks,
): SSEParserState {
  if (state.done) return state;

  let buffer = state.buffer + chunk;
  let done = false;

  let newlineIndex: number;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    let line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);

    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line.startsWith(':') || line.trim() === '') continue;
    if (!line.startsWith('data: ')) continue;

    const jsonStr = line.slice(6).trim();
    if (jsonStr === '[DONE]') {
      done = true;
      callbacks.onDone();
      break;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const content = parsed.choices?.[0]?.delta?.content as string | undefined;
      if (content) {
        callbacks.onContent(content);
      }
    } catch {
      // Incomplete JSON — will be completed in next chunk
    }
  }

  return { buffer, done };
}

/**
 * Flush any remaining buffered content after the stream closes.
 * Handles partial lines that didn't end with a newline.
 */
export function flushSSEBuffer(
  buffer: string,
  callbacks: Pick<SSEParserCallbacks, 'onContent'>,
): void {
  if (!buffer.trim()) return;

  for (let raw of buffer.split('\n')) {
    if (!raw) continue;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.startsWith(':') || raw.trim() === '') continue;
    if (!raw.startsWith('data: ')) continue;
    const jsonStr = raw.slice(6).trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const content = parsed.choices?.[0]?.delta?.content as string | undefined;
      if (content) {
        callbacks.onContent(content);
      }
    } catch {
      /* ignore incomplete JSON at end of stream */
    }
  }
}
