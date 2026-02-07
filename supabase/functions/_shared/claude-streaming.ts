/**
 * Claude AI Client with Streaming + Tool Support
 *
 * Provides streaming responses with tool calling capability using Anthropic SDK
 */

import Anthropic from "npm:@anthropic-ai/sdk@0.17.1";
import type { MessageCreateParamsStreaming } from "npm:@anthropic-ai/sdk@0.17.1/resources/messages.mjs";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ClaudeStreamOptions {
  model?: string;
  messages: ClaudeMessage[];
  tools?: ClaudeTool[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  onTextDelta?: (text: string) => void;
  onToolUse?: (toolName: string, toolInput: any) => Promise<any>;
  signal?: AbortSignal;
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_TEMPERATURE = 1.0;

/**
 * Stream responses from Claude with tool support
 */
export async function streamClaudeWithTools(
  options: ClaudeStreamOptions
): Promise<{
  fullContent: string;
  toolCalls: Array<{ name: string; input: any; result: any }>;
  stopReason: string;
}> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const params: MessageCreateParamsStreaming = {
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: options.temperature || DEFAULT_TEMPERATURE,
    messages: options.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
  };

  if (options.systemPrompt) {
    params.system = options.systemPrompt;
  }

  if (options.tools && options.tools.length > 0) {
    params.tools = options.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  let fullContent = "";
  const toolCalls: Array<{ name: string; input: any; result: any }> = [];
  let stopReason = "end_turn";

  try {
    const stream = await anthropic.messages.stream(params, {
      signal: options.signal,
    });

    for await (const event of stream) {
      // Handle text deltas
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullContent += text;
        if (options.onTextDelta) {
          options.onTextDelta(text);
        }
      }

      // Handle tool use
      if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use"
      ) {
        const toolName = event.content_block.name;
        const toolInput = event.content_block.input;

        console.log(`[claude-streaming] Tool called: ${toolName}`);

        // Execute tool if handler provided
        if (options.onToolUse) {
          try {
            const result = await options.onToolUse(toolName, toolInput);
            toolCalls.push({ name: toolName, input: toolInput, result });
          } catch (err) {
            console.error(`[claude-streaming] Tool execution error:`, err);
            toolCalls.push({
              name: toolName,
              input: toolInput,
              result: { error: String(err) },
            });
          }
        }
      }

      // Capture stop reason
      if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason || stopReason;
      }
    }

    // If tools were called and we have results, continue conversation
    if (toolCalls.length > 0 && options.onToolUse) {
      console.log(
        `[claude-streaming] ${toolCalls.length} tools executed, continuing conversation`
      );

      // Build follow-up messages with tool results
      const followUpMessages: ClaudeMessage[] = [
        ...options.messages,
        {
          role: "assistant" as const,
          content: fullContent || "I'll use the tools to help answer that.",
        },
      ];

      // Add tool results as user messages
      for (const toolCall of toolCalls) {
        followUpMessages.push({
          role: "user" as const,
          content: `Tool result for ${toolCall.name}: ${JSON.stringify(
            toolCall.result,
            null,
            2
          )}`,
        });
      }

      // Recursively call with tool results (without tools to prevent loops)
      const followUp = await streamClaudeWithTools({
        ...options,
        messages: followUpMessages,
        tools: undefined, // Don't allow chained tool calls for now
      });

      // Combine results
      fullContent += "\n\n" + followUp.fullContent;
      toolCalls.push(...followUp.toolCalls);
    }

    return { fullContent, toolCalls, stopReason };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("[claude-streaming] Request aborted");
      throw error;
    }

    console.error("[claude-streaming] Error:", error);
    throw error;
  }
}

/**
 * Non-streaming Claude call (simpler, for non-UI contexts)
 */
export async function callClaude(
  messages: ClaudeMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    tools?: ClaudeTool[];
  }
): Promise<{ content: string; toolCalls?: Array<{ name: string; input: any }> }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const params: any = {
    model: options?.model || DEFAULT_MODEL,
    max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: options?.temperature || DEFAULT_TEMPERATURE,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (options?.systemPrompt) {
    params.system = options.systemPrompt;
  }

  if (options?.tools && options.tools.length > 0) {
    params.tools = options.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  const response = await anthropic.messages.create(params);

  const textContent = response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("");

  const toolCalls = response.content
    .filter((block: any) => block.type === "tool_use")
    .map((block: any) => ({
      name: block.name,
      input: block.input,
    }));

  return {
    content: textContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Claude uses ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Check if we should cache the system prompt
 * Cache if: system prompt > 10K tokens and will be reused
 */
export function shouldCacheSystemPrompt(systemPrompt: string): boolean {
  const tokens = estimateTokens(systemPrompt);
  return tokens > 10000; // Cache if > 10K tokens
}
