/**
 * Types for the AI Command Center
 */

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallInfo[];
  uiActions?: UIActionPayload[];
  pendingConfirmation?: ConfirmationRequest;
  metadata?: {
    category?: string;
    tier?: string;
    cost?: number;
    durationMs?: number;
    toolCount?: number;
  };
}

export interface ToolCallInfo {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  hasUIAction?: boolean;
}

export interface UIActionPayload {
  type:
    | 'select_rows'
    | 'apply_filter'
    | 'sort_column'
    | 'navigate'
    | 'highlight_rows'
    | 'clear_selection'
    | 'trigger_action';
  target: string;
  payload: Record<string, unknown>;
}

export interface ConfirmationRequest {
  tool_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  description: string;
}

export interface PageContext {
  page?: string;
  entity_id?: string;
  entity_type?: string;
  tab?: string;
}

export interface AICommandCenterState {
  messages: AIMessage[];
  isLoading: boolean;
  streamingContent: string;
  currentPhase: string;
  routeInfo: { category: string; tier: string; confidence: number; bypassed: boolean } | null;
  activeTools: ToolCallInfo[];
  pendingConfirmation: ConfirmationRequest | null;
  error: string | null;
}

export type UIActionHandler = (action: UIActionPayload) => void;
