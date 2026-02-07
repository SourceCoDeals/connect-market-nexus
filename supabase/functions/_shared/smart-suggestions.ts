/**
 * Smart Query Suggestions Engine
 *
 * Analyzes conversation context and suggests relevant follow-up questions
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface SuggestionContext {
  type: 'deal' | 'deals' | 'buyers' | 'universe';
  dealId?: string;
  universeId?: string;
}

export interface Suggestion {
  text: string;
  intent: string;
  reasoning?: string;
}

/**
 * Generate smart follow-up suggestions based on conversation history
 */
export function generateSmartSuggestions(
  messages: Message[],
  context: SuggestionContext
): Suggestion[] {
  if (messages.length === 0) {
    return getInitialSuggestions(context);
  }

  const lastUserMessage = messages
    .filter(m => m.role === 'user')
    .slice(-1)[0];

  const lastAssistantMessage = messages
    .filter(m => m.role === 'assistant')
    .slice(-1)[0];

  if (!lastUserMessage) {
    return getInitialSuggestions(context);
  }

  const query = lastUserMessage.content.toLowerCase();
  const response = lastAssistantMessage?.content.toLowerCase() || '';

  // Analyze what was asked and suggest complementary queries
  const suggestions: Suggestion[] = [];

  // Pattern 1: Asked about top buyers → suggest exploring criteria
  if (query.includes('top') && (query.includes('buyer') || query.includes('match'))) {
    if (!hasAskedAbout(messages, 'geography')) {
      suggestions.push({
        text: "Which of these buyers have presence in adjacent states?",
        intent: 'explore_geography',
        reasoning: 'User found top buyers, explore geographic fit'
      });
    }
    if (!hasAskedAbout(messages, 'contact')) {
      suggestions.push({
        text: "Show me contact information for the top 3 buyers",
        intent: 'get_contacts',
        reasoning: 'User identified targets, ready for outreach'
      });
    }
    suggestions.push({
      text: "What makes these buyers better than the others?",
      intent: 'score_explanation',
      reasoning: 'Explain scoring logic'
    });
  }

  // Pattern 2: Asked about geography → suggest size or services
  if (query.includes('state') || query.includes('region') || query.includes('geograph')) {
    if (!hasAskedAbout(messages, 'revenue') && !hasAskedAbout(messages, 'size')) {
      suggestions.push({
        text: "Show me buyers with revenue targets matching this deal",
        intent: 'explore_size',
        reasoning: 'Explored geography, now check size fit'
      });
    }
    if (!hasAskedAbout(messages, 'service') && !hasAskedAbout(messages, 'industr')) {
      suggestions.push({
        text: "Which buyers focus on this industry?",
        intent: 'explore_services',
        reasoning: 'Checked location, verify industry focus'
      });
    }
  }

  // Pattern 3: Asked about scores → suggest deeper analysis
  if (query.includes('score') || query.includes('rating') || query.includes('match')) {
    if (response.includes('geography') && !hasAskedAbout(messages, 'acquisition')) {
      suggestions.push({
        text: "Show me recent acquisition activity for these buyers",
        intent: 'acquisition_history',
        reasoning: 'Understand buyer activity level'
      });
    }
    if (!hasAskedAbout(messages, 'deal breaker') && !hasAskedAbout(messages, 'passed')) {
      suggestions.push({
        text: "Why were some buyers passed on this deal?",
        intent: 'rejection_analysis',
        reasoning: 'Understand exclusion criteria'
      });
    }
  }

  // Pattern 4: Asked about specific buyer → suggest comparisons
  if (detectsBuyerMention(query, response)) {
    suggestions.push({
      text: "How does this buyer compare to similar PE firms?",
      intent: 'buyer_comparison',
      reasoning: 'Compare against peers'
    });
    if (!hasAskedAbout(messages, 'portfolio')) {
      suggestions.push({
        text: "What's in this buyer's current portfolio?",
        intent: 'portfolio_analysis',
        reasoning: 'Understand existing investments'
      });
    }
  }

  // Pattern 5: Asked about transcripts → suggest follow-ups
  if (query.includes('transcript') || query.includes('call') || query.includes('ceo')) {
    suggestions.push({
      text: "What were the owner's main concerns in the call?",
      intent: 'transcript_insights',
      reasoning: 'Extract key concerns'
    });
    suggestions.push({
      text: "Are there any red flags in the transcript?",
      intent: 'risk_assessment',
      reasoning: 'Identify potential issues'
    });
  }

  // Pattern 6: Multiple buyers mentioned → suggest actionable next steps
  if (countBuyerMentions(response) >= 3) {
    if (!hasAskedAbout(messages, 'prioritize') && !hasAskedAbout(messages, 'rank')) {
      suggestions.push({
        text: "Which 3 buyers should I prioritize for outreach?",
        intent: 'prioritization',
        reasoning: 'Narrow down to action list'
      });
    }
    if (!hasAskedAbout(messages, 'timing') && !hasAskedAbout(messages, 'active')) {
      suggestions.push({
        text: "Which buyers are most active right now?",
        intent: 'buyer_activity',
        reasoning: 'Find hot buyers'
      });
    }
  }

  // Pattern 7: General exploration → suggest specific dimensions
  if (query.includes('show') || query.includes('find') || query.includes('who')) {
    const exploredDimensions = {
      geography: hasAskedAbout(messages, 'state') || hasAskedAbout(messages, 'region'),
      size: hasAskedAbout(messages, 'revenue') || hasAskedAbout(messages, 'ebitda'),
      service: hasAskedAbout(messages, 'service') || hasAskedAbout(messages, 'industry'),
      timing: hasAskedAbout(messages, 'recent') || hasAskedAbout(messages, 'active'),
    };

    if (!exploredDimensions.geography) {
      suggestions.push({
        text: "Show me buyers with regional presence overlap",
        intent: 'explore_geography'
      });
    }
    if (!exploredDimensions.size) {
      suggestions.push({
        text: "Find buyers with similar deal size preferences",
        intent: 'explore_size'
      });
    }
    if (!exploredDimensions.timing) {
      suggestions.push({
        text: "Which buyers have acquired recently?",
        intent: 'explore_timing'
      });
    }
  }

  // If no specific suggestions, provide context-appropriate defaults
  if (suggestions.length === 0) {
    suggestions.push(...getContextualDefaults(context, messages));
  }

  // Limit to top 3-4 suggestions
  return suggestions.slice(0, 4);
}

