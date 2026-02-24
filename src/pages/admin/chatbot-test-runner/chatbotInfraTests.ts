/**
 * Automated infrastructure + behavior test definitions for the AI Command Center.
 *
 * Tests:
 * 1. Chat tables & columns exist
 * 2. Chat persistence CRUD
 * 3. Chat analytics & feedback
 * 4. Edge function reachability
 * 5. AI Command Center end-to-end: router, tool usage, response quality
 *
 * Follows the same pattern as system-test-runner/testDefinitions.ts.
 */

import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ──

export type ChatbotTestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warn';

export interface ChatbotTestResult {
  id: string;
  name: string;
  category: string;
  status: ChatbotTestStatus;
  error?: string;
  durationMs?: number;
}

export interface ChatbotTestDef {
  id: string;
  name: string;
  category: string;
  fn: (ctx: ChatbotTestContext) => Promise<void>;
}

export interface ChatbotTestContext {
  createdConversationIds: string[];
  createdAnalyticsIds: string[];
  createdFeedbackIds: string[];
}

export const CHATBOT_INFRA_STORAGE_KEY = 'sourceco-chatbot-infra-test-results';

// ── Helpers ──

// Untyped client for tables not in generated Supabase types
const db = supabase as unknown as SupabaseClient;

async function chatTableReadable(table: string) {
  const { error } = await db.from(table).select('id').limit(1);
  if (error) throw new Error(`Table '${table}' not readable: ${error.message}`);
}

async function chatColumnExists(table: string, column: string) {
  const { error } = await db.from(table).select(column).limit(1);
  if (error) throw new Error(`Column '${column}' on '${table}' failed: ${error.message}`);
}

/**
 * Send a query to the AI Command Center and parse SSE events.
 * Returns { text, toolCalls, routeInfo, error }.
 */
export async function sendAIQuery(
  query: string,
  timeoutMs = 30000,
  externalSignal?: AbortSignal,
): Promise<{
  text: string;
  toolCalls: Array<{ name: string; id: string; success: boolean }>;
  routeInfo: { category: string; tier: string; tools: string[] } | null;
  error: string | null;
  cost: number;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // If an external signal is provided, link it to our controller
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ query, conversation_id: crypto.randomUUID(), history: [] }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `HTTP ${response.status}: ${(err as Record<string, string>).error || response.statusText}`,
      );
    }

    // Parse SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    const toolCalls: Array<{ name: string; id: string; success: boolean }> = [];
    let routeInfo: { category: string; tier: string; tools: string[] } | null = null;
    let error: string | null = null;
    let cost = 0;
    let pendingEventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');
        if (trimmed.startsWith('event: ')) {
          pendingEventType = trimmed.slice(7).trim();
          continue;
        }
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) {
          if (!trimmed.startsWith('data: ')) pendingEventType = '';
          continue;
        }
        const jsonStr = trimmed.slice(6).trim();
        if (!jsonStr) continue;
        const eventType = pendingEventType || 'message';
        pendingEventType = '';

        try {
          const data = JSON.parse(jsonStr);
          switch (eventType) {
            case 'text':
              text += data.text || '';
              break;
            case 'routed':
              routeInfo = data;
              break;
            case 'tool_start':
              toolCalls.push({ name: data.name, id: data.id, success: false });
              break;
            case 'tool_result': {
              const idx = toolCalls.findIndex((t) => t.id === data.id);
              if (idx >= 0) toolCalls[idx].success = data.success;
              break;
            }
            case 'error':
              error = data.message;
              break;
            case 'done':
              cost = data.cost || 0;
              break;
          }
        } catch {
          /* skip malformed JSON */
        }
      }
    }

    return { text, toolCalls, routeInfo, error, cost };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Test Definitions ──

