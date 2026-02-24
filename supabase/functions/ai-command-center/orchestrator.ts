/**
 * AI Command Center - Orchestrator
 * Manages the tool-calling loop: streams Claude response,
 * executes tool calls, feeds results back, repeats until done.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import {
  streamClaude,
  getModelForTier,
  estimateCost,
  type ClaudeMessage,
  type ContentBlock,
  type ModelTier,
} from '../_shared/claude-client.ts';
import { getToolsForCategory, executeTool, requiresConfirmation } from './tools/index.ts';
import { buildSystemPrompt } from './system-prompt.ts';

// ---------- Types ----------

interface OrchestratorOptions {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  conversationHistory: ClaudeMessage[];
  category: string;
  tier: ModelTier;
  toolNames: string[];
  pageContext?: { page?: string; entity_id?: string; entity_type?: string; tab?: string };
}

interface StreamWriter {
  write: (chunk: string) => Promise<void>;
  close: () => Promise<void>;
}

export interface OrchestratorResult {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  toolCallCount: number;
  model: string;
  pendingConfirmation?: {
    tool_name: string;
    tool_id: string;
    args: Record<string, unknown>;
    description: string;
  };
}

// ---------- SSE Helpers ----------

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------- Tool Result Truncation ----------

// Max characters for a single tool result sent back to Claude (~40k chars ≈ ~10k tokens)
const MAX_TOOL_RESULT_CHARS = 40000;

/**
 * Truncate a tool result JSON string to avoid exceeding Claude's context limit.
 * For list payloads (deals, buyers, requests, leads) it trims the array
 * and appends a note so Claude knows data was cut.
 */
function truncateToolResult(json: string): string {
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json;

  try {
    const parsed = JSON.parse(json);
    // Find the first array-valued key that holds the main dataset
    const listKey = ['deals', 'buyers', 'requests', 'leads', 'messages', 'scores', 'results', 'records']
      .find((k) => Array.isArray(parsed[k]));

    if (listKey) {
      const originalCount = parsed[listKey].length;
      // Binary-search for how many items fit within the budget
      let lo = 0, hi = originalCount;
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        const candidate = JSON.stringify({ ...parsed, [listKey]: parsed[listKey].slice(0, mid) });
        if (candidate.length <= MAX_TOOL_RESULT_CHARS - 200) lo = mid; else hi = mid - 1;
      }
      const trimmed = {
        ...parsed,
        [listKey]: parsed[listKey].slice(0, lo),
        total: parsed.total ?? originalCount,
        _truncated: true,
        _note: `Result truncated: showing ${lo} of ${originalCount} items to fit context window. Use more specific filters to see all data.`,
      };
      return JSON.stringify(trimmed);
    }
  } catch {
    // Fall through to hard truncation
  }

  // Hard truncation fallback
  return json.substring(0, MAX_TOOL_RESULT_CHARS) +
    '... [truncated — result too large for context window]';
}

// ---------- Orchestrator ----------

const MAX_TOOL_ROUNDS = 5;

export async function orchestrate(
  options: OrchestratorOptions,
  writer: StreamWriter,
): Promise<OrchestratorResult> {
  const { supabase, userId, query, conversationHistory, category, tier, toolNames, pageContext } =
    options;

  const model = getModelForTier(tier);
  const systemPrompt = buildSystemPrompt(category, pageContext);
  const tools = getToolsForCategory(category, toolNames);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let toolCallCount = 0;

  // Build messages: history + current query
  const messages: ClaudeMessage[] = [
    ...conversationHistory.slice(-6), // Keep last 6 messages for context (avoids token overflow)
    { role: 'user', content: query },
  ];

  // Inject page context as user context if entity is known
  if (pageContext?.entity_id && pageContext.entity_type) {
    const contextMsg = `[System: User is on the ${pageContext.page} page, viewing ${pageContext.entity_type} ${pageContext.entity_id}]`;
    messages[messages.length - 1] = {
      role: 'user',
      content: `${contextMsg}\n\n${query}`,
    };
  }

  // Tool-calling loop
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Stream Claude response
    const response = await streamClaude(
      {
        model,
        maxTokens: tier === 'DEEP' ? 4096 : 2048,
        systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        timeoutMs: tier === 'DEEP' ? 60000 : 30000,
      },
      {
        onText: async (text) => {
          await writer.write(sseEvent('text', { text }));
        },
        onToolUse: async (id, name, input) => {
          await writer.write(sseEvent('tool_use', { id, name, input }));
        },
        onComplete: async (usage) => {
          totalInputTokens += usage.input_tokens;
          totalOutputTokens += usage.output_tokens;
        },
        onError: async (error) => {
          await writer.write(sseEvent('error', { message: error.message }));
        },
      },
    );

    // Check if we're done (no tool calls)
    if (response.stop_reason !== 'tool_use') {
      break;
    }

    // Extract tool_use blocks
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    // Add assistant message with tool calls to history
    messages.push({ role: 'assistant', content: response.content });

    // Execute each tool call
    const toolResults: ContentBlock[] = [];

    for (const toolBlock of toolUseBlocks) {
      const toolName = toolBlock.name!;
      const toolId = toolBlock.id!;
      const toolInput = toolBlock.input || {};

      // Check if this tool requires confirmation
      if (requiresConfirmation(toolName)) {
        // Send confirmation request to frontend
        const description = describeAction(toolName, toolInput);
        await writer.write(
          sseEvent('confirmation_required', {
            tool_id: toolId,
            tool_name: toolName,
            args: toolInput,
            description,
          }),
        );

        // Return with pending confirmation — the frontend will re-invoke
        // with the confirmation when the user approves
        const totalCost = estimateCost(model, totalInputTokens, totalOutputTokens);
        await writer.write(
          sseEvent('done', {
            usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
            cost: totalCost,
            tool_calls: toolCallCount,
            pending_confirmation: {
              tool_name: toolName,
              tool_id: toolId,
              args: toolInput,
              description,
            },
          }),
        );

        return {
          totalInputTokens,
          totalOutputTokens,
          totalCost,
          toolCallCount,
          model,
          pendingConfirmation: {
            tool_name: toolName,
            tool_id: toolId,
            args: toolInput,
            description,
          },
        };
      }

      // Execute the tool
      await writer.write(sseEvent('tool_start', { id: toolId, name: toolName }));
      const result = await executeTool(
        supabase,
        toolName,
        toolInput as Record<string, unknown>,
        userId,
      );
      toolCallCount++;

      await writer.write(
        sseEvent('tool_result', {
          id: toolId,
          name: toolName,
          success: !result.error,
          has_ui_action: !!(result.data as Record<string, unknown>)?.ui_action,
        }),
      );

      // If tool returned a UI action, also emit it as a separate event
      const data = result.data as Record<string, unknown> | undefined;
      if (data?.ui_action) {
        await writer.write(sseEvent('ui_action', data.ui_action));
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolId,
        content: truncateToolResult(JSON.stringify(result.error ? { error: result.error } : result.data)),
        is_error: !!result.error,
      });
    }

    // Add tool results to messages
    messages.push({ role: 'user', content: toolResults });
  }

  // Final done event
  const totalCost = estimateCost(model, totalInputTokens, totalOutputTokens);
  await writer.write(
    sseEvent('done', {
      usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      cost: totalCost,
      tool_calls: toolCallCount,
    }),
  );

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCost,
    toolCallCount,
    model,
  };
}

