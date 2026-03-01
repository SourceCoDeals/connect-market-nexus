/**
 * SSE stream processing for the AI Command Center
 */

import type {
  AIMessage,
  ToolCallInfo,
  UIActionPayload,
  ConfirmationRequest,
  AICommandCenterState,
} from './ai-command-center-types';

export interface StreamCallbacks {
  setCurrentPhase: (phase: string) => void;
  setRouteInfo: (info: AICommandCenterState['routeInfo']) => void;
  setStreamingContent: (content: string) => void;
  setActiveTools: (tools: ToolCallInfo[]) => void;
  setPendingConfirmation: (req: ConfirmationRequest | null) => void;
  setError: (err: string | null) => void;
  setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void;
  uiActionHandler: (() => ((action: UIActionPayload) => void) | null);
}

export async function processSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  const toolCalls: ToolCallInfo[] = [];
  const uiActions: UIActionPayload[] = [];
  let confirmation: ConfirmationRequest | null = null;
  let meta: AIMessage['metadata'] = {};
  let pendingEventType = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');

      // SSE event type line
      if (trimmed.startsWith('event: ')) {
        pendingEventType = trimmed.slice(7).trim();
        continue;
      }

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith(':')) {
        pendingEventType = '';
        continue;
      }

      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6).trim();
      if (!jsonStr) continue;

      const eventType = pendingEventType || 'message';
      pendingEventType = '';

      try {
        const data = JSON.parse(jsonStr);

        switch (eventType) {
          case 'status':
            callbacks.setCurrentPhase(data.phase || '');
            break;

          case 'routed':
            callbacks.setRouteInfo(data);
            meta = { ...meta, category: data.category, tier: data.tier };
            break;

          case 'text':
            fullText += data.text || '';
            callbacks.setStreamingContent(fullText);
            break;

          case 'tool_use':
            // Tool call started by Claude
            break;

          case 'tool_start': {
            const tool: ToolCallInfo = { id: data.id, name: data.name, status: 'running' };
            toolCalls.push(tool);
            callbacks.setActiveTools([...toolCalls]);
            break;
          }

          case 'tool_result': {
            const idx = toolCalls.findIndex((t) => t.id === data.id);
            if (idx >= 0) {
              toolCalls[idx].status = data.success ? 'success' : 'error';
              toolCalls[idx].hasUIAction = data.has_ui_action;
              callbacks.setActiveTools([...toolCalls]);
            }
            break;
          }

          case 'ui_action': {
            const action = data as UIActionPayload;
            uiActions.push(action);
            // Dispatch to the registered handler
            callbacks.uiActionHandler()?.(action);
            break;
          }

          case 'confirmation_required':
            confirmation = data as ConfirmationRequest;
            callbacks.setPendingConfirmation(confirmation);
            break;

          case 'error':
            callbacks.setError(data.message || 'Unknown error');
            break;

          case 'done':
            meta = {
              ...meta,
              cost: data.cost,
              toolCount: data.tool_calls,
              durationMs: data.duration_ms,
            };
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  // Add the assistant message
  if (fullText || toolCalls.length > 0 || confirmation) {
    const assistantMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fullText,
      timestamp: new Date(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      uiActions: uiActions.length > 0 ? uiActions : undefined,
      pendingConfirmation: confirmation || undefined,
      metadata: meta,
    };
    callbacks.setMessages((prev) => [...prev, assistantMsg]);
  }
}
