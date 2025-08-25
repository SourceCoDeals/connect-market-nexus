import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseCurrency } from '@/lib/currency-utils';

export interface UserScore {
  user_id: string;
  user_name: string;
  user_email: string;
  buyer_type: string;
  conversion_probability: number;
  lifetime_value_prediction: number;
  engagement_level: 'power_user' | 'serious_buyer' | 'browser' | 'inactive';
  optimal_contact_time: string;
  preferred_categories: string[];
  churn_risk: number;
  next_action_recommendation: string;
  days_since_last_activity: number;
  total_sessions: number;
  avg_session_duration: number;
  listing_views: number;
  saves_count: number;
  connection_requests: number;
  profile_completeness: number;
}

export interface BehaviorPattern {
  pattern_id: string;
  pattern_name: string;
  user_count: number;
  conversion_rate: number;
  typical_journey: string[];
  avg_time_to_convert: number;
  success_indicators: string[];
  intervention_opportunities: string[];
}

export interface EngagementStrategy {
  user_segment: string;
  strategy_name: string;
  optimal_timing: string;
  content_type: 'educational' | 'promotional' | 'personal' | 'urgent';
  channel: 'email' | 'in_app' | 'phone' | 'auto_alert';
  expected_response_rate: number;
  message_template: string;
}

