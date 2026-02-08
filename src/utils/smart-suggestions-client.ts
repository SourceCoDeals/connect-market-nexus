import type { Suggestion } from '@/components/remarketing/SmartSuggestions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function generateSmartSuggestions(
  messages: Message[],
  _context: { type: string; dealId?: string; universeId?: string }
): Suggestion[] {
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!lastUserMessage) return [];

  const query = lastUserMessage.content.toLowerCase();
  const suggestions: Suggestion[] = [];

  if (query.includes('top') && query.includes('buyer')) {
    suggestions.push(
      { text: "Which of these buyers have presence in adjacent states?", intent: 'explore_geography' },
      { text: "Show me contact information for the top 3 buyers", intent: 'get_contacts' }
    );
  }

  if (query.includes('tell me about') || query.includes('who is')) {
    suggestions.push(
      { text: "What are their recent acquisitions?", intent: 'explore_history' },
      { text: "What's their acquisition strategy?", intent: 'explore_strategy' }
    );
  }

  if (query.includes('score') || query.includes('ranking')) {
    suggestions.push(
      { text: "What are the key factors driving these scores?", intent: 'explore_scoring_methodology' },
      { text: "Show me buyers with deal breakers", intent: 'filter_deal_breakers' }
    );
  }

  if (query.includes('transcript') || query.includes('call')) {
    suggestions.push(
      { text: "Search transcripts for specific keywords", intent: 'search_transcripts' },
      { text: "Which calls had CEO engagement?", intent: 'filter_ceo_calls' }
    );
  }

  // Generic fallback suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      { text: "Who are the most active acquirers?", intent: 'explore_activity' },
      { text: "Show me geographic overlap analysis", intent: 'explore_geography' }
    );
  }

  return suggestions.slice(0, 4);
}