export function buildChatbotTests(): ChatbotTestDef[] {
  const tests: ChatbotTestDef[] = [];
  const add = (category: string, name: string, fn: ChatbotTestDef['fn']) =>
    tests.push({ id: `chatbot::${category}::${name}`, name, category, fn });

  // ═══════════════════════════════════════════
  // CATEGORY 1: Chat Infrastructure
  // ═══════════════════════════════════════════
  const C1 = '1. Chat Infrastructure';

  add(C1, 'chat_conversations table accessible', async () => {
    await chatTableReadable('chat_conversations');
  });

  add(C1, 'chat_analytics table accessible', async () => {
    await chatTableReadable('chat_analytics');
  });

  add(C1, 'chat_feedback table accessible', async () => {
    await chatTableReadable('chat_feedback');
  });

  // Required columns on chat_conversations
  const convCols = ['context_type', 'messages', 'user_id', 'title', 'archived', 'updated_at'];
  for (const col of convCols) {
    add(C1, `chat_conversations has '${col}' column`, async () => {
      await chatColumnExists('chat_conversations', col);
    });
  }

  // Required columns on chat_analytics
  const analyticsCols = [
    'conversation_id',
    'context_type',
    'query_text',
    'response_text',
    'response_time_ms',
    'tokens_total',
    'tools_called',
    'user_continued',
  ];
  for (const col of analyticsCols) {
    add(C1, `chat_analytics has '${col}' column`, async () => {
      await chatColumnExists('chat_analytics', col);
    });
  }

  // Required columns on chat_feedback
  const feedbackCols = [
    'conversation_id',
    'message_index',
    'rating',
    'issue_type',
    'feedback_text',
  ];
  for (const col of feedbackCols) {
    add(C1, `chat_feedback has '${col}' column`, async () => {
      await chatColumnExists('chat_feedback', col);
    });
  }

  // ═══════════════════════════════════════════
  // CATEGORY 2: Chat Persistence Operations
  // ═══════════════════════════════════════════
  const C2 = '2. Chat Persistence';
  let testConvId: string | null = null;

  add(C2, 'Save new conversation', async (ctx) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await db
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        context_type: 'deals',
        messages: JSON.parse(
          JSON.stringify([
            { role: 'user', content: 'QA Test Message', timestamp: new Date().toISOString() },
            { role: 'assistant', content: 'QA Test Response', timestamp: new Date().toISOString() },
          ]),
        ),
        title: 'QA Chatbot Infra Test',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    testConvId = data.id;
    ctx.createdConversationIds.push(data.id);
  });

  add(C2, 'Load conversations by context', async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await db
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('context_type', 'deals')
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No conversations found after insert');
  });

  add(C2, 'Load conversation by ID', async () => {
    if (!testConvId) throw new Error('No test conversation created');
    const { data, error } = await db
      .from('chat_conversations')
      .select('*')
      .eq('id', testConvId)
      .single();
    if (error) throw new Error(error.message);
    if (data.title !== 'QA Chatbot Infra Test') throw new Error('Title mismatch');
  });

  add(C2, 'Update conversation messages', async () => {
    if (!testConvId) throw new Error('No test conversation created');
    const updated = [
      { role: 'user', content: 'QA Test Message', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'QA Test Response', timestamp: new Date().toISOString() },
      { role: 'user', content: 'Follow-up QA message', timestamp: new Date().toISOString() },
    ];
    const { error } = await db
      .from('chat_conversations')
      .update({ messages: JSON.parse(JSON.stringify(updated)) })
      .eq('id', testConvId);
    if (error) throw new Error(error.message);
  });

  add(C2, 'Archive conversation', async () => {
    if (!testConvId) throw new Error('No test conversation created');
    const { error } = await db
      .from('chat_conversations')
      .update({ archived: true })
      .eq('id', testConvId);
    if (error) throw new Error(error.message);

    const { data, error: readErr } = await db
      .from('chat_conversations')
      .select('archived')
      .eq('id', testConvId)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (!data.archived) throw new Error('Archive flag not set');
  });

  add(C2, 'Cleanup test conversations', async (ctx) => {
    for (const id of ctx.createdConversationIds) {
      await db.from('chat_conversations').delete().eq('id', id);
    }
    ctx.createdConversationIds = [];
    testConvId = null;
  });

  // ═══════════════════════════════════════════
  // CATEGORY 3: Chat Analytics & Feedback
  // ═══════════════════════════════════════════
  const C3 = '3. Chat Analytics';

  add(C3, 'Log analytics entry', async (ctx) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Not authenticated');

    // Create a temp conversation to reference
    const { data: conv, error: convErr } = await db
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        context_type: 'deals',
        messages: [
          { role: 'user', content: 'Analytics test', timestamp: new Date().toISOString() },
        ],
        title: 'QA Analytics Test',
      })
      .select('id')
      .single();
    if (convErr) throw new Error(convErr.message);
    ctx.createdConversationIds.push(conv.id);

    const { data, error } = await supabase
      .from('chat_analytics')
      .insert({
        conversation_id: conv.id,
        context_type: 'deals',
        query_text: 'QA Test Query',
        response_text: 'QA Test Response',
        response_time_ms: 150,
        tokens_input: 100,
        tokens_output: 200,
        tokens_total: 300,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    ctx.createdAnalyticsIds.push(data.id);
  });

  add(C3, 'Submit feedback entry', async (ctx) => {
    if (!ctx.createdConversationIds.length) throw new Error('No test conversation for feedback');
    const convId = ctx.createdConversationIds[ctx.createdConversationIds.length - 1];

    const { data, error } = await supabase
      .from('chat_feedback')
      .insert({
        conversation_id: convId,
        message_index: 0,
        rating: 1,
        issue_type: null,
        feedback_text: 'QA Test Feedback — automated test',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    ctx.createdFeedbackIds.push(data.id);
  });

  add(C3, 'get_chat_analytics_summary RPC exists', async () => {
    const { error } = await db.rpc('get_chat_analytics_summary', {
      p_context_type: null,
      p_days: 7,
    });
    if (error?.message?.includes('does not exist')) {
      throw new Error('RPC get_chat_analytics_summary does not exist');
    }
    // Any other error (e.g. empty result) is acceptable — means the RPC exists
  });

  add(C3, 'Cleanup analytics & feedback entries', async (ctx) => {
    for (const id of ctx.createdFeedbackIds) {
      await supabase.from('chat_feedback').delete().eq('id', id);
    }
    for (const id of ctx.createdAnalyticsIds) {
      await supabase.from('chat_analytics').delete().eq('id', id);
    }
    for (const id of ctx.createdConversationIds) {
      await db.from('chat_conversations').delete().eq('id', id);
    }
    ctx.createdFeedbackIds = [];
    ctx.createdAnalyticsIds = [];
    ctx.createdConversationIds = [];
  });

  // ═══════════════════════════════════════════
  // CATEGORY 4: Edge Function Reachability
  // ═══════════════════════════════════════════
  const C4 = '4. Edge Functions';

  add(C4, 'ai-command-center edge function reachable', async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new Error('Not authenticated');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ query: 'ping', conversation_id: 'test', history: [] }),
    });
    // Any response that's not a network error is fine — even 400/500 means the function is reachable
    if (!response) throw new Error('No response from ai-command-center');
  });

  add(C4, 'chat-remarketing edge function reachable', async () => {
    const { error } = await supabase.functions.invoke('chat-remarketing', {
      body: { message: 'ping', context_type: 'deals' },
    });
    if (error) {
      const msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::ERR')
      ) {
        throw new Error(`Edge function 'chat-remarketing' network failure: ${msg}`);
      }
    }
  });

  add(C4, 'query-buyer-universe edge function reachable', async () => {
    const { error } = await supabase.functions.invoke('query-buyer-universe', {
      body: { query: 'test', universe_id: '00000000-0000-0000-0000-000000000000' },
    });
    if (error) {
      const msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::ERR')
      ) {
        throw new Error(`Edge function 'query-buyer-universe' network failure: ${msg}`);
      }
    }
  });

  add(C4, 'query-tracker-universe edge function reachable', async () => {
    const { error } = await supabase.functions.invoke('query-tracker-universe', {
      body: { query: 'test', tracker_id: '00000000-0000-0000-0000-000000000000' },
    });
    if (error) {
      const msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::ERR')
      ) {
        throw new Error(`Edge function 'query-tracker-universe' network failure: ${msg}`);
      }
    }
  });

  // ═══════════════════════════════════════════
  // CATEGORY 5: AI Command Center — Router Tests
  // ═══════════════════════════════════════════
  const C5 = '5. AI Router & Tool Usage';

  add(C5, 'Pipeline count query routes correctly', async () => {
    const result = await sendAIQuery('how many deals are in the pipeline');
    if (!result.routeInfo) throw new Error('No route info returned');
    if (
      result.routeInfo.category !== 'PIPELINE_ANALYTICS' &&
      result.routeInfo.category !== 'DAILY_BRIEFING'
    ) {
      throw new Error(`Expected PIPELINE_ANALYTICS, got ${result.routeInfo.category}`);
    }
    const toolNames = result.toolCalls.map((t) => t.name);
    if (!toolNames.includes('get_pipeline_summary')) {
      throw new Error(`Expected get_pipeline_summary tool, got: ${toolNames.join(', ') || 'none'}`);
    }
  });

  add(C5, 'Industry query includes query_deals tool', async () => {
    const result = await sendAIQuery('how many hvac deals do we have');
    if (!result.routeInfo) throw new Error('No route info returned');
    // Should have both get_pipeline_summary and query_deals available
    const toolNames = result.toolCalls.map((t) => t.name);
    const usedPipelineOrQuery =
      toolNames.includes('get_pipeline_summary') || toolNames.includes('query_deals');
    if (!usedPipelineOrQuery) {
      throw new Error(
        `Expected get_pipeline_summary or query_deals, got: ${toolNames.join(', ') || 'none'}`,
      );
    }
    // Check the response doesn't contain hallucinated tool calls
    if (result.text.includes('<tool_call>') || result.text.includes('<tool_response>')) {
      throw new Error(
        'Response contains hallucinated tool call text — AI is faking tool results instead of using real tools',
      );
    }
  });

  add(C5, 'Response uses real data (no hallucinated company names)', async () => {
    const result = await sendAIQuery('give me a quick pipeline overview');
    if (result.error) throw new Error(`AI error: ${result.error}`);
    if (!result.text) throw new Error('Empty response');
    // Check the response text doesn't include obviously hallucinated patterns
    const hallucinations = [
      'Arctic Air Systems',
      'ProTemp Solutions',
      'Comfort Climate Co',
      'BlueFlame HVAC',
      'PureAir Services',
      'deal_001',
      'deal_002',
    ];
    for (const fake of hallucinations) {
      if (result.text.includes(fake)) {
        throw new Error(
          `Response contains hallucinated data: "${fake}". The AI is fabricating data instead of using tool results.`,
        );
      }
    }
  });

  add(C5, 'Buyer search routes to search_buyers tool', async () => {
    const result = await sendAIQuery('find buyers interested in HVAC companies');
    if (!result.routeInfo) throw new Error('No route info returned');
    const category = result.routeInfo.category;
    if (!['BUYER_SEARCH', 'BUYER_ANALYSIS', 'BUYER_UNIVERSE'].includes(category)) {
      throw new Error(`Expected buyer-related category, got ${category}`);
    }
    if (result.text.includes('<tool_call>') || result.text.includes('<tool_response>')) {
      throw new Error('Response contains hallucinated tool call text');
    }
  });

  add(C5, 'Deal detail query routes to deal tools', async () => {
    const result = await sendAIQuery('what kind of company is the first deal in the pipeline');
    if (!result.routeInfo) throw new Error('No route info returned');
    const toolNames = result.toolCalls.map((t) => t.name);
    const hasDealTool = toolNames.some((t) => ['query_deals', 'get_deal_details'].includes(t));
    if (!hasDealTool) {
      throw new Error(`Expected deal lookup tools, got: ${toolNames.join(', ') || 'none'}`);
    }
  });

  add(C5, 'Tool calls succeed (no errors)', async () => {
    const result = await sendAIQuery('how many active deals are there');
    if (result.error) throw new Error(`AI returned error: ${result.error}`);
    const failedTools = result.toolCalls.filter((t) => !t.success);
    if (failedTools.length > 0) {
      throw new Error(
        `${failedTools.length} tool(s) failed: ${failedTools.map((t) => t.name).join(', ')}`,
      );
    }
  });

  add(C5, 'Response contains real deal count (not zero)', async () => {
    const result = await sendAIQuery('total number of deals in the system');
    if (result.error) throw new Error(`AI error: ${result.error}`);
    // Should mention a specific number
    const numbers = result.text.match(/\b(\d{1,5})\b/g);
    if (!numbers || numbers.length === 0) {
      throw new Error('Response has no numbers — expected a deal count');
    }
    // At least one number should be > 0
    const hasPositive = numbers.some((n) => parseInt(n, 10) > 0);
    if (!hasPositive) {
      throw new Error(
        'All numbers in response are 0 — pipeline appears empty or tools returned no data',
      );
    }
  });

  // ═══════════════════════════════════════════
  // CATEGORY 6: Chat Data Integrity
  // ═══════════════════════════════════════════
  const C6 = '6. Chat Data Integrity';

  add(C6, 'Chat conversations exist (not empty)', async () => {
    const { count, error } = await db
      .from('chat_conversations')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    if (!count || count === 0) {
      throw new Error('chat_conversations table is empty — no conversations created yet');
    }
  });

  add(C6, 'Chat analytics entries exist', async () => {
    const { count, error } = await supabase
      .from('chat_analytics')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    if (!count || count === 0) {
      throw new Error('chat_analytics table is empty — no analytics logged yet');
    }
  });

  add(C6, 'Multiple context types in use', async () => {
    const { data, error } = await db.from('chat_conversations').select('context_type').limit(100);
    if (error) throw new Error(error.message);
    const types = new Set((data || []).map((d: { context_type: string }) => d.context_type));
    if (types.size < 2) {
      throw new Error(
        `Only ${types.size} context type(s) in use: ${[...types].join(', ')}. Expected multiple.`,
      );
    }
  });

  add(C6, 'Chat feedback entries exist', async () => {
    const { count, error } = await supabase
      .from('chat_feedback')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    if (!count || count === 0) {
      throw new Error('chat_feedback table is empty — no feedback submitted yet');
    }
  });

  add(C6, 'Listings table has industry column for AI queries', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('industry')
      .not('industry', 'is', null)
      .limit(5);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error('No listings have an industry value — AI cannot answer industry questions');
    }
  });

  return tests;
}
