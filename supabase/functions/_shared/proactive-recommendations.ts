/**
 * Proactive Buyer Recommendation Engine
 *
 * Analyzes conversation patterns and proactively suggests next actions
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Recommendation {
  type: 'explore_geography' | 'explore_size' | 'explore_services' | 'review_transcripts' | 'contact_buyers' | 'expand_search' | 'other';
  title: string;
  message: string;
  actionText: string;
  actionQuery?: string;
  priority: 'low' | 'medium' | 'high';
  reasoning: string;
}

/**
 * Generate proactive recommendations based on conversation analysis
 */
export function generateProactiveRecommendations(
  messages: Message[],
  context: {
    type: 'deal' | 'universe' | 'buyers' | 'deals';
    dealId?: string;
    universeId?: string;
  },
  data?: {
    transcriptsAvailable?: number;
    pendingBuyersCount?: number;
    approvedBuyersCount?: number;
  }
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (messages.length === 0) {
    return recommendations;
  }

  const conversationPatterns = analyzeConversation(messages);

  // Recommendation 1: Geography exploration
  if (
    conversationPatterns.focusedOnSize &&
    !conversationPatterns.exploredGeography &&
    conversationPatterns.messageCount >= 3
  ) {
    recommendations.push({
      type: 'explore_geography',
      title: '💡 Explore Geographic Fit',
      message: "You've been focusing on deal size. Geographic proximity is also a strong indicator of buyer interest. Want to explore buyers with regional presence?",
      actionText: 'Show Me Regional Buyers',
      actionQuery: 'Which buyers have presence in or near this deal\'s location?',
      priority: 'high',
      reasoning: 'User focused on size but not geography'
    });
  }

  // Recommendation 2: Service/Industry alignment
  if (
    conversationPatterns.exploredGeography &&
    conversationPatterns.focusedOnSize &&
    !conversationPatterns.exploredServices &&
    conversationPatterns.messageCount >= 4
  ) {
    recommendations.push({
      type: 'explore_services',
      title: '🎯 Check Industry Focus',
      message: "You've looked at size and location. Industry/service alignment is the third key dimension. Let's verify which buyers specialize in this space.",
      actionText: 'Analyze Industry Fit',
      actionQuery: 'Which buyers specialize in this industry or service type?',
      priority: 'high',
      reasoning: 'User explored geo + size but not services'
    });
  }

  // Recommendation 3: Transcript review
  if (
    data?.transcriptsAvailable &&
    data.transcriptsAvailable > 0 &&
    !conversationPatterns.reviewedTranscripts &&
    conversationPatterns.messageCount >= 2
  ) {
    recommendations.push({
      type: 'review_transcripts',
      title: '📞 Review Call Transcripts',
      message: `This deal has ${data.transcriptsAvailable} call transcript${data.transcriptsAvailable > 1 ? 's' : ''} available. Transcripts often reveal valuable insights about owner priorities and deal structure.`,
      actionText: 'Review Transcripts',
      actionQuery: 'What are the key insights from the call transcripts?',
      priority: 'high',
      reasoning: 'Transcripts available but not reviewed'
    });
  }

  // Recommendation 4: Contact outreach
  if (
    conversationPatterns.identifiedTargets &&
    !conversationPatterns.askedForContacts &&
    conversationPatterns.messageCount >= 3
  ) {
    recommendations.push({
      type: 'contact_buyers',
      title: '📧 Ready for Outreach',
      message: "You've identified strong buyer matches. Ready to get contact information and start outreach?",
      actionText: 'Get Contact Info',
      actionQuery: 'Show me contact information for my top 3 buyer targets',
      priority: 'medium',
      reasoning: 'Targets identified, ready for contacts'
    });
  }

  // Recommendation 5: Expand search
  if (
    data?.pendingBuyersCount &&
    data.pendingBuyersCount < 5 &&
    conversationPatterns.messageCount >= 3 &&
    !conversationPatterns.expandedSearch
  ) {
    recommendations.push({
      type: 'expand_search',
      title: '🔍 Limited Options',
      message: `Only ${data.pendingBuyersCount} buyers remain pending. Consider expanding your search criteria to find additional opportunities.`,
      actionText: 'Expand Search',
      actionQuery: 'Are there other buyers I should consider that might be outside my initial criteria?',
      priority: 'medium',
      reasoning: 'Few pending buyers remaining'
    });
  }

  // Recommendation 6: Comparison analysis
  if (
    conversationPatterns.focusedOnOneBuyer &&
    !conversationPatterns.comparedBuyers &&
    conversationPatterns.messageCount >= 4
  ) {
    recommendations.push({
      type: 'other',
      title: '⚖️ Compare Options',
      message: "You've been deep-diving on one buyer. It's helpful to compare multiple buyers side-by-side to make the best decision.",
      actionText: 'Compare Buyers',
      actionQuery: 'Compare my top 5 buyers across all scoring dimensions',
      priority: 'low',
      reasoning: 'Single buyer focus, should compare'
    });
  }

  // Recommendation 7: Deal breakers / rejection analysis
  if (
    data?.approvedBuyersCount &&
    data.approvedBuyersCount >= 3 &&
    !conversationPatterns.reviewedRejections &&
    conversationPatterns.messageCount >= 3
  ) {
    recommendations.push({
      type: 'other',
      title: '❌ Review Passed Buyers',
      message: "You've approved several buyers. It's worth reviewing why others were passed to ensure you're not missing viable options.",
      actionText: 'Review Passes',
      actionQuery: 'Why were buyers passed on this deal? Any that should be reconsidered?',
      priority: 'low',
      reasoning: 'Several approved, should review passes'
    });
  }

  // Recommendation 8: Acquisition timing
  if (
    conversationPatterns.identifiedTargets &&
    !conversationPatterns.checkedTiming &&
    conversationPatterns.messageCount >= 4
  ) {
    recommendations.push({
      type: 'other',
      title: '⏰ Check Buyer Activity',
      message: "Buyer acquisition timing matters. Let's see which of your targets are most active right now.",
      actionText: 'Check Activity',
      actionQuery: 'Which of my target buyers have been most active with acquisitions recently?',
      priority: 'medium',
      reasoning: 'Targets identified, timing matters'
    });
  }

  // Sort by priority (high > medium > low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Return top 2-3 recommendations
  return recommendations.slice(0, 3);
}

