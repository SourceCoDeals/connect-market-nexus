// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   ai-command-center-types.ts       — AIMessage, ToolCallInfo, UIActionPayload, ConfirmationRequest, PageContext, AICommandCenterState
//   ai-command-center-stream.ts      — processSSEStream
//   ai-command-center-persistence.ts — conversation persistence utilities, Conversation type
//   useAICommandCenterHook.ts        — useAICommandCenter hook

export type {
  AIMessage,
  ToolCallInfo,
  UIActionPayload,
  ConfirmationRequest,
  PageContext,
  AICommandCenterState,
} from './ai-command-center-types';
export type { Conversation } from './ai-command-center-persistence';
export { useAICommandCenter } from './useAICommandCenterHook';
