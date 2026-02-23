import { describe, it, expect } from 'vitest';
import { generateSmartSuggestions } from './smart-suggestions-client';

describe('generateSmartSuggestions', () => {
  const context = { type: 'deal', dealId: 'deal-1' };

  it('returns empty array when no user messages', () => {
    const result = generateSmartSuggestions([], context);
    expect(result).toEqual([]);
  });

  it('generates buyer-related suggestions', () => {
    const messages = [
      { role: 'user' as const, content: 'Show me the top buyers for this deal' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.intent === 'explore_geography' || s.intent === 'get_contacts')).toBe(true);
  });

  it('generates profile-related suggestions for "tell me about"', () => {
    const messages = [
      { role: 'user' as const, content: 'Tell me about this company' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.intent === 'explore_history' || s.intent === 'explore_strategy')).toBe(true);
  });

  it('generates scoring suggestions for score queries', () => {
    const messages = [
      { role: 'user' as const, content: 'What is the score of these buyers?' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    expect(suggestions.some(s => s.intent === 'explore_scoring_methodology')).toBe(true);
  });

  it('generates transcript suggestions for transcript queries', () => {
    const messages = [
      { role: 'user' as const, content: 'Show me the call transcript' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    expect(suggestions.some(s => s.intent === 'search_transcripts' || s.intent === 'filter_ceo_calls')).toBe(true);
  });

  it('generates fallback suggestions for generic queries', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello, help me please' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.intent === 'explore_activity' || s.intent === 'explore_geography')).toBe(true);
  });

  it('limits suggestions to 4 maximum', () => {
    const messages = [
      { role: 'user' as const, content: 'top buyer score ranking transcript call' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    expect(suggestions.length).toBeLessThanOrEqual(4);
  });

  it('only considers last user message', () => {
    const messages = [
      { role: 'user' as const, content: 'Show me the top buyers' },
      { role: 'assistant' as const, content: 'Here are the top buyers...' },
      { role: 'user' as const, content: 'Tell me about this company' },
    ];
    const suggestions = generateSmartSuggestions(messages, context);
    // Should use "tell me about" context, not "top buyers"
    expect(suggestions.some(s => s.intent === 'explore_history' || s.intent === 'explore_strategy')).toBe(true);
  });
});