/**
 * Get initial suggestions when conversation just starts
 */
function getInitialSuggestions(context: SuggestionContext): Suggestion[] {
  if (context.type === 'deal') {
    return [
      { text: "Who are the top 5 buyers for this deal?", intent: 'find_buyers' },
      { text: "Which buyers have presence in this state?", intent: 'geography_match' },
      { text: "Show me the most active acquirers", intent: 'buyer_activity' },
    ];
  }

  if (context.type === 'universe') {
    return [
      { text: "Who are the best matched buyers in this universe?", intent: 'find_buyers' },
      { text: "Which deals need more buyer matches?", intent: 'deal_coverage' },
      { text: "Show me buyers with high alignment scores", intent: 'alignment_analysis' },
    ];
  }

  if (context.type === 'buyers') {
    return [
      { text: "Which buyers are most active acquirers?", intent: 'buyer_activity' },
      { text: "Show me PE firms focused on the Southeast", intent: 'geography_search' },
      { text: "Find buyers with fee agreements", intent: 'buyer_filter' },
    ];
  }

  if (context.type === 'deals') {
    return [
      { text: "Which deals have the highest quality scores?", intent: 'deal_quality' },
      { text: "Show me deals that need enrichment", intent: 'data_quality' },
      { text: "What industries have the most deals?", intent: 'industry_analysis' },
    ];
  }

  return [];
}

/**
 * Get contextual default suggestions
 */
function getContextualDefaults(
  context: SuggestionContext,
  messages: Message[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Always useful: deep dive on specific buyer
  suggestions.push({
    text: "Tell me more about the top-ranked buyer",
    intent: 'buyer_deep_dive'
  });

  // Context-specific
  if (context.type === 'deal') {
    suggestions.push({
      text: "Are there any buyers I'm missing?",
      intent: 'expand_search'
    });
  }

  if (context.type === 'universe') {
    suggestions.push({
      text: "How can I improve match quality in this universe?",
      intent: 'optimization'
    });
  }

  return suggestions;
}

/**
 * Check if a topic has been asked about
 */
function hasAskedAbout(messages: Message[], keyword: string): boolean {
  return messages.some(m =>
    m.role === 'user' && m.content.toLowerCase().includes(keyword)
  );
}

/**
 * Detect if a specific buyer was mentioned
 */
function detectsBuyerMention(query: string, response: string): boolean {
  // Check for bold buyer names (markdown)
  const hasBoldName = /\*\*[A-Z][a-z\s&]+\*\*/.test(response);

  // Check for common buyer name patterns
  const buyerKeywords = ['capital', 'partners', 'equity', 'holdings', 'group'];
  const hasBuyerKeyword = buyerKeywords.some(k => query.includes(k) || response.includes(k));

  return hasBoldName || hasBuyerKeyword;
}

/**
 * Count buyer mentions in response
 */
function countBuyerMentions(response: string): number {
  // Count bold names (markdown format)
  const matches = response.match(/\*\*[A-Z][a-z\s&]+\*\*/g);
  return matches ? matches.length : 0;
}

/**
 * Cache suggestions for reuse
 */
export async function cacheSuggestions(
  supabase: SupabaseClient,
  context: SuggestionContext,
  previousQuery: string,
  suggestions: Suggestion[]
): Promise<void> {
  try {
    await supabase.from('chat_smart_suggestions').insert({
      context_type: context.type,
      universe_id: context.universeId || null,
      deal_id: context.dealId || null,
      previous_query: previousQuery,
      suggestions: suggestions,
      suggestion_reasoning: suggestions.map(s => s.reasoning).filter(Boolean).join('; ')
    });
  } catch (error) {
    console.error('[smart-suggestions] Cache error:', error);
  }
}

/**
 * Track suggestion click
 */
export async function trackSuggestionClick(
  supabase: SupabaseClient,
  suggestionId: string
): Promise<void> {
  try {
    await supabase
      .from('chat_smart_suggestions')
      .update({
        times_clicked: supabase.rpc('increment', { x: 1 }),
        last_shown_at: new Date().toISOString()
      })
      .eq('id', suggestionId);
  } catch (error) {
    console.error('[smart-suggestions] Track click error:', error);
  }
}
