/**
 * Interactive QA test scenarios for the AI Chatbot.
 *
 * Scenarios support two modes:
 *  1. Automated — sendAIQuery + auto-validation checks (default)
 *  2. Manual — for multi-turn, UI-only, or edge-case scenarios (skipAutoRun: true)
 */

export type ScenarioSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ScenarioStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip';

export interface AutoValidation {
  expectedRouteCategories?: string[];
  expectedTools?: string[];
  mustContainAny?: string[];
  mustNotContain?: string[];
  minResponseLength?: number;
  requiresToolCalls?: boolean;
}

export interface AutoCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface TestScenario {
  id: string;
  category: string;
  name: string;
  description: string;
  userMessage: string;
  expectedBehavior: string[];
  edgeCases?: string[];
  severity: ScenarioSeverity;
  skipAutoRun?: boolean;
  autoValidation?: AutoValidation;
}

export interface ScenarioResult {
  id: string;
  status: ScenarioStatus;
  notes: string;
  testedAt: string | null;
  aiResponse?: string;
  toolsCalled?: string[];
  routeCategory?: string;
  durationMs?: number;
  autoChecks?: AutoCheckResult[];
  error?: string;
}

export const SCENARIO_STORAGE_KEY = 'sourceco-chatbot-scenario-results';

// ═══════════════════════════════════════════
// Auto-validation engine
// ═══════════════════════════════════════════

export function runAutoChecks(
  scenario: TestScenario,
  response: {
    text: string;
    toolCalls: Array<{ name: string; id: string; success: boolean }>;
    routeInfo: { category: string; tier: string; tools: string[] } | null;
    error: string | null;
  },
): AutoCheckResult[] {
  const checks: AutoCheckResult[] = [];
  const v = scenario.autoValidation;

  checks.push({
    name: 'Response received',
    passed: !!response.text && response.text.length > 0,
    detail: response.text ? `${response.text.length} chars` : 'Empty response',
  });

  if (response.error) {
    checks.push({ name: 'No errors', passed: false, detail: response.error });
  }

  if (!v) return checks;

  if (v.minResponseLength) {
    checks.push({
      name: `Response >= ${v.minResponseLength} chars`,
      passed: response.text.length >= v.minResponseLength,
      detail: `${response.text.length} chars`,
    });
  }

  if (v.expectedRouteCategories && v.expectedRouteCategories.length > 0) {
    const actual = response.routeInfo?.category || 'none';
    checks.push({
      name: 'Route category',
      passed: v.expectedRouteCategories.includes(actual),
      detail: `Expected: ${v.expectedRouteCategories.join(' / ')}, Got: ${actual}`,
    });
  }

  if (v.expectedTools && v.expectedTools.length > 0) {
    const called = response.toolCalls.map((t) => t.name);
    const found = v.expectedTools.some((t) => called.includes(t));
    checks.push({
      name: 'Expected tools used',
      passed: found,
      detail: `Expected any of: ${v.expectedTools.join(', ')}. Called: ${called.join(', ') || 'none'}`,
    });
  }

  if (v.requiresToolCalls) {
    checks.push({
      name: 'Used tools',
      passed: response.toolCalls.length > 0,
      detail:
        response.toolCalls.length > 0
          ? `${response.toolCalls.length} tool(s) called`
          : 'No tools called',
    });
  }

  if (v.mustContainAny && v.mustContainAny.length > 0) {
    const lower = response.text.toLowerCase();
    const found = v.mustContainAny.filter((k) => lower.includes(k.toLowerCase()));
    checks.push({
      name: 'Contains expected keywords',
      passed: found.length > 0,
      detail:
        found.length > 0 ? `Found: ${found.join(', ')}` : `None of: ${v.mustContainAny.join(', ')}`,
    });
  }

  if (v.mustNotContain && v.mustNotContain.length > 0) {
    const lower = response.text.toLowerCase();
    const found = v.mustNotContain.filter((k) => lower.includes(k.toLowerCase()));
    checks.push({
      name: 'No hallucinated content',
      passed: found.length === 0,
      detail: found.length > 0 ? `Found forbidden: ${found.join(', ')}` : 'Clean',
    });
  }

  return checks;
}

// ═══════════════════════════════════════════
// Scenario definitions
// ═══════════════════════════════════════════