// ---------- Confirmation prompt helpers ----------

function describeAction(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'update_deal_stage':
      return `Update deal stage to "${args.new_stage}"${args.reason ? ` (reason: ${args.reason})` : ''}`;
    case 'grant_data_room_access':
      return `Grant ${args.access_level || 'teaser'} data room access to ${args.buyer_name} (${args.buyer_email}) for this deal`;
    case 'send_document':
      return `Send ${args.document_type === 'nda' ? 'NDA' : 'Fee Agreement'} to ${args.signer_name} (${args.signer_email})`;
    case 'push_to_phoneburner':
      return `Push ${(args.entity_ids as string[])?.length || 0} ${args.entity_type || 'contacts'} to PhoneBurner dialer`;
    case 'save_contacts_to_crm':
      return `Save ${(args.contacts as unknown[])?.length || 0} contact(s) to CRM${args.remarketing_buyer_id ? ' linked to buyer' : ''}`;
    case 'reassign_deal_task':
      return `Reassign task to ${args.new_assignee_email || args.new_assignee_id || 'team member'}`;
    case 'convert_to_pipeline_deal':
      return `Convert remarketing match to pipeline deal (listing: ${args.listing_id}, buyer: ${args.buyer_id})`;
    default:
      return `Execute ${toolName} with provided arguments`;
  }
}

// ---------- Confirmation execution ----------

/**
 * Execute a previously-confirmed tool and stream the continuation.
 */
export async function executeConfirmedAction(
  options: OrchestratorOptions & {
    confirmedToolId: string;
    confirmedToolName: string;
    confirmedArgs: Record<string, unknown>;
  },
  writer: StreamWriter,
): Promise<OrchestratorResult> {
  const { supabase, userId, confirmedToolId, confirmedToolName, confirmedArgs } = options;

  // Execute the confirmed tool
  await writer.write(sseEvent('tool_start', { id: confirmedToolId, name: confirmedToolName }));
  const result = await executeTool(supabase, confirmedToolName, confirmedArgs, userId);

  await writer.write(
    sseEvent('tool_result', {
      id: confirmedToolId,
      name: confirmedToolName,
      success: !result.error,
    }),
  );

  // Build a message with the result and let Claude respond
  const model = getModelForTier(options.tier);
  const systemPrompt = buildSystemPrompt(options.category, options.pageContext);

  const messages: ClaudeMessage[] = [
    ...options.conversationHistory.slice(-6),
    { role: 'user', content: options.query },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: confirmedToolId,
          name: confirmedToolName,
          input: confirmedArgs,
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: confirmedToolId,
          content: JSON.stringify(result.error ? { error: result.error } : result.data),
          is_error: !!result.error,
        },
      ],
    },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  await streamClaude(
    { model, maxTokens: 2048, systemPrompt, messages, timeoutMs: 30000 },
    {
      onText: async (text) => {
        await writer.write(sseEvent('text', { text }));
      },
      onToolUse: async () => {
        /* Shouldn't happen for confirmation flow */
      },
      onComplete: async (usage) => {
        totalInputTokens += usage.input_tokens;
        totalOutputTokens += usage.output_tokens;
      },
      onError: async (error) => {
        await writer.write(sseEvent('error', { message: error.message }));
      },
    },
  );

  const totalCost = estimateCost(model, totalInputTokens, totalOutputTokens);
  await writer.write(
    sseEvent('done', {
      usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      cost: totalCost,
      tool_calls: 1,
    }),
  );

  return { totalInputTokens, totalOutputTokens, totalCost, toolCallCount: 1, model };
}
