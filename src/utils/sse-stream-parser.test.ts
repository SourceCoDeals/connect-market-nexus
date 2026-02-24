/**
 * Tests for sse-stream-parser.ts
 *
 * Validates the SSE stream parsing logic that was extracted from
 * ReMarketingChat to fix the thread freezing bug where [DONE]
 * only broke the inner loop, leaving the outer while(true) hanging.
 */
import { describe, it, expect, vi } from 'vitest';
import { processSSEChunk, flushSSEBuffer, type SSEParserState } from './sse-stream-parser';

// Helper to create a fresh parser state
function freshState(): SSEParserState {
  return { buffer: '', done: false };
}

describe('processSSEChunk', () => {
  it('extracts content from a complete SSE line', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n';
    const state = processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledWith('Hello');
    expect(onDone).not.toHaveBeenCalled();
    expect(state.done).toBe(false);
  });

  it('handles multiple lines in a single chunk', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk =
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' +
      'data: {"choices":[{"delta":{"content":" world"}}]}\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledTimes(2);
    expect(onContent).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onContent).toHaveBeenNthCalledWith(2, ' world');
  });

  it('sets done=true and calls onDone when [DONE] is received', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n' + 'data: [DONE]\n';
    const state = processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledWith('Hi');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(state.done).toBe(true);
  });

  it('stops processing lines after [DONE]', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk =
      'data: [DONE]\n' + 'data: {"choices":[{"delta":{"content":"should not appear"}}]}\n';
    const state = processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).not.toHaveBeenCalled();
    expect(state.done).toBe(true);
  });

  it('buffers incomplete lines across chunks', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();
    const callbacks = { onContent, onDone };

    // First chunk: incomplete line (no newline at end)
    const state1 = processSSEChunk('data: {"choices":[{"delta":{"con', freshState(), callbacks);
    expect(onContent).not.toHaveBeenCalled();
    expect(state1.buffer).toContain('data: {"choices":[{"delta":{"con');

    // Second chunk: completes the line
    const state2 = processSSEChunk('tent":"buffered"}}]}\n', state1, callbacks);
    expect(onContent).toHaveBeenCalledWith('buffered');
    expect(state2.done).toBe(false);
  });

  it('skips SSE comments (lines starting with ":")', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = ':keep-alive\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith('ok');
  });

  it('skips empty lines', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = '\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledTimes(1);
  });

  it('handles \\r\\n line endings', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = 'data: {"choices":[{"delta":{"content":"crlf"}}]}\r\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledWith('crlf');
  });

  it('skips non-data lines', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = 'event: message\ndata: {"choices":[{"delta":{"content":"ok"}}]}\nid: 1\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed JSON gracefully', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = 'data: {broken json\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith('ok');
  });

  it('is a no-op when state is already done', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const doneState: SSEParserState = { buffer: '', done: true };
    const state = processSSEChunk(
      'data: {"choices":[{"delta":{"content":"ignored"}}]}\n',
      doneState,
      { onContent, onDone },
    );

    expect(onContent).not.toHaveBeenCalled();
    expect(state.done).toBe(true);
  });

  it('handles choices with no delta content (e.g. role-only deltas)', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    const chunk = 'data: {"choices":[{"delta":{"role":"assistant"}}]}\n';
    processSSEChunk(chunk, freshState(), { onContent, onDone });

    expect(onContent).not.toHaveBeenCalled();
  });
});

describe('flushSSEBuffer', () => {
  it('processes remaining content in the buffer', () => {
    const onContent = vi.fn();

    flushSSEBuffer('data: {"choices":[{"delta":{"content":"tail"}}]}', { onContent });

    expect(onContent).toHaveBeenCalledWith('tail');
  });

  it('handles multiple lines in the buffer', () => {
    const onContent = vi.fn();

    flushSSEBuffer(
      'data: {"choices":[{"delta":{"content":"a"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"b"}}]}',
      { onContent },
    );

    expect(onContent).toHaveBeenCalledTimes(2);
  });

  it('skips [DONE] in buffer', () => {
    const onContent = vi.fn();

    flushSSEBuffer('data: [DONE]', { onContent });

    expect(onContent).not.toHaveBeenCalled();
  });

  it('is a no-op for empty buffer', () => {
    const onContent = vi.fn();
    flushSSEBuffer('', { onContent });
    expect(onContent).not.toHaveBeenCalled();
  });

  it('is a no-op for whitespace-only buffer', () => {
    const onContent = vi.fn();
    flushSSEBuffer('   \n  ', { onContent });
    expect(onContent).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON in buffer', () => {
    const onContent = vi.fn();
    flushSSEBuffer('data: not json at all', { onContent });
    expect(onContent).not.toHaveBeenCalled();
  });
});

describe('Thread freezing regression', () => {
  it('processSSEChunk returns done=true so outer loop exits', () => {
    // This is the core regression test for the thread-freezing bug.
    // Previously, [DONE] only broke the inner line-parsing loop,
    // but the outer while(true) in the component kept calling reader.read().
    // Now processSSEChunk sets state.done=true, and the component loop
    // condition is while(!parserState.done), so it exits immediately.

    const onContent = vi.fn();
    const onDone = vi.fn();

    // Simulate receiving content followed by [DONE] in chunks
    let state = freshState();
    state = processSSEChunk('data: {"choices":[{"delta":{"content":"part1"}}]}\n', state, {
      onContent,
      onDone,
    });
    expect(state.done).toBe(false); // Not done yet

    state = processSSEChunk(
      'data: {"choices":[{"delta":{"content":"part2"}}]}\ndata: [DONE]\n',
      state,
      { onContent, onDone },
    );
    expect(state.done).toBe(true); // NOW done — outer loop must exit
    expect(onDone).toHaveBeenCalled();
    expect(onContent).toHaveBeenCalledTimes(2);
  });

  it('[DONE] mid-buffer still sets done=true', () => {
    const onContent = vi.fn();
    const onDone = vi.fn();

    // [DONE] arrives in the middle of a chunk with trailing data
    const state = processSSEChunk(
      'data: {"choices":[{"delta":{"content":"x"}}]}\ndata: [DONE]\ndata: {"choices":[{"delta":{"content":"ghost"}}]}\n',
      freshState(),
      { onContent, onDone },
    );

    expect(state.done).toBe(true);
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith('x');
  });

  it('simulates full stream lifecycle without hanging', () => {
    const collected: string[] = [];
    const onDone = vi.fn();

    let state = freshState();

    // Chunk 1: partial data
    state = processSSEChunk('data: {"choices":[{"delta":{"content":"He', state, {
      onContent: (c) => collected.push(c),
      onDone,
    });
    expect(collected).toEqual([]);

    // Chunk 2: complete first line + start second
    state = processSSEChunk('llo"}}]}\ndata: {"choices":[{"delta":{"content":" wor', state, {
      onContent: (c) => collected.push(c),
      onDone,
    });
    expect(collected).toEqual(['Hello']);

    // Chunk 3: complete second line + [DONE]
    state = processSSEChunk('ld"}}]}\ndata: [DONE]\n', state, {
      onContent: (c) => collected.push(c),
      onDone,
    });
    expect(collected).toEqual(['Hello', ' world']);
    expect(state.done).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