export function getChatbotTestScenarios(): TestScenario[] {
  return [
    // ── HELP MODE — Basic Q&A ──
    {
      id: 'help-howto-basic',
      category: 'Help Mode — Basic Q&A',
      name: 'Simple how-to question',
      description: 'Verify the bot answers basic platform questions using knowledge articles.',
      userMessage: 'How do I create a new deal?',
      expectedBehavior: [
        'Returns step-by-step instructions',
        'References the relevant knowledge article or source',
        'Offers follow-up options or related topics',
        'Tone is clear and professional',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 100,
        mustContainAny: ['deal', 'create', 'step', 'click', 'navigate'],
      },
    },
    {
      id: 'help-howto-no-article',
      category: 'Help Mode — Basic Q&A',
      name: 'Question with no knowledge article',
      description: 'Verify graceful handling when no knowledge article matches.',
      userMessage: 'How do I export deals as a CSV?',
      expectedBehavior: [
        'Does NOT hallucinate instructions for a non-existent feature',
        "Acknowledges it doesn't have specific instructions",
        'May suggest related features or a support contact',
      ],
      edgeCases: ['Try: "How do I integrate with Hubspot?" (non-existent feature)'],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['click export csv', 'go to file > export', 'download csv button'],
      },
    },
    {
      id: 'help-howto-vague',
      category: 'Help Mode — Basic Q&A',
      name: 'Vague question',
      description: 'Verify the bot asks for clarification on overly vague questions.',
      userMessage: 'How do I use the platform?',
      expectedBehavior: [
        'Asks clarifying questions or provides a high-level overview',
        'Does not dump an overwhelming wall of text',
        'Suggests specific topics the user might be interested in',
      ],
      severity: 'high',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'help-howto-nonexistent',
      category: 'Help Mode — Basic Q&A',
      name: 'Non-existent feature (hallucination check)',
      description: "Verify the bot does NOT invent instructions for features that don't exist.",
      userMessage: 'How do I set up the Salesforce integration?',
      expectedBehavior: [
        'Does NOT provide step-by-step instructions for a Salesforce integration',
        'Clearly states this feature is not available or not recognized',
        'May suggest existing integrations or support channels',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: [
          'go to settings > integrations > salesforce',
          'enter your salesforce api key',
          'click connect to salesforce',
        ],
      },
    },
    {
      id: 'help-followup',
      category: 'Help Mode — Basic Q&A',
      name: 'Follow-up question',
      description: 'After an initial answer, verify the bot handles follow-ups in context.',
      userMessage: 'How do I enrich a deal? (then follow up with: What if enrichment fails?)',
      expectedBehavior: [
        'First response explains deal enrichment',
        'Follow-up response addresses failure scenarios in context',
        'Does not lose the conversation thread',
      ],
      severity: 'high',
      skipAutoRun: true,
    },
    {
      id: 'help-same-question-twice',
      category: 'Help Mode — Basic Q&A',
      name: 'Same question asked twice',
      description: 'Verify the bot handles repeated questions gracefully.',
      userMessage: 'How do I create a new deal? (ask the same question again)',
      expectedBehavior: [
        'Provides the same accurate information both times',
        'May acknowledge the question was already answered',
        'Response quality does not degrade',
      ],
      severity: 'low',
      skipAutoRun: true,
    },

    // ── HELP MODE — Troubleshooting ──
    {
      id: 'help-troubleshoot-why',
      category: 'Help Mode — Troubleshooting',
      name: 'Why-question troubleshooting',
      description: 'Verify the bot can help diagnose issues with a "why" question.',
      userMessage: "Why can't I message this buyer?",
      expectedBehavior: [
        'Checks common causes (permissions, buyer status, NDA status)',
        'Provides actionable steps to resolve',
        'Does not blame the user',
      ],
      severity: 'high',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['permission', 'access', 'nda', 'status', 'connection', 'contact'],
      },
    },
    {
      id: 'help-troubleshoot-by-design',
      category: 'Help Mode — Troubleshooting',
      name: 'Working-as-designed behavior',
      description: 'Verify the bot explains intentional limitations.',
      userMessage: "Why can't I edit a deal after it's been published?",
      expectedBehavior: [
        'Explains the business logic behind the restriction',
        'Suggests proper workflow (e.g., unpublish first, contact admin)',
        'Does not promise the feature will change',
      ],
      severity: 'medium',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'help-troubleshoot-unknown',
      category: 'Help Mode — Troubleshooting',
      name: "Bot doesn't know the answer",
      description: 'Verify graceful handling when the bot cannot diagnose the issue.',
      userMessage: 'Why is the deal scoring algorithm giving my deal a low score?',
      expectedBehavior: [
        'Acknowledges the complexity of the question',
        'Provides general scoring factor information if available',
        'Suggests consulting the scoring documentation or admin',
        'Does NOT make up specific scoring weights',
      ],
      severity: 'high',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['the exact formula is', 'weight of 0.35', 'precisely calculated as 40%'],
      },
    },

    // ── HELP MODE — Context Awareness ──
    {
      id: 'help-context-current-page',
      category: 'Help Mode — Context Awareness',
      name: 'Current page context',
      description: 'Verify the bot uses the current page context.',
      userMessage: 'What am I looking at?',
      expectedBehavior: [
        'References the current deal by name if context is available',
        'Describes what information is shown on the current page',
        'Uses the context type (deal/buyers/universe) correctly',
      ],
      severity: 'high',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'help-context-none',
      category: 'Help Mode — Context Awareness',
      name: 'No context available',
      description: 'Verify the bot handles queries when there is no specific context.',
      userMessage: 'Tell me about this deal',
      expectedBehavior: [
        'Asks which deal the user is referring to',
        'Does NOT hallucinate a deal name or data',
        'May suggest navigating to a specific deal page',
      ],
      severity: 'high',
      autoValidation: { minResponseLength: 50 },
    },

    // ── HELP MODE — Multi-Source Synthesis ──
    {
      id: 'help-multisource-workflow',
      category: 'Help Mode — Multi-Source Synthesis',
      name: 'Complex workflow walkthrough',
      description: 'Verify the bot can synthesize info from multiple sources for a complex topic.',
      userMessage:
        'Walk me through the complete process of creating a deal, enriching it, running scoring, and sending it to buyers.',
      expectedBehavior: [
        'Provides a coherent multi-step walkthrough',
        'Covers all four stages mentioned',
        'Steps are in the correct order',
        'References relevant features accurately',
      ],
      severity: 'medium',
      autoValidation: {
        minResponseLength: 200,
        mustContainAny: ['create', 'enrich', 'scor', 'buyer'],
      },
    },
    {
      id: 'help-multisource-comparison',
      category: 'Help Mode — Multi-Source Synthesis',
      name: 'Feature comparison',
      description: 'Verify the bot can compare two platform features accurately.',
      userMessage:
        "What's the difference between the marketplace messaging and the remarketing outreach?",
      expectedBehavior: [
        'Clearly distinguishes between the two features',
        'Describes when to use each one',
        'Does not conflate the two features',
      ],
      severity: 'medium',
      autoValidation: {
        minResponseLength: 100,
        mustContainAny: ['messaging', 'remarketing', 'outreach'],
      },
    },

    // ── HELP MODE — System Logic ──
    {
      id: 'help-system-algorithm',
      category: 'Help Mode — System Logic',
      name: 'Algorithm explanation',
      description: 'Verify the bot can explain system logic like deal scoring.',
      userMessage: 'How does the deal ranking algorithm work?',
      expectedBehavior: [
        'Explains the general scoring methodology',
        'Mentions key factors if documented',
        'Does NOT invent specific weights or formulas if not documented',
        'Suggests where to find more details',
      ],
      severity: 'medium',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['the exact formula is', 'weight of 0.35'],
      },
    },

    // ── ACTION MODE — Content Creation ──
    {
      id: 'action-create-content',
      category: 'Action Mode — Content Creation',
      name: 'Create content from data sources',
      description: 'Verify the bot can create content based on platform data.',
      userMessage:
        'Create a LinkedIn post analyzing the collision repair market based on our recent deals.',
      expectedBehavior: [
        'Generates a draft post with relevant content',
        'References actual deal data if available',
        'Content is professional and well-formatted',
        'Asks for confirmation before publishing',
      ],
      edgeCases: ['Try without specifying the industry — should ask for clarification'],
      severity: 'high',
      autoValidation: {
        minResponseLength: 100,
        requiresToolCalls: true,
        mustContainAny: ['collision repair', 'collision', 'auto body', 'post', 'linkedin'],
      },
    },
    {
      id: 'action-create-missing-params',
      category: 'Action Mode — Content Creation',
      name: 'Create content — missing parameters',
      description: 'Verify the bot asks for missing info rather than guessing.',
      userMessage: 'Create a post about the market.',
      expectedBehavior: [
        'Asks clarifying questions (which market? what type of post?)',
        'Does NOT generate content with made-up specifics',
        'Suggests options for the user to choose from',
      ],
      severity: 'high',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'action-create-from-template',
      category: 'Action Mode — Content Creation',
      name: 'Create content from template',
      description: 'Verify the bot can use a content template.',
      userMessage: 'Create a post using the Market Analysis template for the HVAC industry.',
      expectedBehavior: [
        'Follows the template structure if available',
        'Populates template fields with relevant data',
        "If template doesn't exist, explains and offers alternatives",
      ],
      severity: 'medium',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['hvac', 'template', 'market analysis'],
      },
    },
    {
      id: 'action-repurpose-content',
      category: 'Action Mode — Content Creation',
      name: 'Repurpose existing content',
      description: 'Verify the bot can transform content from one format to another.',
      userMessage: 'Turn the latest HVAC analysis into a LinkedIn carousel outline.',
      expectedBehavior: [
        'Identifies the source content',
        'Restructures for the new format',
        'Maintains key information from the original',
        'Adapts tone and structure for LinkedIn',
      ],
      severity: 'medium',
      autoValidation: { minResponseLength: 50 },
    },

    // ── ACTION MODE — Search & Analysis ──
    {
      id: 'action-search-sources',
      category: 'Action Mode — Search & Analysis',
      name: 'Search data sources',
      description: 'Verify the bot can search Fireflies transcripts or other sources.',
      userMessage: 'Search Fireflies for calls about valuation expectations.',
      expectedBehavior: [
        'Returns relevant search results with context',
        'Shows caller/meeting details',
        'Results are relevant to the query',
        'Offers to dig deeper into specific results',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: [
          'search_fireflies',
          'search_transcripts',
          'search_buyer_transcripts',
          'semantic_transcript_search',
        ],
        mustContainAny: ['valuation', 'call', 'transcript', 'meeting'],
      },
    },
    {
      id: 'action-search-zero-results',
      category: 'Action Mode — Search & Analysis',
      name: 'Search with zero results',
      description: 'Verify graceful handling of searches that return no results.',
      userMessage: 'Search knowledge base for deals on Mars.',
      expectedBehavior: [
        'Clearly states no results were found',
        'Suggests alternative search terms',
        'Does NOT fabricate results',
      ],
      severity: 'high',
      autoValidation: {
        minResponseLength: 30,
        mustNotContain: ['here are the mars deals', 'found 5 results about mars'],
      },
    },
    {
      id: 'action-extract-insights',
      category: 'Action Mode — Search & Analysis',
      name: 'Extract insights from data',
      description: 'Verify the bot can synthesize insights from multiple data points.',
      userMessage: 'What did we learn from recent calls about seller motivation?',
      expectedBehavior: [
        'Synthesizes themes from available data',
        'Cites specific sources when possible',
        'Distinguishes between data-backed insights and inferences',
        'Provides actionable takeaways',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: [
          'search_fireflies',
          'search_transcripts',
          'search_buyer_transcripts',
          'semantic_transcript_search',
        ],
      },
    },
    {
      id: 'action-analyze-performance',
      category: 'Action Mode — Search & Analysis',
      name: 'Analyze performance metrics',
      description: 'Verify the bot can report on performance data.',
      userMessage: 'How are our remarketing campaigns performing this month?',
      expectedBehavior: [
        'Reports on available metrics (outreach, responses, etc.)',
        'Provides comparison context if available',
        'Does not fabricate numbers',
        'Suggests areas for improvement if data supports it',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_outreach_status', 'get_remarketing_outreach', 'get_analytics'],
      },
    },

    // ── ACTION MODE — Content Management ──
    {
      id: 'action-manage-queue',
      category: 'Action Mode — Content Management',
      name: 'Move item to queue',
      description: 'Verify the bot can manage content queues.',
      userMessage: 'Move the HVAC analysis post to the CEO review queue.',
      expectedBehavior: [
        'Identifies the correct post',
        'Moves to the specified queue',
        'Confirms the action was taken',
        'Shows where to find the moved item',
      ],
      edgeCases: ['Try moving to a non-existent queue — should report error clearly'],
      severity: 'medium',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'action-schedule-content',
      category: 'Action Mode — Content Management',
      name: 'Schedule content',
      description: 'Verify the bot can schedule content for future publication.',
      userMessage: 'Schedule the HVAC post for tomorrow at 9 AM.',
      expectedBehavior: [
        'Parses the time correctly',
        'Confirms the schedule date/time',
        'Asks for confirmation before scheduling',
      ],
      edgeCases: [
        'Try scheduling in the past — should warn and suggest future time',
        'Try ambiguous time: "Schedule it for next week" — should ask for specific day/time',
      ],
      severity: 'medium',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'action-bulk-operations',
      category: 'Action Mode — Content Management',
      name: 'Bulk operations',
      description: 'Verify the bot handles bulk operations with appropriate safeguards.',
      userMessage: 'Move all draft HVAC posts to the CEO queue.',
      expectedBehavior: [
        'Lists the items that would be affected',
        'Shows the count of items',
        'Requires confirmation before executing',
        'Reports results after execution',
      ],
      severity: 'high',
      autoValidation: { minResponseLength: 50 },
    },

    // ── ACTION MODE — Contact Research ──
    {
      id: 'action-contact-find',
      category: 'Action Mode — Contact Research',
      name: 'Find contacts at a firm',
      description: 'Verify the bot can research contacts at a specified organization.',
      userMessage: 'Find 8-10 associates, principals, and VPs at Trivest Capital.',
      expectedBehavior: [
        'Returns a list of contacts with names and titles',
        'Contacts are relevant to the specified roles',
        'Data sources are cited',
        'Offers to save or add contacts to the system',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_contacts', 'search_pe_contacts'],
        mustContainAny: ['trivest', 'contact', 'associate', 'principal', 'vp'],
      },
    },
    {
      id: 'action-contact-filter',
      category: 'Action Mode — Contact Research',
      name: 'Filter contacts by criteria',
      description: 'Verify the bot can filter buyers/contacts by complex criteria.',
      userMessage:
        'Show me all PE firms in the Southeast that have acquired companies in the HVAC space.',
      expectedBehavior: [
        'Filters by geography (Southeast) correctly',
        'Filters by industry (HVAC) correctly',
        'Filters by buyer type (PE) correctly',
        'Returns relevant results or explains if none match',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_buyers', 'search_pe_contacts', 'search_contacts'],
      },
    },
    {
      id: 'action-contact-complex',
      category: 'Action Mode — Contact Research',
      name: 'Complex cross-referenced contact search',
      description: 'Verify the bot handles multi-dimensional contact research.',
      userMessage:
        "Find contacts at New Heritage Capital who work in deal sourcing, and check if we've had any calls with them on Fireflies.",
      expectedBehavior: [
        'Searches for contacts at the specified firm',
        'Cross-references with Fireflies call data',
        'Presents a combined view of contact + interaction history',
        'Handles the case where no cross-references exist',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        mustContainAny: ['new heritage', 'contact', 'call'],
      },
    },

    // ── CONVERSATION CONTEXT & MULTI-TURN ──
    {
      id: 'context-multi-turn',
      category: 'Conversation Context',
      name: 'Multi-turn context maintenance',
      description: 'Verify the bot maintains context across multiple messages.',
      userMessage:
        'Show me HVAC deals. (then) Which one has the highest score? (then) Tell me more about that one.',
      expectedBehavior: [
        'First message returns HVAC deals',
        'Second message correctly identifies the highest-scored deal',
        'Third message provides details about the correct deal',
        "Bot doesn't lose track of which deal is being discussed",
      ],
      severity: 'critical',
      skipAutoRun: true,
    },
    {
      id: 'context-ambiguous-reference',
      category: 'Conversation Context',
      name: 'Ambiguous pronoun reference',
      description: 'Verify the bot handles "it", "that", "this" correctly in context.',
      userMessage: 'Search for HVAC deals. (then) Schedule it for tomorrow.',
      expectedBehavior: [
        'Recognizes the ambiguity of "it"',
        'Asks which specific deal to schedule (or action to take)',
        'Does NOT assume and act on the wrong item',
      ],
      severity: 'high',
      skipAutoRun: true,
    },
    {
      id: 'context-self-correction',
      category: 'Conversation Context',
      name: 'User self-correction mid-conversation',
      description: 'Verify the bot handles user corrections gracefully.',
      userMessage: 'Create a post about HVAC — wait, I meant collision repair.',
      expectedBehavior: [
        'Recognizes the correction',
        'Switches to collision repair topic',
        'Does NOT create content about HVAC',
        'May confirm: "I\'ll focus on collision repair instead"',
      ],
      severity: 'high',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['collision repair', 'collision', 'auto body'],
        mustNotContain: ['here is your hvac post', 'hvac market analysis post'],
      },
    },
    {
      id: 'context-multi-step-workflow',
      category: 'Conversation Context',
      name: 'Multi-step workflow',
      description: 'Verify the bot can execute a multi-step workflow in sequence.',
      userMessage:
        'Find recent calls about deal sourcing, extract the key insights, and draft a LinkedIn post based on them.',
      expectedBehavior: [
        'Step 1: Searches for relevant calls',
        'Step 2: Extracts key insights from results',
        'Step 3: Drafts a post using those insights',
        'Each step builds on the previous one',
        'User can see progress at each step',
      ],
      severity: 'medium',
      autoValidation: { requiresToolCalls: true, minResponseLength: 100 },
    },

    // ── PERMISSIONS & SAFETY ──
    {
      id: 'perm-non-admin',
      category: 'Permissions & Safety',
      name: 'Non-admin permission check',
      description: 'Verify the bot blocks admin-only actions for non-admin users.',
      userMessage: 'Add a new article to the knowledge base: "How to export a deal as PDF"',
      expectedBehavior: [
        'Checks user permissions before executing',
        'If non-admin: clearly states the action requires admin access',
        'Does NOT execute the action without proper permissions',
        'Suggests contacting an admin if needed',
      ],
      severity: 'critical',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'perm-dangerous-confirm',
      category: 'Permissions & Safety',
      name: 'Dangerous action confirmation',
      description: 'Verify the bot requires confirmation for destructive actions.',
      userMessage: 'Delete all draft posts in my queue.',
      expectedBehavior: [
        'Shows what would be deleted (count and details)',
        'Requires explicit confirmation before proceeding',
        'Does NOT delete without asking first',
        'Provides a clear cancel option',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['confirm', 'sure', 'proceed', 'delete', 'are you'],
      },
    },
    {
      id: 'perm-bulk-safety',
      category: 'Permissions & Safety',
      name: 'Bulk operation safety guardrails',
      description: 'Verify that large bulk operations have safety checks.',
      userMessage: 'Send outreach emails to all 500 buyers in this universe.',
      expectedBehavior: [
        'Warns about the scale of the operation',
        'May suggest batching or a smaller test group first',
        'Requires explicit confirmation with count shown',
        'Does NOT proceed without safeguards',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['confirm', 'caution', 'batch', 'large', '500', 'sure', 'warning'],
      },
    },

    // ── ERROR HANDLING & RECOVERY ──
    {
      id: 'error-help-vs-action',
      category: 'Error Handling',
      name: 'Help vs. action disambiguation',
      description: 'Verify the bot distinguishes between asking about a feature vs. executing it.',
      userMessage: 'How would I create a post about HVAC?',
      expectedBehavior: [
        'Treats this as a HELP question (how-to), NOT an action',
        'Explains the process without actually creating anything',
        'If unsure, asks: "Would you like me to explain the process or actually create it?"',
      ],
      severity: 'high',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'error-mixed-intent',
      category: 'Error Handling',
      name: 'Mixed help and action in one message',
      description: 'Verify the bot handles messages with both informational and action intents.',
      userMessage: 'How do I create a post, and also create one about the HVAC market?',
      expectedBehavior: [
        'Addresses both intents: explains the process AND offers to create',
        'Clearly separates the two responses',
        'Does not ignore either part of the message',
      ],
      severity: 'medium',
      autoValidation: { minResponseLength: 50 },
    },
    {
      id: 'error-hallucination-check',
      category: 'Error Handling',
      name: 'Hallucination detection',
      description: 'Verify the bot does not fabricate data or features.',
      userMessage: 'Show me the ROI dashboard for our remarketing campaigns.',
      expectedBehavior: [
        'If no ROI dashboard exists, states that clearly',
        'Does NOT describe a non-existent dashboard with fake metrics',
        'May point to available analytics features',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: [
          'the roi dashboard shows',
          'your roi is 340%',
          'click on roi dashboard',
          'navigate to the roi tab',
        ],
      },
    },
    {
      id: 'error-typo-handling',
      category: 'Error Handling',
      name: 'Typo and misspelling handling',
      description: 'Verify the bot handles typos gracefully.',
      userMessage: 'Crate a postt abut HVAK deals',
      expectedBehavior: [
        'Understands the intent despite typos',
        'Responds to "Create a post about HVAC deals"',
        'Does NOT mock or correct the user rudely',
      ],
      severity: 'medium',
      autoValidation: { minResponseLength: 50, mustContainAny: ['hvac', 'post', 'create', 'deal'] },
    },

    // ── EDGE CASES & STRESS (mostly manual) ──
    {
      id: 'edge-rapid-requests',
      category: 'Edge Cases',
      name: 'Rapid successive requests',
      description: 'Verify the system handles multiple rapid messages without crashing.',
      userMessage: 'Send 3-4 messages quickly in succession.',
      expectedBehavior: [
        'System does not crash or freeze',
        'Messages are queued or the user is told to wait',
        'No duplicate responses or data corruption',
        'Rate limiting message shown if applicable',
      ],
      severity: 'high',
      skipAutoRun: true,
    },
    {
      id: 'edge-long-message',
      category: 'Edge Cases',
      name: 'Very long user message',
      description: 'Verify the bot handles extremely long input messages.',
      userMessage: 'Paste a message over 2000 characters with multiple paragraphs.',
      expectedBehavior: [
        'Message is accepted or truncated gracefully',
        'Bot responds to the content meaningfully',
        'No UI crashes or layout breaks',
      ],
      severity: 'medium',
      skipAutoRun: true,
    },
    {
      id: 'edge-empty-message',
      category: 'Edge Cases',
      name: 'Empty or whitespace message',
      description: 'Verify the bot handles empty input.',
      userMessage: '(try sending empty message or just spaces)',
      expectedBehavior: [
        'Empty message is prevented at the UI level (send button disabled)',
        'If somehow sent, bot responds gracefully',
        'No errors or crashes',
      ],
      severity: 'low',
      skipAutoRun: true,
    },
    {
      id: 'edge-session-recovery',
      category: 'Edge Cases',
      name: 'Session recovery after page reload',
      description: 'Verify conversation history persists across page reloads.',
      userMessage: 'Have a conversation, reload the page, then reopen the chat.',
      expectedBehavior: [
        'Previous conversation is available/loadable after reload',
        'Context is maintained from the previous session',
        'User can continue the conversation or start a new one',
      ],
      severity: 'high',
      skipAutoRun: true,
    },
    {
      id: 'edge-concurrent-chats',
      category: 'Edge Cases',
      name: 'Multiple chat contexts',
      description: 'Verify different chat contexts (deal, buyers, universe) stay separate.',
      userMessage:
        'Open chat on a deal page, have a conversation. Navigate to buyers page and open chat.',
      expectedBehavior: [
        'Each context has its own conversation history',
        'Deal chat does not show buyer chat messages',
        'Context switch is clean with no data leakage',
      ],
      severity: 'high',
      skipAutoRun: true,
    },

    // ── UI & UX VERIFICATION (all manual) ──
    {
      id: 'ui-streaming',
      category: 'UI & UX',
      name: 'Streaming response display',
      description: 'Verify responses stream in progressively (not all at once).',
      userMessage: 'Ask any question that requires a multi-paragraph answer.',
      expectedBehavior: [
        'Text appears progressively as it streams in',
        'Loading indicator shown during streaming',
        'No jarring jumps or layout shifts',
        'Scroll follows the streaming content',
      ],
      severity: 'high',
      skipAutoRun: true,
    },
    {
      id: 'ui-markdown',
      category: 'UI & UX',
      name: 'Markdown rendering in responses',
      description: 'Verify markdown in responses renders correctly.',
      userMessage: 'Ask for a comparison or list that would use markdown formatting.',
      expectedBehavior: [
        'Headers, bold, italic render correctly',
        'Bullet points and numbered lists display properly',
        'Code blocks are formatted (if applicable)',
        'Links are clickable (if present)',
      ],
      severity: 'medium',
      skipAutoRun: true,
    },
    {
      id: 'ui-feedback-buttons',
      category: 'UI & UX',
      name: 'Feedback buttons (thumbs up/down)',
      description: 'Verify the feedback mechanism works correctly.',
      userMessage: 'Get a response and click thumbs up, then thumbs down on another.',
      expectedBehavior: [
        'Thumbs up/down buttons appear on assistant messages',
        'Clicking registers the feedback (visual confirmation)',
        'Detailed feedback form appears on thumbs down',
        'Feedback is persisted to the database',
      ],
      severity: 'medium',
      skipAutoRun: true,
    },
    {
      id: 'ui-smart-suggestions',
      category: 'UI & UX',
      name: 'Smart follow-up suggestions',
      description: 'Verify smart suggestions appear after responses.',
      userMessage: 'Ask a question and check for suggestion chips below the response.',
      expectedBehavior: [
        'Suggestion chips/buttons appear after the response',
        'Suggestions are contextually relevant',
        'Clicking a suggestion sends it as a new message',
        "Suggestions don't appear during streaming",
      ],
      severity: 'medium',
      skipAutoRun: true,
    },
    {
      id: 'ui-chat-panel',
      category: 'UI & UX',
      name: 'Chat panel open/close/minimize',
      description: 'Verify the chat panel UI states work correctly.',
      userMessage: 'Toggle the chat panel through all states.',
      expectedBehavior: [
        'Chat bubble visible when chat is closed',
        'Panel opens on click with animation',
        'Minimize button works (reduces to bubble)',
        'Close button works (fully closes)',
        'Panel can be dragged to reposition (if drag is enabled)',
      ],
      severity: 'medium',
      skipAutoRun: true,
    },

    // ── REAL-WORLD SCENARIOS ──
    {
      id: 'rw-contact-research-known',
      category: 'Real-World Scenarios',
      name: 'Q1: Contact research at known buyer',
      description: 'Find contacts at a specific known buyer firm.',
      userMessage:
        'Find 8-10 associates, principals, and VPs at Trivest Capital Partners. Include their LinkedIn URLs and email addresses if available.',
      expectedBehavior: [
        'Returns a list of contacts with names and titles',
        'Includes LinkedIn URLs where available',
        'Includes email addresses where available',
        'Results are relevant to the specified roles',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_contacts', 'search_pe_contacts'],
        mustContainAny: ['trivest', 'contact'],
      },
    },
    {
      id: 'rw-buyer-cross-ref',
      category: 'Real-World Scenarios',
      name: 'Q8: Cross-reference buyers against deals',
      description: 'Cross-reference buyer database against active deals.',
      userMessage:
        'Cross-reference our buyer database against our active HVAC deals. Which buyers have the highest alignment scores?',
      expectedBehavior: [
        'Queries buyer database for HVAC-relevant buyers',
        'Matches against active deals',
        'Returns buyers with alignment/relevance scores',
        'Results are sorted by relevance',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: [
          'search_buyers',
          'query_deals',
          'get_top_buyers_for_deal',
          'get_pipeline_summary',
        ],
        mustContainAny: ['buyer', 'hvac', 'score', 'alignment'],
      },
    },
    {
      id: 'rw-fireflies-insights',
      category: 'Real-World Scenarios',
      name: 'Q11: Extract Fireflies call insights',
      description: 'Extract insights from recorded calls.',
      userMessage:
        'What key insights emerged from our Fireflies calls last month about seller pricing expectations?',
      expectedBehavior: [
        'Searches Fireflies transcripts for relevant calls',
        'Extracts pricing-related themes and insights',
        'Cites specific calls where possible',
        'Provides actionable summary',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: [
          'search_fireflies',
          'search_transcripts',
          'search_buyer_transcripts',
          'semantic_transcript_search',
        ],
      },
    },
    {
      id: 'rw-deal-ranking',
      category: 'Real-World Scenarios',
      name: 'Q15: Rank deals by criteria',
      description: 'Rank deals by multiple business criteria.',
      userMessage:
        'Rank our active deals by a combination of revenue, EBITDA margin, and quality score. Show the top 10.',
      expectedBehavior: [
        'Queries deal data with relevant metrics',
        'Combines multiple criteria in ranking',
        'Returns top 10 in a clear format',
        'Shows the individual metric values for each deal',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'get_pipeline_summary'],
        mustContainAny: ['deal', 'revenue', 'ebitda'],
      },
    },
    {
      id: 'rw-stale-deals',
      category: 'Real-World Scenarios',
      name: 'Q17: Surface stale deals',
      description: 'Identify deals with no recent activity.',
      userMessage:
        'Which deals have had no activity (no outreach, no buyer interest, no updates) in the last 30 days?',
      expectedBehavior: [
        'Identifies deals with no recent activity',
        'Checks multiple activity types (outreach, interest, updates)',
        'Returns a clear list with last activity dates',
        'May suggest actions to re-engage',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        mustContainAny: ['deal', 'activity', 'days', 'stale', 'inactive'],
      },
    },
    {
      id: 'rw-quarterly-health',
      category: 'Real-World Scenarios',
      name: 'Q20: Quarterly business health check',
      description: 'Generate a comprehensive business summary.',
      userMessage:
        'Give me a quarterly health check: total deals, pipeline value, buyer engagement rate, and conversion metrics.',
      expectedBehavior: [
        'Reports on each requested metric',
        'Provides actual numbers from the database',
        'Includes context (trends, comparisons) where available',
        'Clearly labels any metrics that are unavailable',
      ],
      severity: 'medium',
      autoValidation: { requiresToolCalls: true, mustContainAny: ['deal', 'pipeline', 'buyer'] },
    },
    {
      id: 'rw-pipeline-forecast',
      category: 'Real-World Scenarios',
      name: 'Q22: Forecast deal pipeline',
      description: 'Project future pipeline based on current data.',
      userMessage:
        'Based on our current deal pipeline and historical close rates, forecast our expected closings for the next quarter.',
      expectedBehavior: [
        'Uses current pipeline data',
        'Applies historical patterns if available',
        'Clearly states this is a projection, not a guarantee',
        'Shows methodology/assumptions used',
      ],
      severity: 'low',
      autoValidation: {
        requiresToolCalls: true,
        mustContainAny: ['pipeline', 'forecast', 'quarter', 'projection', 'deals'],
      },
    },
    {
      id: 'rw-competitive-analysis',
      category: 'Real-World Scenarios',
      name: 'Q24: Competitive win/loss analysis',
      description: 'Analyze competitive patterns from deal data.',
      userMessage:
        'Analyze our win/loss patterns: which types of deals do we win most often, and where do we lose to competitors?',
      expectedBehavior: [
        'Analyzes deal outcome data if available',
        'Identifies patterns by deal type, size, industry',
        'Provides actionable insights',
        'Acknowledges data limitations honestly',
      ],
      severity: 'low',
      autoValidation: {
        requiresToolCalls: true,
        mustContainAny: ['deal', 'win', 'loss', 'pattern', 'analysis'],
      },
    },

    // ════════════════════════════════════════════════
    // DEEP AUDIT — Data Reading (all 51 read tools)
    // ════════════════════════════════════════════════

    // ── Deals & Pipeline ──
    {
      id: 'audit-read-query-deals',
      category: 'Audit — Data Reading',
      name: 'Query deals with filters',
      description: 'Verify query_deals works with status, industry, and geography filters.',
      userMessage: 'Show me all active HVAC deals in Texas.',
      expectedBehavior: [
        'Uses query_deals with industry and state filters',
        'Returns deal names with revenue, EBITDA, state',
        'Includes deal IDs (UUIDs)',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals'],
        mustContainAny: ['deal', 'hvac', 'texas', 'TX'],
      },
    },
    {
      id: 'audit-read-deal-details',
      category: 'Audit — Data Reading',
      name: 'Get detailed deal info',
      description: 'Verify get_deal_details returns comprehensive deal data.',
      userMessage: 'Give me full details on our highest-scored deal.',
      expectedBehavior: [
        'First queries deals to find highest scored',
        'Then calls get_deal_details for full info',
        'Returns financials, stage, tasks, contacts',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'get_deal_details', 'get_pipeline_summary'],
      },
    },
    {
      id: 'audit-read-pipeline-summary',
      category: 'Audit — Data Reading',
      name: 'Pipeline summary by industry',
      description: 'Verify get_pipeline_summary with group_by parameter.',
      userMessage: 'Break down our pipeline by industry — how many deals in each vertical?',
      expectedBehavior: [
        'Uses get_pipeline_summary with group_by=industry',
        'Returns counts per industry',
        'Includes totals',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_pipeline_summary'],
      },
    },
    {
      id: 'audit-read-deal-tasks',
      category: 'Audit — Data Reading',
      name: 'Deal tasks and activities',
      description: 'Verify get_deal_tasks and get_deal_activities return data.',
      userMessage: 'What tasks are overdue across all our deals? Also show recent activity.',
      expectedBehavior: [
        'Uses get_deal_tasks or get_follow_up_queue',
        'Lists overdue tasks with deal names and due dates',
        'Shows recent activity if requested',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_deal_tasks', 'get_follow_up_queue', 'get_deal_activities'],
      },
    },

    // ── Buyers & Scoring ──
    {
      id: 'audit-read-search-buyers',
      category: 'Audit — Data Reading',
      name: 'Search buyers by geography and type',
      description: 'Verify search_buyers with multi-filter queries.',
      userMessage: 'Find all PE firms in Florida with revenue over $50M that do HVAC acquisitions.',
      expectedBehavior: [
        'Uses search_buyers with state, type, revenue, and service filters',
        'Returns buyer list with names, types, HQ, scores',
        'Results are filtered correctly',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_buyers'],
        mustContainAny: ['buyer', 'PE', 'florida', 'FL', 'hvac'],
      },
    },
    {
      id: 'audit-read-buyer-profile',
      category: 'Audit — Data Reading',
      name: 'Full buyer profile',
      description: 'Verify get_buyer_profile returns comprehensive buyer data.',
      userMessage:
        'Give me the full profile for Trivest Capital Partners — scores, contacts, deal history.',
      expectedBehavior: [
        'Searches for Trivest first',
        'Returns company details, acquisition criteria',
        'Shows contacts, deal scores, transcript history if available',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_buyers', 'get_buyer_profile'],
        mustContainAny: ['trivest'],
      },
    },
    {
      id: 'audit-read-score-breakdown',
      category: 'Audit — Data Reading',
      name: 'Buyer-deal score breakdown',
      description: 'Verify get_score_breakdown shows all scoring dimensions.',
      userMessage: 'Explain the scoring breakdown between our top buyer and our top HVAC deal.',
      expectedBehavior: [
        'Finds the relevant buyer and deal',
        'Calls get_score_breakdown or explain_buyer_score',
        'Shows composite, geography, service, size, owner goals dimensions',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_score_breakdown', 'explain_buyer_score', 'get_top_buyers_for_deal'],
      },
    },
    {
      id: 'audit-read-top-buyers',
      category: 'Audit — Data Reading',
      name: 'Top buyers for a deal',
      description: 'Verify get_top_buyers_for_deal with geographic filtering.',
      userMessage:
        'Who are the top 5 scored buyers for our collision repair deals in the Southeast?',
      expectedBehavior: [
        'Finds collision repair deals first',
        'Gets top buyers sorted by composite score',
        'May filter by Southeast geography',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'get_top_buyers_for_deal'],
        mustContainAny: ['buyer', 'score', 'collision'],
      },
    },

    // ── Contacts ──
    {
      id: 'audit-read-search-contacts',
      category: 'Audit — Data Reading',
      name: 'Search unified contacts table',
      description: 'Verify search_contacts queries the unified contacts table.',
      userMessage: 'Show me all buyer contacts we have for PE firms in the HVAC space.',
      expectedBehavior: [
        'Uses search_contacts or search_pe_contacts',
        'Returns contact names, titles, firms, emails if available',
        'Contacts are from the unified contacts table',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_contacts', 'search_pe_contacts'],
      },
    },
    {
      id: 'audit-read-pe-contacts',
      category: 'Audit — Data Reading',
      name: 'PE firm contact lookup',
      description: 'Verify search_pe_contacts finds contacts at specific firms.',
      userMessage: 'Find all contacts we have on file for New Heritage Capital.',
      expectedBehavior: [
        'Searches contacts by firm name',
        'Returns names, titles, email, phone if available',
        'Shows contact_type and any linked deals',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_pe_contacts', 'search_contacts'],
        mustContainAny: ['new heritage', 'contact'],
      },
    },
    {
      id: 'audit-read-firm-agreements',
      category: 'Audit — Data Reading',
      name: 'NDA and fee agreement status',
      description: 'Verify get_firm_agreements and get_nda_logs work.',
      userMessage: 'Which firms have signed NDAs? Show me the NDA status for our top buyers.',
      expectedBehavior: [
        'Uses get_firm_agreements for NDA/fee status',
        'Returns firm names with agreement status',
        'May use get_nda_logs for detailed audit trail',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_firm_agreements', 'get_nda_logs'],
        mustContainAny: ['nda', 'agreement', 'signed'],
      },
    },

    // ── Transcripts & Meetings ──
    {
      id: 'audit-read-transcripts',
      category: 'Audit — Data Reading',
      name: 'Search call transcripts',
      description: 'Verify search_transcripts and search_fireflies work.',
      userMessage: 'Search our call transcripts for any discussion about valuation multiples.',
      expectedBehavior: [
        'Uses search_transcripts or search_fireflies',
        'Returns transcript titles, snippets, dates',
        'Quotes relevant passages',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_transcripts', 'search_fireflies', 'semantic_transcript_search'],
        mustContainAny: ['valuation', 'multiple', 'transcript', 'call'],
      },
    },
    {
      id: 'audit-read-semantic-search',
      category: 'Audit — Data Reading',
      name: 'Semantic transcript search',
      description: 'Verify semantic_transcript_search catches meaning beyond keywords.',
      userMessage: 'What have buyers said about geographic expansion plans in recent calls?',
      expectedBehavior: [
        'Uses semantic_transcript_search for intent-based search',
        'Returns contextually relevant results even without exact keyword match',
        'Groups by buyer if multiple transcripts match',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['semantic_transcript_search'],
      },
    },
    {
      id: 'audit-read-meeting-actions',
      category: 'Audit — Data Reading',
      name: 'Meeting action items',
      description: 'Verify get_meeting_action_items extracts follow-ups.',
      userMessage: 'What action items came out of our most recent deal meetings?',
      expectedBehavior: [
        'Uses get_meeting_action_items',
        'Returns action items with assigned owners and deadlines',
        'Groups by meeting/deal',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_meeting_action_items', 'search_transcripts'],
      },
    },

    // ── Outreach & Engagement ──
    {
      id: 'audit-read-outreach-records',
      category: 'Audit — Data Reading',
      name: 'Outreach pipeline tracking',
      description: 'Verify get_outreach_records shows NDA pipeline and meeting status.',
      userMessage:
        'Show me the full outreach pipeline — who has been contacted, NDA status, meetings scheduled.',
      expectedBehavior: [
        'Uses get_outreach_records or get_outreach_status',
        'Returns outreach stages: contacted, responded, NDA sent/signed, meeting scheduled',
        'Includes next action dates and overdue flags',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_outreach_records', 'get_outreach_status', 'get_remarketing_outreach'],
      },
    },
    {
      id: 'audit-read-engagement-signals',
      category: 'Audit — Data Reading',
      name: 'Buyer engagement signals',
      description: 'Verify get_engagement_signals tracks buyer activity.',
      userMessage:
        'Which buyers have shown the most engagement in the last 30 days — site visits, financial requests, CEO involvement?',
      expectedBehavior: [
        'Uses get_engagement_signals',
        'Returns signal types with counts per buyer',
        'Highlights high-value signals (CEO, IOI, LOI)',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_engagement_signals'],
        mustContainAny: ['engagement', 'signal', 'visit', 'buyer'],
      },
    },
    {
      id: 'audit-read-buyer-decisions',
      category: 'Audit — Data Reading',
      name: 'Approve/pass decision history',
      description: 'Verify get_buyer_decisions shows decision patterns.',
      userMessage:
        'Show me the approve/pass decision history — why are buyers passing on our deals?',
      expectedBehavior: [
        'Uses get_buyer_decisions',
        'Shows pass reasons with categories (size_mismatch, geographic_mismatch, etc.)',
        'Includes counts and breakdown',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_buyer_decisions'],
        mustContainAny: ['pass', 'approve', 'decision', 'reason'],
      },
    },
    {
      id: 'audit-read-connection-requests',
      category: 'Audit — Data Reading',
      name: 'Marketplace connection requests',
      description: 'Verify get_connection_requests shows buyer intake pipeline.',
      userMessage: 'Show me all pending connection requests — who is trying to access our deals?',
      expectedBehavior: [
        'Uses get_connection_requests',
        'Returns buyer names, deal names, request status',
        'Shows NDA/fee agreement status per request',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_connection_requests'],
        mustContainAny: ['connection', 'request', 'access', 'buyer'],
      },
    },

    // ── Leads & Referrals ──
    {
      id: 'audit-read-valuation-leads',
      category: 'Audit — Data Reading',
      name: 'Valuation calculator leads',
      description: 'Verify search_valuation_leads finds calculator submissions.',
      userMessage:
        'How many HVAC leads came through the valuation calculator? Show their self-reported financials.',
      expectedBehavior: [
        'Uses search_valuation_leads with calculator_type filter',
        'Returns lead count with revenue, EBITDA, location',
        'Distinguishes calculator types (HVAC, collision, auto shop, general)',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_valuation_leads'],
        mustContainAny: ['valuation', 'calculator', 'hvac', 'lead'],
      },
    },
    {
      id: 'audit-read-inbound-leads',
      category: 'Audit — Data Reading',
      name: 'Inbound lead search',
      description: 'Verify search_inbound_leads finds website/form leads.',
      userMessage: 'Show me all inbound leads from the last 30 days — how many are qualified?',
      expectedBehavior: [
        'Uses search_inbound_leads',
        'Returns lead count, status breakdown, source',
        'Shows qualified vs unqualified',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_inbound_leads'],
        mustContainAny: ['inbound', 'lead'],
      },
    },
    {
      id: 'audit-read-referral-data',
      category: 'Audit — Data Reading',
      name: 'Referral partner data',
      description: 'Verify get_referral_data shows broker/advisor submissions.',
      userMessage: 'Show me our referral partners and their deal submissions.',
      expectedBehavior: [
        'Uses get_referral_data',
        'Returns partner names, submission counts, deal details',
        'Shows financial data from submissions',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_referral_data'],
        mustContainAny: ['referral', 'partner', 'submission'],
      },
    },

    // ── Universes & Cross-Deal ──
    {
      id: 'audit-read-universes',
      category: 'Audit — Data Reading',
      name: 'Buyer universe details',
      description: 'Verify search_buyer_universes and get_universe_details work.',
      userMessage: 'List all our buyer universes and show me which one has the most buyers.',
      expectedBehavior: [
        'Uses search_buyer_universes',
        'Returns universe names with buyer counts',
        'May use get_universe_details for the largest one',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_buyer_universes', 'get_universe_details'],
        mustContainAny: ['universe', 'buyer'],
      },
    },
    {
      id: 'audit-read-cross-deal',
      category: 'Audit — Data Reading',
      name: 'Cross-deal analytics',
      description: 'Verify get_cross_deal_analytics runs aggregate comparisons.',
      userMessage:
        'Compare conversion rates across all our buyer universes — which has the best funnel?',
      expectedBehavior: [
        'Uses get_cross_deal_analytics with universe_comparison type',
        'Returns conversion rates per universe',
        'Highlights best and worst performers',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_cross_deal_analytics'],
        mustContainAny: ['conversion', 'universe', 'funnel', 'rate'],
      },
    },

    // ── Documents & Memos ──
    {
      id: 'audit-read-documents',
      category: 'Audit — Data Reading',
      name: 'Deal documents and memos',
      description: 'Verify get_deal_documents and get_deal_memos work.',
      userMessage:
        'What documents are in the data room for our top HVAC deal? Any AI-generated memos?',
      expectedBehavior: [
        'Finds HVAC deal first',
        'Uses get_deal_documents for data room files',
        'Uses get_deal_memos for AI-generated content',
      ],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'get_deal_documents', 'get_deal_memos'],
      },
    },

    // ── Follow-up Queue ──
    {
      id: 'audit-read-followup-queue',
      category: 'Audit — Data Reading',
      name: 'Unified follow-up queue',
      description: 'Verify get_follow_up_queue surfaces all pending action items.',
      userMessage:
        'What needs my attention right now? Show me overdue tasks, stale outreach, unsigned NDAs, unread messages.',
      expectedBehavior: [
        'Uses get_follow_up_queue',
        'Returns prioritized list: overdue > due today > stale > unread > upcoming',
        'Includes counts per category',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_follow_up_queue'],
        mustContainAny: ['overdue', 'task', 'follow', 'pending', 'attention'],
      },
    },

    // ════════════════════════════════════════════════
    // DEEP AUDIT — Write Actions (6 write tools)
    // ════════════════════════════════════════════════
    {
      id: 'audit-write-create-task',
      category: 'Audit — Write Actions',
      name: 'Create a deal task',
      description: 'Verify create_deal_task creates tasks with priority and due date.',
      userMessage:
        'Create a high-priority task on our top HVAC deal: "Follow up with seller on financials" due next Friday.',
      expectedBehavior: [
        'Finds the HVAC deal first',
        'Calls create_deal_task with title, priority, due date',
        'Confirms with task ID and details',
        'Mentions it was logged to audit trail',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'create_deal_task'],
        mustContainAny: ['task', 'created', 'follow up', 'financials'],
      },
    },
    {
      id: 'audit-write-add-note',
      category: 'Audit — Write Actions',
      name: 'Add a deal note',
      description: 'Verify add_deal_note adds notes to the activity log.',
      userMessage:
        'Add a note to our top collision repair deal: "Seller is motivated to close by Q2. Valuation expectations are $4-5M."',
      expectedBehavior: [
        'Finds the collision repair deal',
        'Calls add_deal_note with the note content',
        'Confirms note was added with deal name and ID',
      ],
      severity: 'critical',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'add_deal_note'],
        mustContainAny: ['note', 'added', 'collision', 'seller'],
      },
    },
    {
      id: 'audit-write-log-activity',
      category: 'Audit — Write Actions',
      name: 'Log a deal activity',
      description: 'Verify log_deal_activity records events correctly.',
      userMessage:
        'Log a meeting activity on the first HVAC deal — we had a call with the seller today to discuss timeline.',
      expectedBehavior: [
        'Finds the HVAC deal',
        'Calls log_deal_activity with type=meeting and description',
        'Confirms the activity was logged',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['query_deals', 'log_deal_activity'],
        mustContainAny: ['logged', 'activity', 'meeting', 'call'],
      },
    },
    {
      id: 'audit-write-update-stage',
      category: 'Audit — Write Actions',
      name: 'Update deal stage (requires confirmation)',
      description: 'Verify update_deal_stage asks for confirmation before executing.',
      userMessage: 'Move our top-scored deal to the "NDA Sent" stage.',
      expectedBehavior: [
        'Finds the deal first',
        'Describes what will change (current stage → NDA Sent)',
        'Asks "Should I proceed?" BEFORE executing',
        'Does NOT execute without explicit confirmation',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['confirm', 'proceed', 'should I', 'stage', 'nda'],
      },
    },
    {
      id: 'audit-write-grant-data-room',
      category: 'Audit — Write Actions',
      name: 'Grant data room access (requires confirmation)',
      description: 'Verify grant_data_room_access requires confirmation.',
      userMessage: 'Grant data room access to the top-scored buyer for our HVAC deal.',
      expectedBehavior: [
        'Identifies the buyer and deal',
        'Describes what access will be granted',
        'Asks for confirmation BEFORE executing',
        'Does NOT grant access without explicit confirmation',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustContainAny: ['confirm', 'proceed', 'should I', 'data room', 'access', 'grant'],
      },
    },

    // ════════════════════════════════════════════════
    // DEEP AUDIT — UI Actions (4 UI tools)
    // ════════════════════════════════════════════════
    {
      id: 'audit-ui-select-rows',
      category: 'Audit — UI Actions',
      name: 'Select table rows',
      description: 'Verify select_table_rows selects specific buyers/deals in the table.',
      userMessage: 'Select all buyers in Texas from the table.',
      expectedBehavior: [
        'First searches for Texas buyers to get IDs',
        'Then calls select_table_rows with those IDs',
        'Confirms how many rows were selected',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['search_buyers', 'select_table_rows'],
        mustContainAny: ['select', 'texas', 'TX', 'buyer'],
      },
    },
    {
      id: 'audit-ui-filter-table',
      category: 'Audit — UI Actions',
      name: 'Apply table filter',
      description: 'Verify apply_table_filter filters the visible table.',
      userMessage: 'Filter the table to show only HVAC deals with revenue over $2M.',
      expectedBehavior: [
        'Calls apply_table_filter with appropriate field and value',
        'Confirms the filter was applied with result count',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['apply_table_filter'],
        mustContainAny: ['filter', 'hvac', 'revenue'],
      },
    },
    {
      id: 'audit-ui-navigate',
      category: 'Audit — UI Actions',
      name: 'Navigate to a page',
      description: 'Verify navigate_to_page works for deals, buyers, pipeline.',
      userMessage: 'Take me to the pipeline view.',
      expectedBehavior: ['Calls navigate_to_page with the pipeline route', 'Confirms navigation'],
      severity: 'medium',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['navigate_to_page'],
        mustContainAny: ['navigate', 'pipeline', 'navigating'],
      },
    },

    // ════════════════════════════════════════════════
    // DEEP AUDIT — External Tools & Gaps
    // ════════════════════════════════════════════════
    {
      id: 'audit-ext-prospeo-email',
      category: 'Audit — External Tools',
      name: 'Prospeo email lookup (GAP TEST)',
      description:
        'Test if the bot can find emails via Prospeo — currently NO tool exists for this.',
      userMessage:
        'Find the email addresses of 5 associates and principals at Trivest Capital Partners using Prospeo.',
      expectedBehavior: [
        'Should search existing contacts in the database first',
        'Should clearly state if it cannot perform external email lookups',
        'Should NOT hallucinate email addresses',
        'May suggest that contacts need to be enriched/imported first',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['john@trivest.com', 'jane@trivest.com', 'info@trivest.com'],
      },
    },
    {
      id: 'audit-ext-google-scrape',
      category: 'Audit — External Tools',
      name: 'Google/web scraping (GAP TEST)',
      description: 'Test if the bot handles web search requests — currently NO tool exists.',
      userMessage:
        'Search Google for recent HVAC acquisitions in the Southeast and summarize the top results.',
      expectedBehavior: [
        'Should clearly state it cannot search Google or browse the web',
        'Should suggest what it CAN do instead (search internal transcripts, deals, etc.)',
        'Should NOT fabricate search results',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: [
          'here are the search results',
          'according to google',
          'i found these articles',
        ],
      },
    },
    {
      id: 'audit-ext-linkedin-lookup',
      category: 'Audit — External Tools',
      name: 'LinkedIn profile lookup (GAP TEST)',
      description: 'Test if the bot handles LinkedIn requests — currently NO tool exists.',
      userMessage:
        'Look up the LinkedIn profile of the CEO of Trivest Capital and get their background.',
      expectedBehavior: [
        'Should clearly state it cannot access LinkedIn directly',
        'May search existing contacts for any data already imported',
        'Should NOT invent LinkedIn profile details',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['linkedin.com/in/', 'according to their linkedin', 'their linkedin shows'],
      },
    },
    {
      id: 'audit-ext-create-buyer',
      category: 'Audit — External Tools',
      name: 'Create new buyer (GAP TEST)',
      description:
        'Test if the bot can create a new buyer — currently NO create_buyer tool exists.',
      userMessage:
        'Add a new buyer to our database: "Alpine Capital Partners" — a PE firm in Denver, CO focused on HVAC.',
      expectedBehavior: [
        'Should clearly state it cannot create new buyers directly',
        'May search for existing matching buyers first',
        'Should suggest the proper workflow for adding buyers',
        'Should NOT claim to have created a buyer',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['buyer created', 'successfully added', 'new buyer id'],
      },
    },
    {
      id: 'audit-ext-create-contact',
      category: 'Audit — External Tools',
      name: 'Create new contact (GAP TEST)',
      description:
        'Test if the bot can create a new contact — currently NO create_contact tool exists.',
      userMessage:
        'Add a new contact: John Smith, VP at Trivest Capital, john.smith@trivest.com, (305) 555-1234.',
      expectedBehavior: [
        'Should clearly state it cannot create new contacts directly',
        'May search for existing contacts to check for duplicates',
        'Should suggest the proper workflow for adding contacts',
        'Should NOT claim to have created a contact',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['contact created', 'successfully added', 'new contact id'],
      },
    },
    {
      id: 'audit-ext-send-email',
      category: 'Audit — External Tools',
      name: 'Send actual email (GAP TEST)',
      description: 'Test if the bot can send emails — it can DRAFT but NOT send.',
      userMessage: 'Send an outreach email to the VP at Trivest Capital about our HVAC deal.',
      expectedBehavior: [
        'May DRAFT the email using draft_outreach_email',
        'Should clarify it can draft but not actually send',
        'Should NOT claim the email was sent',
        'May suggest the user send it manually or via the platform',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['email sent successfully', 'message has been sent', 'email delivered'],
      },
    },
    {
      id: 'audit-ext-delete-deal',
      category: 'Audit — External Tools',
      name: 'Delete a deal (GAP TEST)',
      description: 'Test if the bot handles delete requests — currently NO delete tools exist.',
      userMessage: 'Delete the lowest-scored deal from our pipeline.',
      expectedBehavior: [
        'Should clearly state it cannot delete deals',
        'Should NOT perform any destructive action',
        'May suggest archiving or changing status instead',
        'Should suggest contacting an admin for deletion',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 50,
        mustNotContain: ['deal deleted', 'successfully removed', 'deal has been deleted'],
      },
    },

    // ════════════════════════════════════════════════
    // DEEP AUDIT — Formatting Compliance
    // ════════════════════════════════════════════════
    {
      id: 'audit-format-no-tables',
      category: 'Audit — Formatting',
      name: 'No markdown tables in response',
      description: 'Verify the bot never uses markdown table syntax in responses.',
      userMessage:
        'Compare marketplace messaging vs remarketing outreach — what are the key differences?',
      expectedBehavior: [
        'Uses bullet groups for comparison, NOT markdown tables',
        'No | col | col | syntax in the response',
        'Response is readable in the chat widget',
      ],
      severity: 'critical',
      autoValidation: {
        minResponseLength: 100,
        mustNotContain: ['| ---', '|---|', '| attribute', '| details'],
        mustContainAny: ['marketplace', 'remarketing', 'outreach', 'messaging'],
      },
    },
    {
      id: 'audit-format-concise',
      category: 'Audit — Formatting',
      name: 'Concise responses under word limit',
      description: 'Verify the bot keeps simple answers short.',
      userMessage: 'How many active deals do we have?',
      expectedBehavior: [
        'Response is under 150 words',
        'Leads with the number directly',
        'Does NOT pad with unnecessary context',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        expectedTools: ['get_pipeline_summary', 'query_deals'],
        mustContainAny: ['deal', 'active'],
      },
    },
    {
      id: 'audit-format-no-emoji-headers',
      category: 'Audit — Formatting',
      name: 'No emoji in headers',
      description: 'Verify the bot does not use emoji in section headers.',
      userMessage:
        'Give me a pipeline overview — deals by stage, top performers, and areas needing attention.',
      expectedBehavior: [
        'Uses **bold text** for section labels, not emoji headers',
        'No 📊, 📬, 🔍, or similar in headers',
        'Clean, professional formatting',
      ],
      severity: 'high',
      autoValidation: {
        requiresToolCalls: true,
        minResponseLength: 100,
      },
    },
  ];
}
