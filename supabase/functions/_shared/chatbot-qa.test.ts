/**
 * SourceCo AI Chatbot — Question-Answering & Task Execution Tests
 *
 * Comprehensive tests covering the chatbot's help mode (Q&A) and action mode
 * (task execution) from the SourceCo Testing Guide. Tests pure logic,
 * parsing, and validation without external API calls.
 *
 * PART 1: Question-Answering (Help Mode)
 * PART 2: Task Execution (Action Mode)
 * PART 3: Conversation Context
 * PART 4: Permission & Governance
 * PART 5: Error Handling
 * PART 6: Edge Cases & Stress Testing
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// PART 1: QUESTION-ANSWERING MODE (Help Mode)
// ============================================================================

describe('PART 1: Question-Answering Mode', () => {
  // 1.1 Simple "How-To" Questions
  describe('1.1 Simple how-to question classification', () => {
    function isHowToQuestion(query: string): boolean {
      return /^(how (do|can|to)|what.?s the (way|process|step)|walk me through|guide me|help me)\b/i.test(
        query,
      );
    }

    it('identifies "How do I create a new deal?"', () => {
      expect(isHowToQuestion('How do I create a new deal?')).toBe(true);
    });

    it('identifies "How can I export deals as CSV?"', () => {
      expect(isHowToQuestion('How can I export deals as CSV?')).toBe(true);
    });

    it('identifies "Walk me through creating a deal"', () => {
      expect(isHowToQuestion('Walk me through creating a deal')).toBe(true);
    });

    it('does not identify action requests as how-to', () => {
      expect(isHowToQuestion('Create a new deal')).toBe(false);
      expect(isHowToQuestion('Find contacts at Trivest')).toBe(false);
    });
  });

  // 1.2 "Why" and Troubleshooting Questions
  describe('1.2 Why/troubleshooting classification', () => {
    function isTroubleshootingQuestion(query: string): boolean {
      return /^(why|what.?s wrong|not working|can.?t|issue|problem|error|broken|fail)/i.test(query);
    }

    it('identifies "Why can\'t I message this buyer?"', () => {
      expect(isTroubleshootingQuestion("Why can't I message this buyer?")).toBe(true);
    });

    it('identifies "What\'s wrong with deal scoring?"', () => {
      expect(isTroubleshootingQuestion("What's wrong with deal scoring?")).toBe(true);
    });

    it('identifies "This is not working"', () => {
      expect(isTroubleshootingQuestion('Not working properly')).toBe(true);
    });
  });

  // 1.5 System Logic Questions
  describe('1.5 System logic question classification', () => {
    function isSystemQuestion(query: string): boolean {
      return /\b(how does|how is|algorithm|system|process|logic|calculate|formula)\b/i.test(query);
    }

    it('identifies "How does the deal ranking algorithm work?"', () => {
      expect(isSystemQuestion('How does the deal ranking algorithm work?')).toBe(true);
    });

    it('identifies "How is the score calculated?"', () => {
      expect(isSystemQuestion('How is the score calculated?')).toBe(true);
    });
  });
});

// ============================================================================
// PART 2: TASK EXECUTION MODE (Action Mode)
// ============================================================================

describe('PART 2: Task Execution Mode', () => {
  // 2.1 Content Creation Parameter Extraction
  describe('2.1 Content creation parameter parsing', () => {
    interface ContentParams {
      format?: string;
      topic?: string;
      sources?: string[];
    }

    function parseContentRequest(query: string): ContentParams | null {
      const formatMap: Record<string, string> = {
        'linkedin post': 'linkedin_text',
        'blog post': 'blog',
        'blog article': 'blog',
        newsletter: 'newsletter',
        'twitter thread': 'twitter_thread',
        tweet: 'twitter_thread',
        video: 'video_short',
        podcast: 'podcast_script',
      };

      const sourceMap: Record<string, string> = {
        'knowledge base': 'knowledge_base',
        fireflies: 'fireflies',
        transcripts: 'fireflies',
        calls: 'fireflies',
      };

      let format: string | undefined;
      const lowerQuery = query.toLowerCase();

      for (const [pattern, value] of Object.entries(formatMap)) {
        if (lowerQuery.includes(pattern)) {
          format = value;
          break;
        }
      }

      const sources: string[] = [];
      for (const [pattern, value] of Object.entries(sourceMap)) {
        if (lowerQuery.includes(pattern)) {
          sources.push(value);
        }
      }

      // Extract topic (text between "about" and next keyword or end)
      const topicMatch = query.match(/about\s+(.+?)(?:\s+(?:using|from|based|with)|$)/i);
      const topic = topicMatch?.[1]?.trim();

      if (!format && !topic) return null;

      return { format, topic, sources: sources.length > 0 ? sources : undefined };
    }

    it('parses "Create a LinkedIn post about HVAC market"', () => {
      const result = parseContentRequest('Create a LinkedIn post about HVAC market');
      expect(result).not.toBeNull();
      expect(result?.format).toBe('linkedin_text');
      expect(result?.topic).toBe('HVAC market');
    });

    it('parses content with source specification', () => {
      const result = parseContentRequest(
        'Create a blog post about collision repair using knowledge base and Fireflies',
      );
      expect(result?.format).toBe('blog');
      expect(result?.topic).toBe('collision repair');
      expect(result?.sources).toContain('knowledge_base');
      expect(result?.sources).toContain('fireflies');
    });

    it('recognizes "tweet" as twitter_thread', () => {
      const result = parseContentRequest('Create a tweet about M&A trends');
      expect(result?.format).toBe('twitter_thread');
    });

    it('returns null for non-content requests', () => {
      const result = parseContentRequest('Find contacts at Trivest');
      expect(result).toBeNull();
    });
  });

  // 2.4 Search source parsing
  describe('2.4 Search source parsing', () => {
    function parseSearchSource(query: string): string | null {
      const lowerQuery = query.toLowerCase();
      if (
        lowerQuery.includes('fireflies') ||
        lowerQuery.includes('transcript') ||
        lowerQuery.includes('call')
      ) {
        return 'fireflies';
      }
      if (
        lowerQuery.includes('knowledge base') ||
        lowerQuery.includes('help article') ||
        lowerQuery.includes('documentation')
      ) {
        return 'knowledge_base';
      }
      if (lowerQuery.includes('buyer') || lowerQuery.includes('deal')) {
        return 'database';
      }
      return null;
    }

    it('identifies Fireflies as source', () => {
      expect(parseSearchSource('Search Fireflies for calls about valuation')).toBe('fireflies');
    });

    it('identifies knowledge base as source', () => {
      expect(parseSearchSource('Search knowledge base for how to export')).toBe('knowledge_base');
    });

    it('identifies database as source', () => {
      expect(parseSearchSource('Search our buyer database for HVAC firms')).toBe('database');
    });

    it('returns null for ambiguous queries', () => {
      expect(parseSearchSource('Search for something')).toBeNull();
    });
  });

  // 2.7 Queue operations
  describe('2.7 Queue operation parsing', () => {
    function parseQueueAction(query: string): { action: string; queue?: string } | null {
      const moveMatch = query.match(
        /\b(move|add|put)\b.*?\b(to|into)\b\s+(?:the\s+)?([\w]+)\s+queue/i,
      );
      if (moveMatch) {
        return { action: 'move', queue: moveMatch[3].toLowerCase() };
      }

      const scheduleMatch = query.match(/\b(schedule|post|publish)\b.*?\b(for|on|at)\b/i);
      if (scheduleMatch) {
        return { action: 'schedule' };
      }

      return null;
    }

    it('parses "Move the HVAC post to the CEO queue"', () => {
      const result = parseQueueAction('Move the HVAC post to the CEO queue');
      expect(result?.action).toBe('move');
      expect(result?.queue).toBe('ceo');
    });

    it('parses "Add the analysis to SourceCo queue"', () => {
      const result = parseQueueAction('Add the analysis to SourceCo queue');
      expect(result?.action).toBe('move');
      expect(result?.queue).toBe('sourceco');
    });

    it('parses "Schedule the post for tomorrow"', () => {
      const result = parseQueueAction('Schedule the post for tomorrow at 9 AM');
      expect(result?.action).toBe('schedule');
    });

    it('returns null for non-queue actions', () => {
      expect(parseQueueAction('Create a new post')).toBeNull();
    });
  });

  // 2.8 Schedule date parsing
  describe('2.8 Schedule date parsing', () => {
    function parseRelativeDate(input: string, referenceDate: Date): Date | null {
      const lower = input.toLowerCase();

      if (lower.includes('tomorrow')) {
        const d = new Date(referenceDate);
        d.setDate(d.getDate() + 1);
        return d;
      }

      if (lower.includes('next week')) {
        const d = new Date(referenceDate);
        d.setDate(d.getDate() + 7);
        return d;
      }

      if (lower.includes('next month')) {
        const d = new Date(referenceDate);
        d.setMonth(d.getMonth() + 1);
        return d;
      }

      if (lower.includes('today')) {
        return new Date(referenceDate);
      }

      return null;
    }

    const refDate = new Date('2026-02-24T09:00:00Z');

    it('parses "tomorrow"', () => {
      const result = parseRelativeDate('Schedule for tomorrow', refDate);
      expect(result?.getDate()).toBe(25);
    });

    it('parses "next week"', () => {
      const result = parseRelativeDate('Schedule for next week', refDate);
      expect(result?.getDate()).toBe(3); // Feb 24 + 7 = Mar 3
    });

    it('parses "today"', () => {
      const result = parseRelativeDate('Schedule for today', refDate);
      expect(result?.getDate()).toBe(24);
    });

    it('returns null for unparseable dates', () => {
      const result = parseRelativeDate('Schedule for someday', refDate);
      expect(result).toBeNull();
    });

    it('does not parse "yesterday" (past date)', () => {
      // The function doesn't parse yesterday — it should return null
      const result = parseRelativeDate('Schedule for yesterday', refDate);
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// PART 3: CONVERSATION CONTEXT
// ============================================================================

describe('PART 3: Conversation Context', () => {
  describe('3.1 Maintaining conversation state', () => {
    interface ConversationMessage {
      role: 'user' | 'assistant';
      content: string;
      metadata?: { entity_id?: string; entity_type?: string; results?: unknown[] };
    }

    function getLastEntityFromHistory(
      history: ConversationMessage[],
    ): { id?: string; type?: string } | null {
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.metadata?.entity_id) {
          return { id: msg.metadata.entity_id, type: msg.metadata.entity_type };
        }
      }
      return null;
    }

    it('retrieves last entity from conversation history', () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'Tell me about deal ABC' },
        {
          role: 'assistant',
          content: 'Deal ABC is...',
          metadata: { entity_id: 'abc-123', entity_type: 'deal' },
        },
        { role: 'user', content: 'What about the status?' },
      ];
      const entity = getLastEntityFromHistory(history);
      expect(entity?.id).toBe('abc-123');
      expect(entity?.type).toBe('deal');
    });

    it('returns null when no entity in history', () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      expect(getLastEntityFromHistory(history)).toBeNull();
    });

    it('gets most recent entity (not first)', () => {
      const history: ConversationMessage[] = [
        { role: 'assistant', content: 'Deal A', metadata: { entity_id: 'a', entity_type: 'deal' } },
        { role: 'assistant', content: 'Deal B', metadata: { entity_id: 'b', entity_type: 'deal' } },
      ];
      const entity = getLastEntityFromHistory(history);
      expect(entity?.id).toBe('b');
    });
  });

  describe('3.2 Multi-step workflow tracking', () => {
    interface WorkflowStep {
      name: string;
      status: 'pending' | 'running' | 'complete' | 'failed';
      result?: unknown;
    }

    function advanceWorkflow(steps: WorkflowStep[]): { current: number; complete: boolean } {
      const currentIndex = steps.findIndex((s) => s.status === 'pending' || s.status === 'running');
      const allComplete = steps.every((s) => s.status === 'complete');
      return { current: currentIndex === -1 ? steps.length : currentIndex, complete: allComplete };
    }

    it('tracks progress through workflow steps', () => {
      const steps: WorkflowStep[] = [
        { name: 'Search Fireflies', status: 'complete' },
        { name: 'Extract insights', status: 'running' },
        { name: 'Create content', status: 'pending' },
      ];
      const { current, complete } = advanceWorkflow(steps);
      expect(current).toBe(1);
      expect(complete).toBe(false);
    });

    it('reports complete when all steps done', () => {
      const steps: WorkflowStep[] = [
        { name: 'Search', status: 'complete' },
        { name: 'Create', status: 'complete' },
      ];
      const { complete } = advanceWorkflow(steps);
      expect(complete).toBe(true);
    });

    it('identifies first pending step when none running', () => {
      const steps: WorkflowStep[] = [
        { name: 'Step 1', status: 'complete' },
        { name: 'Step 2', status: 'pending' },
        { name: 'Step 3', status: 'pending' },
      ];
      const { current } = advanceWorkflow(steps);
      expect(current).toBe(1);
    });
  });
});

// ============================================================================
// PART 4: PERMISSION & GOVERNANCE
// ============================================================================

describe('PART 4: Permission & Governance', () => {
  describe('4.1 Permission checking', () => {
    type Role = 'admin' | 'manager' | 'analyst' | 'viewer';

    interface Permission {
      action: string;
      requiredRole: Role;
    }

    const PERMISSIONS: Permission[] = [
      { action: 'create_content', requiredRole: 'analyst' },
      { action: 'move_to_queue', requiredRole: 'manager' },
      { action: 'schedule_content', requiredRole: 'manager' },
      { action: 'manage_knowledge_base', requiredRole: 'admin' },
      { action: 'bulk_operations', requiredRole: 'admin' },
      { action: 'view_analytics', requiredRole: 'viewer' },
      { action: 'search_contacts', requiredRole: 'analyst' },
      { action: 'delete_content', requiredRole: 'admin' },
    ];

    const ROLE_HIERARCHY: Record<Role, number> = {
      viewer: 0,
      analyst: 1,
      manager: 2,
      admin: 3,
    };

    function hasPermission(userRole: Role, action: string): boolean {
      const perm = PERMISSIONS.find((p) => p.action === action);
      if (!perm) return false;
      return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[perm.requiredRole];
    }

    it('admin can perform all actions', () => {
      expect(hasPermission('admin', 'create_content')).toBe(true);
      expect(hasPermission('admin', 'manage_knowledge_base')).toBe(true);
      expect(hasPermission('admin', 'delete_content')).toBe(true);
      expect(hasPermission('admin', 'bulk_operations')).toBe(true);
    });

    it('manager can create content but not manage knowledge base', () => {
      expect(hasPermission('manager', 'create_content')).toBe(true);
      expect(hasPermission('manager', 'move_to_queue')).toBe(true);
      expect(hasPermission('manager', 'manage_knowledge_base')).toBe(false);
    });

    it('analyst can create content but not schedule', () => {
      expect(hasPermission('analyst', 'create_content')).toBe(true);
      expect(hasPermission('analyst', 'search_contacts')).toBe(true);
      expect(hasPermission('analyst', 'schedule_content')).toBe(false);
    });

    it('viewer can only view analytics', () => {
      expect(hasPermission('viewer', 'view_analytics')).toBe(true);
      expect(hasPermission('viewer', 'create_content')).toBe(false);
      expect(hasPermission('viewer', 'delete_content')).toBe(false);
    });

    it('returns false for unknown actions', () => {
      expect(hasPermission('admin', 'nonexistent_action')).toBe(false);
    });
  });

  describe('4.2 Confirmation for dangerous actions', () => {
    function requiresConfirmation(action: string, itemCount: number): boolean {
      const dangerousActions = ['delete', 'bulk_delete', 'bulk_move', 'archive'];
      if (dangerousActions.includes(action)) return true;
      if (itemCount > 5 && action.startsWith('bulk_')) return true;
      return false;
    }

    it('requires confirmation for delete', () => {
      expect(requiresConfirmation('delete', 1)).toBe(true);
    });

    it('requires confirmation for bulk operations on 5+ items', () => {
      expect(requiresConfirmation('bulk_move', 10)).toBe(true);
    });

    it('does not require confirmation for single move', () => {
      expect(requiresConfirmation('move', 1)).toBe(false);
    });

    it('requires confirmation for archive', () => {
      expect(requiresConfirmation('archive', 1)).toBe(true);
    });
  });
});

// ============================================================================
// PART 5: ERROR HANDLING & RECOVERY
// ============================================================================

describe('PART 5: Error Handling', () => {
  describe('5.1 API error handling', () => {
    function categorizeError(status: number): 'retry' | 'auth' | 'client' | 'server' {
      if (status === 401 || status === 403) return 'auth';
      if (status === 429) return 'retry';
      if (status >= 400 && status < 500) return 'client';
      if (status >= 500) return 'server';
      return 'client';
    }

    it('categorizes 401 as auth error', () => {
      expect(categorizeError(401)).toBe('auth');
    });

    it('categorizes 403 as auth error', () => {
      expect(categorizeError(403)).toBe('auth');
    });

    it('categorizes 429 as retry', () => {
      expect(categorizeError(429)).toBe('retry');
    });

    it('categorizes 400 as client error', () => {
      expect(categorizeError(400)).toBe('client');
    });

    it('categorizes 500 as server error', () => {
      expect(categorizeError(500)).toBe('server');
    });

    it('categorizes 503 as server error', () => {
      expect(categorizeError(503)).toBe('server');
    });
  });

  describe('5.2 Input parsing robustness', () => {
    function sanitizeQuery(query: string): string {
      // eslint-disable-next-line no-control-regex
      const controlChars = /[\x00-\x1F\x7F]/g;
      return query
        .replace(controlChars, '') // Remove control characters
        .trim()
        .slice(0, 2000); // Max length
    }

    it('trims whitespace', () => {
      expect(sanitizeQuery('  hello  ')).toBe('hello');
    });

    it('removes control characters', () => {
      expect(sanitizeQuery('hello\x00world')).toBe('helloworld');
    });

    it('limits length to 2000 chars', () => {
      const longInput = 'a'.repeat(3000);
      expect(sanitizeQuery(longInput).length).toBe(2000);
    });

    it('handles empty input', () => {
      expect(sanitizeQuery('')).toBe('');
    });
  });

  describe('5.3 Hallucination detection', () => {
    function detectPossibleHallucination(response: string): boolean {
      const hallucIndicators = [
        /I.?m not sure .* but/i,
        /I think .* might/i,
        /As of my .* knowledge/i,
        /I don.?t have .* data/i,
      ];

      // Check if response matches hedging/uncertainty patterns
      if (hallucIndicators.some((pattern) => pattern.test(response))) {
        return true;
      }

      // Check if response references nonexistent features
      const fakeFeatures = ['hubspot integration', 'salesforce sync', 'slack integration'];
      for (const feature of fakeFeatures) {
        if (
          response.toLowerCase().includes(feature) &&
          !response.toLowerCase().includes("don't have") &&
          !response.toLowerCase().includes('not available')
        ) {
          return true;
        }
      }

      return false;
    }

    it('detects reference to nonexistent Hubspot integration', () => {
      expect(
        detectPossibleHallucination('You can use the Hubspot integration to sync contacts'),
      ).toBe(true);
    });

    it('does not flag legitimate denial of feature', () => {
      expect(detectPossibleHallucination("We don't have a Hubspot integration yet")).toBe(false);
    });

    it('does not flag normal responses', () => {
      expect(detectPossibleHallucination('Here are your top 10 deals ranked by EBITDA')).toBe(
        false,
      );
    });
  });
});

// ============================================================================
// PART 6: EDGE CASES & STRESS TESTING
// ============================================================================

describe('PART 6: Edge Cases', () => {
  describe('6.1 Ambiguous company names', () => {
    function disambiguateCompany(
      name: string,
      knownCompanies: Array<{ name: string; id: string }>,
    ): Array<{ name: string; id: string }> {
      const lower = name.toLowerCase();
      return knownCompanies.filter((c) => c.name.toLowerCase().includes(lower));
    }

    it('finds exact match', () => {
      const known = [
        { name: 'Sterling Partners', id: '1' },
        { name: 'Sterling Capital', id: '2' },
        { name: 'Trivest Partners', id: '3' },
      ];
      const matches = disambiguateCompany('Sterling Partners', known);
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('1');
    });

    it('finds multiple matches for ambiguous name', () => {
      const known = [
        { name: 'Sterling Partners', id: '1' },
        { name: 'Sterling Capital', id: '2' },
        { name: 'Trivest Partners', id: '3' },
      ];
      const matches = disambiguateCompany('Sterling', known);
      expect(matches).toHaveLength(2);
    });

    it('returns empty for unknown company', () => {
      const known = [{ name: 'Trivest Partners', id: '1' }];
      const matches = disambiguateCompany('Nonexistent Corp', known);
      expect(matches).toHaveLength(0);
    });
  });

  describe('6.2 Data gap handling', () => {
    interface DataAvailability {
      hasTranscripts: boolean;
      hasBuyers: boolean;
      hasDeals: boolean;
      hasContacts: boolean;
    }

    function getAvailableSources(data: DataAvailability): string[] {
      const sources: string[] = [];
      if (data.hasTranscripts) sources.push('fireflies');
      if (data.hasBuyers) sources.push('buyer_database');
      if (data.hasDeals) sources.push('deals');
      if (data.hasContacts) sources.push('contacts');
      return sources;
    }

    function generateDataGapMessage(requestedSource: string, available: string[]): string | null {
      if (available.includes(requestedSource)) return null;
      const alternatives =
        available.length > 0 ? `Try: ${available.join(', ')}` : 'No data sources available';
      return `No ${requestedSource} data available. ${alternatives}`;
    }

    it('lists available data sources', () => {
      const sources = getAvailableSources({
        hasTranscripts: true,
        hasBuyers: true,
        hasDeals: false,
        hasContacts: true,
      });
      expect(sources).toContain('fireflies');
      expect(sources).toContain('buyer_database');
      expect(sources).not.toContain('deals');
    });

    it('generates data gap message', () => {
      const msg = generateDataGapMessage('fireflies', ['buyer_database', 'deals']);
      expect(msg).toContain('No fireflies data available');
      expect(msg).toContain('buyer_database');
    });

    it('returns null when source is available', () => {
      expect(generateDataGapMessage('fireflies', ['fireflies', 'deals'])).toBeNull();
    });
  });

  describe('6.3 Contradictory data detection', () => {
    function detectContradiction(
      source1: { field: string; value: number },
      source2: { field: string; value: number },
      threshold: number = 0.5,
    ): boolean {
      if (source1.field !== source2.field) return false;
      if (source1.value === 0 || source2.value === 0) return false;

      const diff = Math.abs(source1.value - source2.value);
      const avg = (source1.value + source2.value) / 2;
      return diff / avg > threshold;
    }

    it('detects EBITDA contradiction between deal record and transcript', () => {
      // Deal says $2M, transcript says $1M — that's a 66% discrepancy (exceeds 50% threshold)
      expect(
        detectContradiction(
          { field: 'ebitda', value: 2_000_000 },
          { field: 'ebitda', value: 1_000_000 },
        ),
      ).toBe(true);
    });

    it('does not flag similar values', () => {
      // $2M vs $2.1M — only 5% difference
      expect(
        detectContradiction(
          { field: 'ebitda', value: 2_000_000 },
          { field: 'ebitda', value: 2_100_000 },
        ),
      ).toBe(false);
    });

    it('does not flag different fields', () => {
      expect(
        detectContradiction(
          { field: 'ebitda', value: 2_000_000 },
          { field: 'revenue', value: 10_000_000 },
        ),
      ).toBe(false);
    });
  });

  describe('6.4 Large dataset handling', () => {
    function paginate<T>(
      items: T[],
      page: number,
      pageSize: number,
    ): { data: T[]; total: number; hasMore: boolean } {
      const start = page * pageSize;
      const data = items.slice(start, start + pageSize);
      return {
        data,
        total: items.length,
        hasMore: start + pageSize < items.length,
      };
    }

    it('paginates large result sets', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const page1 = paginate(items, 0, 20);
      expect(page1.data).toHaveLength(20);
      expect(page1.total).toBe(100);
      expect(page1.hasMore).toBe(true);
    });

    it('handles last page', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));
      const page2 = paginate(items, 1, 20);
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(false);
    });

    it('handles empty dataset', () => {
      const result = paginate([], 0, 20);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('6.5 No matching results', () => {
    function formatNoResultsMessage(query: string, source: string): string {
      return `No results found for "${query}" in ${source}. Try broadening your search or using different keywords.`;
    }

    it('generates helpful no-results message', () => {
      const msg = formatNoResultsMessage('underwater basket weavers buying HVAC', 'buyer database');
      expect(msg).toContain('No results found');
      expect(msg).toContain('underwater basket weavers');
      expect(msg).toContain('buyer database');
    });
  });
});
