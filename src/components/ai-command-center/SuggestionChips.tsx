/**
 * SuggestionChips.tsx
 *
 * Context-aware suggestion chips for the AI Command Center.
 * Includes the empty-state welcome screen (EmptyState), page-aware
 * initial suggestions (getSuggestions), and follow-up suggestions
 * after assistant replies (FollowUpSuggestions).
 *
 * Extracted from AICommandCenterPanel.tsx
 */
import { Sparkles } from 'lucide-react';

// ---------- Page-aware initial suggestions ----------

export function getSuggestions(page?: string): string[] {
  switch (page) {
    case 'deal_detail':
      return [
        'Give me a quick summary of this deal',
        'Who are the top buyers for this deal?',
        'What tasks are overdue?',
        'Prep me for my next meeting',
      ];
    case 'buyers_list':
    case 'remarketing_buyers':
      return [
        'Select all buyers in Texas',
        'Filter to PE firms with fee agreements',
        'Who are the most active acquirers?',
        'Show buyers targeting $5M+ revenue',
      ];
    case 'remarketing_deals':
    case 'remarketing':
      return [
        'Which deals should I prioritize this week?',
        'Show deals that need enrichment',
        'Compare our top scoring deals',
        'What happened this week?',
      ];
    case 'universe_detail':
      return [
        'How well do the buyers fit this universe?',
        'Which buyers should I add to this universe?',
        'Show the score breakdown for top buyers',
        'What does the industry guide say?',
      ];
    case 'universes':
      return [
        'Which universes have the most buyers?',
        'Show universes with pending scores',
        'Compare universe criteria',
        'Find universes for HVAC deals',
      ];
    case 'pipeline':
      return [
        'Give me a pipeline summary',
        'Which deals need attention?',
        'Show me CP Target deals',
        'What happened this week?',
      ];
    default:
      return [
        'Give me my daily briefing',
        'Show pipeline health',
        'What tasks do I have today?',
        'Find buyers in the Southeast',
      ];
  }
}

// ---------- Empty state (welcome screen) ----------

interface EmptyStateProps {
  suggestions: string[];
  onSuggestion: (text: string) => void;
}

export function EmptyState({ suggestions, onSuggestion }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F7F4DD] mb-4">
        <Sparkles className="h-6 w-6 text-[#DEC76B]" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">AI Command Center</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Search any deal, buyer, or lead. Take actions. Get insights.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s)}
            className="text-sm px-3 py-1.5 rounded-full border border-[#DEC76B]/40 text-[#0E101A] hover:bg-[#F7F4DD] transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Follow-up suggestions ----------

interface FollowUpSuggestionsProps {
  category?: string;
  onSuggestion: (text: string) => void;
}

export function FollowUpSuggestions({ category, onSuggestion }: FollowUpSuggestionsProps) {
  const suggestions: Record<string, string[]> = {
    PIPELINE_ANALYTICS: [
      'Which deals need attention?',
      'Show deals by industry',
      'What changed this week?',
    ],
    DEAL_STATUS: [
      'Who are the top buyers for this deal?',
      'Show me the deal timeline',
      'Any overdue tasks?',
    ],
    BUYER_SEARCH: [
      'Score these buyers against our top deal',
      'Show engagement history',
      'Draft outreach to top matches',
    ],
    CONTACTS: [
      'Enrich missing contact emails',
      'Push contacts to dialer',
      'Find more contacts at this firm',
    ],
    MEETING_INTEL: [
      'Summarize key takeaways',
      'What action items came up?',
      'Search for pricing discussions',
    ],
    DAILY_BRIEFING: [
      'Show my overdue tasks',
      'Any new buyer engagement?',
      'Which deals went quiet?',
    ],
    ENGAGEMENT: [
      'Who viewed our data room?',
      'Show pass reasons this month',
      'Which buyers are most engaged?',
    ],
    OUTREACH_DRAFT: ['Refine the tone', 'Make it shorter', 'Add deal metrics to the draft'],
    FOLLOW_UP: ['Show stale deals', 'Create follow-up tasks', 'Who needs a call this week?'],
    REMARKETING: [
      'Show score breakdown for these buyers',
      'Draft outreach to the top match',
      'Which buyers are still pending?',
    ],
    BUYER_UNIVERSE: [
      'Which buyers fit best in this universe?',
      'Show deals linked to this universe',
      'Compare buyer alignment scores',
    ],
    BUYER_ANALYSIS: [
      "Explain this buyer's score breakdown",
      'Show acquisition history',
      'Find similar buyers',
    ],
  };

  const items = suggestions[category || ''] || [
    'Show pipeline summary',
    'Find top buyers',
    'Give me my briefing',
  ];

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((s, i) => (
        <button
          key={i}
          onClick={() => onSuggestion(s)}
          className="text-xs px-2.5 py-1 rounded-full border border-[#DEC76B]/30 text-[#0E101A]/70 hover:bg-[#F7F4DD] hover:text-[#0E101A] transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
