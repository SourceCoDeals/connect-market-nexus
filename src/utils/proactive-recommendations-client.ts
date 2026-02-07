import type { Recommendation } from '@/components/remarketing/ProactiveRecommendation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function generateProactiveRecommendations(
  messages: Message[],
  _context: { type: string; dealId?: string; universeId?: string },
  data?: {
    transcriptsAvailable?: number;
  }
): Recommendation[] {
  const userQueries = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  const recommendations: Recommendation[] = [];

  if (messages.length < 6) return [];

  const hasAskedAboutGeography = userQueries.some(q =>
    q.includes('state') || q.includes('region') || q.includes('location') || q.includes('geography')
  );
  const hasAskedAboutTranscripts = userQueries.some(q =>
    q.includes('transcript') || q.includes('call') || q.includes('conversation')
  );
  const hasAskedAboutContacts = userQueries.some(q =>
    q.includes('contact') || q.includes('email') || q.includes('phone')
  );

  if (!hasAskedAboutGeography) {
    recommendations.push({
      type: 'explore_geography',
      title: '💡 Explore Geographic Fit',
      message: "You haven't explored geographic proximity yet. Location can be a strong indicator of buyer interest.",
      actionText: 'Show Me Regional Buyers',
      actionQuery: "Which buyers have presence in or near this deal's location?",
      priority: 'high',
      reasoning: 'User has not explored geography dimension'
    });
  }

  if (!hasAskedAboutTranscripts && data?.transcriptsAvailable && data.transcriptsAvailable > 0) {
    recommendations.push({
      type: 'explore_transcripts',
      title: '📞 Review Call Transcripts',
      message: `There are ${data.transcriptsAvailable} call transcripts available with valuable buyer insights.`,
      actionText: 'Show Me Call Insights',
      actionQuery: 'What are the key insights from call transcripts?',
      priority: 'high',
      reasoning: `${data.transcriptsAvailable} transcripts available but not explored`
    });
  }

  if (!hasAskedAboutContacts) {
    recommendations.push({
      type: 'get_contacts',
      title: '📧 Get Contact Information',
      message: "You've been researching buyers. Ready to reach out? Get their contact details.",
      actionText: 'Show Contact Info',
      actionQuery: 'Show me contact information for the top 5 buyers',
      priority: 'medium',
      reasoning: 'User has not requested contact information yet'
    });
  }

  return recommendations.slice(0, 1);
}