export function usePredictiveUserIntelligence(daysBack: number = 30) {
  return useQuery({
    queryKey: ['predictive-user-intelligence', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get comprehensive user data
      const { data: users } = await supabase
        .from('profiles')
        .select(`
          id, email, first_name, last_name, buyer_type, created_at, business_categories,
          revenue_range_min, revenue_range_max, company
        `)
        .eq('approval_status', 'approved')
        .eq('email_verified', true);

      if (!users) return { userScores: [], behaviorPatterns: [], engagementStrategies: [] };

      // Get user activity data
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('user_id, started_at, ended_at')
        .gte('started_at', startDate.toISOString());

      const { data: analytics } = await supabase
        .from('listing_analytics')
        .select('user_id, listing_id, action_type, time_spent, created_at')
        .gte('created_at', startDate.toISOString());

      const { data: saves } = await supabase
        .from('saved_listings')
        .select('user_id, created_at')
        .gte('created_at', startDate.toISOString());

      const { data: connections } = await supabase
        .from('connection_requests')
        .select('user_id, status, created_at')
        .gte('created_at', startDate.toISOString());

      // Calculate user scores
      const userScores: UserScore[] = users.map(user => {
        const userSessions = sessions?.filter(s => s.user_id === user.id) || [];
        const userAnalytics = analytics?.filter(a => a.user_id === user.id) || [];
        const userSaves = saves?.filter(s => s.user_id === user.id) || [];
        const userConnections = connections?.filter(c => c.user_id === user.id) || [];

        // Calculate metrics
        const totalSessions = userSessions.length;
        const avgSessionDuration = userSessions.length > 0 
          ? userSessions.reduce((sum, s) => {
              const duration = s.ended_at 
                ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60
                : 30; // Default 30 minutes if no end time
              return sum + duration;
            }, 0) / userSessions.length
          : 0;

        const listingViews = userAnalytics.filter(a => a.action_type === 'view').length;
        const savesCount = userSaves.length;
        const connectionRequests = userConnections.length;
        const approvedConnections = userConnections.filter(c => c.status === 'approved').length;

        // Calculate engagement level
        let engagementLevel: UserScore['engagement_level'] = 'inactive';
        if (totalSessions > 20 && listingViews > 50) engagementLevel = 'power_user';
        else if (connectionRequests > 2 || (savesCount > 5 && listingViews > 20)) engagementLevel = 'serious_buyer';
        else if (listingViews > 5 || savesCount > 0) engagementLevel = 'browser';

        // Calculate conversion probability (0-100)
        const viewsScore = Math.min(listingViews / 10 * 25, 25);
        const savesScore = Math.min(savesCount / 5 * 30, 30);
        const connectionsScore = Math.min(connectionRequests * 15, 30);
        const sessionScore = Math.min(totalSessions / 10 * 15, 15);
        
        const conversionProbability = viewsScore + savesScore + connectionsScore + sessionScore;

        // Calculate lifetime value prediction
        const revenueRange = (user.revenue_range_max ? parseCurrency(String(user.revenue_range_max)) : 1000000) - (user.revenue_range_min ? parseCurrency(String(user.revenue_range_min)) : 0);
        const engagementMultiplier = engagementLevel === 'power_user' ? 1.5 : 
                                   engagementLevel === 'serious_buyer' ? 1.2 : 
                                   engagementLevel === 'browser' ? 0.8 : 0.3;
        const lifetimeValuePrediction = (revenueRange * 0.02 * engagementMultiplier); // 2% commission estimate

        // Calculate profile completeness
        const profileFields = [user.first_name, user.last_name, user.company, user.business_categories, user.revenue_range_min];
        const profileCompleteness = (profileFields.filter(f => f && f !== '').length / profileFields.length) * 100;

        // Calculate days since last activity
        const lastActivity = Math.max(
          ...[...userSessions.map(s => s.started_at), ...userAnalytics.map(a => a.created_at), ...userSaves.map(s => s.created_at), ...userConnections.map(c => c.created_at)]
            .map(date => new Date(date).getTime()),
          new Date(user.created_at).getTime()
        );
        const daysSinceLastActivity = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));

        // Calculate churn risk
        const churnRisk = Math.min(
          (daysSinceLastActivity * 5) + 
          (engagementLevel === 'inactive' ? 30 : 0) + 
          (conversionProbability < 20 ? 20 : 0) +
          (profileCompleteness < 50 ? 15 : 0), 
          100
        );

        // Generate next action recommendation
        let nextActionRecommendation = '';
        if (churnRisk > 70) nextActionRecommendation = 'Immediate re-engagement call required';
        else if (engagementLevel === 'serious_buyer' && connectionRequests === 0) nextActionRecommendation = 'Follow up with curated listings';
        else if (savesCount > 3 && connectionRequests === 0) nextActionRecommendation = 'Encourage connection on saved listings';
        else if (listingViews > 10 && savesCount === 0) nextActionRecommendation = 'Share listings matching their criteria';
        else if (profileCompleteness < 70) nextActionRecommendation = 'Help complete profile for better matches';
        else nextActionRecommendation = 'Send weekly market update';

        // Determine optimal contact time based on activity patterns
        const optimalContactTime = daysSinceLastActivity < 3 ? 'Within 24 hours' :
                                 daysSinceLastActivity < 7 ? 'Within 3 days' :
                                 daysSinceLastActivity < 14 ? 'Within 1 week' :
                                 'Immediate attention needed';

        return {
          user_id: user.id,
          user_name: `${user.first_name} ${user.last_name}`.trim() || user.email,
          user_email: user.email,
          buyer_type: user.buyer_type || 'unknown',
          conversion_probability: Math.round(conversionProbability),
          lifetime_value_prediction: Math.round(lifetimeValuePrediction),
          engagement_level: engagementLevel,
          optimal_contact_time: optimalContactTime,
          preferred_categories: Array.isArray(user.business_categories) ? 
            user.business_categories.map(cat => String(cat)) : [],
          churn_risk: Math.round(churnRisk),
          next_action_recommendation: nextActionRecommendation,
          days_since_last_activity: daysSinceLastActivity,
          total_sessions: totalSessions,
          avg_session_duration: Math.round(avgSessionDuration),
          listing_views: listingViews,
          saves_count: savesCount,
          connection_requests: connectionRequests,
          profile_completeness: Math.round(profileCompleteness)
        };
      });

      // Analyze behavior patterns
      const patterns = new Map<string, {users: string[], conversions: number, totalTime: number}>();
      
      userScores.forEach(user => {
        // Create pattern key based on user behavior
        const patternKey = `${user.engagement_level}_${user.buyer_type}_${
          user.listing_views > 20 ? 'high_views' : user.listing_views > 5 ? 'medium_views' : 'low_views'
        }`;
        
        if (!patterns.has(patternKey)) {
          patterns.set(patternKey, {users: [], conversions: 0, totalTime: 0});
        }
        
        const pattern = patterns.get(patternKey)!;
        pattern.users.push(user.user_id);
        if (user.connection_requests > 0) pattern.conversions++;
        pattern.totalTime += user.days_since_last_activity;
      });

      const behaviorPatterns: BehaviorPattern[] = Array.from(patterns.entries())
        .map(([key, data]) => {
          const [engagement, buyerType, viewLevel] = key.split('_');
          const conversionRate = data.users.length > 0 ? (data.conversions / data.users.length) * 100 : 0;
          const avgTimeToConvert = data.users.length > 0 ? data.totalTime / data.users.length : 0;
          
          return {
            pattern_id: key,
            pattern_name: `${engagement.replace('_', ' ')} ${buyerType} with ${viewLevel.replace('_', ' ')}`,
            user_count: data.users.length,
            conversion_rate: conversionRate,
            typical_journey: [
              'Profile creation',
              viewLevel.includes('high') ? 'Extensive browsing' : 'Light browsing',
              engagement === 'serious_buyer' ? 'Multiple saves' : 'Occasional saves',
              'Connection requests'
            ],
            avg_time_to_convert: avgTimeToConvert,
            success_indicators: [
              'Multiple listing views within first week',
              'Profile completion >70%',
              'Saves within 3 days of viewing'
            ],
            intervention_opportunities: [
              'Follow up within 48 hours of first save',
              'Personalized listing curation after 5+ views',
              'Direct outreach for serious buyers with no connections'
            ]
          };
        })
        .filter(pattern => pattern.user_count >= 3)
        .sort((a, b) => b.conversion_rate - a.conversion_rate);

      // Generate engagement strategies
      const engagementStrategies: EngagementStrategy[] = [
        {
          user_segment: 'power_user',
          strategy_name: 'VIP Treatment Program',
          optimal_timing: 'Weekly check-ins',
          content_type: 'personal',
          channel: 'phone',
          expected_response_rate: 85,
          message_template: 'Exclusive early access to premium listings'
        },
        {
          user_segment: 'serious_buyer',
          strategy_name: 'Curated Recommendations',
          optimal_timing: 'Bi-weekly',
          content_type: 'promotional',
          channel: 'email',
          expected_response_rate: 65,
          message_template: 'Hand-picked listings matching your criteria'
        },
        {
          user_segment: 'browser',
          strategy_name: 'Educational Nurturing',
          optimal_timing: 'Monthly',
          content_type: 'educational',
          channel: 'email',
          expected_response_rate: 35,
          message_template: 'Market insights and buying guides'
        },
        {
          user_segment: 'inactive',
          strategy_name: 'Re-engagement Campaign',
          optimal_timing: 'Immediate',
          content_type: 'urgent',
          channel: 'email',
          expected_response_rate: 15,
          message_template: 'Exclusive opportunities you may have missed'
        }
      ];

      return {
        userScores: userScores.sort((a, b) => b.conversion_probability - a.conversion_probability),
        behaviorPatterns,
        engagementStrategies
      };
    },
    refetchInterval: 300000, // 5 minutes
  });
}