/**
 * Knowledge Base Tools
 * Allows the AI to retrieve domain knowledge, field definitions,
 * platform guides, and M&A context on demand — keeping the system
 * prompt lean while preserving full context depth.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';
import { listTopics, getArticle, searchArticles } from '../knowledge-base.ts';

// ---------- Tool definitions ----------

export const knowledgeTools: ClaudeTool[] = [
  {
    name: 'retrieve_knowledge',
    description:
      'Retrieve detailed domain knowledge about SourceCo platform features, M&A terminology, scoring dimensions, field meanings, platform workflows, and more. ALWAYS use this tool when answering "how do I", "what is", "where do I find", or "explain" questions about the platform. Available topics include: field_meanings, scoring_dimensions, pass_categories, engagement_signals, call_dispositions, business_model, terminology, credibility_framework, business_signals, buyer_deal_matching, general_ma_knowledge, contact_discovery_flow, multi_step_workflows, error_recovery, buyer_onboarding, sourcing_process, outreach_tracking, tool_limitations, data_sources, platform_guide, admin_navigation, deal_pipeline_guide, task_system_guide, remarketing_guide, data_room_guide, marketplace_guide, agreements_guide, lead_sources_guide, integrations_guide, ai_command_center_guide, analytics_settings_guide.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description:
            'The knowledge topic slug to retrieve. For platform usage questions, use: admin_navigation, deal_pipeline_guide, task_system_guide, remarketing_guide, data_room_guide, marketplace_guide, agreements_guide, lead_sources_guide, integrations_guide, ai_command_center_guide, analytics_settings_guide, platform_guide. For M&A domain knowledge, use: field_meanings, scoring_dimensions, buyer_deal_matching, terminology, general_ma_knowledge, etc.',
        },
        action: {
          type: 'string',
          enum: ['get', 'list_topics', 'search'],
          description:
            'Action to perform: "get" retrieves a specific topic, "list_topics" lists all available topics, "search" searches topics by keyword.',
        },
        query: {
          type: 'string',
          description: 'Search query (only used when action is "search").',
        },
      },
      required: ['action'],
    },
  },
];

// ---------- Executor ----------

export async function executeKnowledgeTool(
  _supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  if (toolName !== 'retrieve_knowledge') {
    return { error: `Unknown knowledge tool: ${toolName}` };
  }

  const action = (args.action as string) || 'get';

  switch (action) {
    case 'list_topics': {
      const topics = listTopics();
      return { data: { topics, count: topics.length } };
    }

    case 'search': {
      const query = (args.query as string) || '';
      if (!query) return { error: 'query parameter is required for search action' };
      const results = searchArticles(query);
      return { data: { results, count: results.length } };
    }

    case 'get':
    default: {
      const topic = args.topic as string;
      if (!topic) return { error: 'topic parameter is required for get action' };
      const article = getArticle(topic);
      if (!article) {
        const available = listTopics().map((t) => t.slug);
        return {
          error: `Topic "${topic}" not found. Available topics: ${available.join(', ')}`,
        };
      }
      return { data: { topic, title: article.title, content: article.content } };
    }
  }
}