/**
 * Analyze conversation to detect patterns
 */
function analyzeConversation(messages: Message[]): {
  messageCount: number;
  focusedOnSize: boolean;
  focusedOnGeography: boolean;
  exploredGeography: boolean;
  exploredServices: boolean;
  reviewedTranscripts: boolean;
  identifiedTargets: boolean;
  askedForContacts: boolean;
  expandedSearch: boolean;
  focusedOnOneBuyer: boolean;
  comparedBuyers: boolean;
  reviewedRejections: boolean;
  checkedTiming: boolean;
} {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  const allText = messages.map(m => m.content.toLowerCase()).join(' ');

  return {
    messageCount: userMessages.length,

    // Size focused
    focusedOnSize: (
      countOccurrences(allText, ['revenue', 'ebitda', 'size', '$']) >= 2
    ),

    // Geography focused
    focusedOnGeography: (
      countOccurrences(allText, ['state', 'region', 'location', 'geographic']) >= 2
    ),

    // Explored geography
    exploredGeography: (
      hasKeyword(allText, ['state', 'region', 'geographic', 'proximity', 'adjacent'])
    ),

    // Explored services
    exploredServices: (
      hasKeyword(allText, ['service', 'industry', 'sector', 'vertical', 'specialize'])
    ),

    // Reviewed transcripts
    reviewedTranscripts: (
      hasKeyword(allText, ['transcript', 'call', 'ceo', 'conversation'])
    ),

    // Identified targets (assistant mentioned multiple buyers)
    identifiedTargets: (
      assistantMessages.some(m => countBuyerMentions(m.content) >= 3)
    ),

    // Asked for contacts
    askedForContacts: (
      hasKeyword(allText, ['contact', 'email', 'phone', 'reach out'])
    ),

    // Expanded search
    expandedSearch: (
      hasKeyword(allText, ['expand', 'broaden', 'more buyer', 'additional', 'other'])
    ),

    // Focused on one buyer
    focusedOnOneBuyer: (
      userMessages.slice(-3).some(m => {
        const buyerNames = m.content.match(/\b[A-Z][a-z]+\s+(Capital|Partners|Equity|Group|Holdings)\b/g);
        return buyerNames && buyerNames.length > 0;
      })
    ),

    // Compared buyers
    comparedBuyers: (
      hasKeyword(allText, ['compare', 'versus', 'vs', 'difference between', 'side by side'])
    ),

    // Reviewed rejections
    reviewedRejections: (
      hasKeyword(allText, ['passed', 'rejected', 'excluded', 'why not', 'deal breaker'])
    ),

    // Checked timing
    checkedTiming: (
      hasKeyword(allText, ['recent', 'active', 'timing', 'last acquisition', 'frequency'])
    ),
  };
}

/**
 * Count keyword occurrences
 */
function countOccurrences(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => {
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

/**
 * Check if text has any keyword
 */
function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Count buyer mentions (bold markdown names)
 */
function countBuyerMentions(text: string): number {
  const matches = text.match(/\*\*[A-Z][a-z\s&]+\*\*/g);
  return matches ? matches.length : 0;
}

/**
 * Save recommendation to database
 */
export async function saveRecommendation(
  supabase: SupabaseClient,
  conversationId: string,
  recommendation: Recommendation
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_recommendations')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        recommendation_type: recommendation.type,
        recommendation_text: recommendation.message,
        recommendation_data: {
          title: recommendation.title,
          actionText: recommendation.actionText,
          actionQuery: recommendation.actionQuery,
          priority: recommendation.priority,
          reasoning: recommendation.reasoning,
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select('id')
      .single();

    if (error) {
      console.error('[proactive-recommendations] Save error:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[proactive-recommendations] Save error:', error);
    return null;
  }
}

/**
 * Mark recommendation as shown
 */
export async function markRecommendationShown(
  supabase: SupabaseClient,
  recommendationId: string
): Promise<void> {
  try {
    await supabase
      .from('chat_recommendations')
      .update({
        shown: true,
        shown_at: new Date().toISOString(),
      })
      .eq('id', recommendationId);
  } catch (error) {
    console.error('[proactive-recommendations] Mark shown error:', error);
  }
}

/**
 * Mark recommendation as clicked
 */
export async function markRecommendationClicked(
  supabase: SupabaseClient,
  recommendationId: string
): Promise<void> {
  try {
    await supabase
      .from('chat_recommendations')
      .update({
        clicked: true,
        clicked_at: new Date().toISOString(),
      })
      .eq('id', recommendationId);
  } catch (error) {
    console.error('[proactive-recommendations] Mark clicked error:', error);
  }
}

/**
 * Mark recommendation as dismissed
 */
export async function markRecommendationDismissed(
  supabase: SupabaseClient,
  recommendationId: string
): Promise<void> {
  try {
    await supabase
      .from('chat_recommendations')
      .update({
        dismissed: true,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', recommendationId);
  } catch (error) {
    console.error('[proactive-recommendations] Mark dismissed error:', error);
  }
}
