import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface DataIntegrityMetrics {
  incompleteProfiles: number;
  missingCriticalFields: number;
  recentSignupsWithIssues: number;
  totalSignupsToday: number;
  formDropOffRate: number;
  validationErrorRate: number;
}

export function useDataIntegrity() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['data-integrity-metrics'],
    queryFn: async (): Promise<DataIntegrityMetrics> => {
      if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null);

      if (profilesError) throw profilesError;

      // Get registration funnel data for today
      const { data: funnelData, error: funnelError } = await supabase
        .from('registration_funnel')
        .select('*')
        .gte('created_at', startOfDay.toISOString());

      if (funnelError) throw funnelError;

      // Calculate metrics
      const totalSignupsToday = profiles?.filter(p => 
        new Date(p.created_at) >= startOfDay
      ).length || 0;

      const incompleteProfiles = profiles?.filter(p => {
        const requiredFields = ['first_name', 'last_name', 'company', 'buyer_type', 'phone_number'];
        return !requiredFields.every(field => p[field as keyof typeof p] && p[field as keyof typeof p] !== '');
      }).length || 0;

      const missingCriticalFields = profiles?.filter(p => {
        const buyerSpecificFields = {
          corporate: ['estimated_revenue'],
          privateEquity: ['fund_size', 'investment_size'],
          familyOffice: ['fund_size', 'aum'],
          searchFund: ['is_funded', 'target_company_size'],
          individual: ['funding_source', 'needs_loan', 'ideal_target']
        };

        if (!p.buyer_type) return true;

        const requiredFields = buyerSpecificFields[p.buyer_type as keyof typeof buyerSpecificFields] || [];
        return requiredFields.some(field => !p[field as keyof typeof p] || p[field as keyof typeof p] === '');
      }).length || 0;

      const recentSignupsWithIssues = profiles?.filter(p => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        if (new Date(p.created_at) < threeDaysAgo) return false;

        // Check if they have missing buyer-specific fields
        const buyerSpecificFields = {
          corporate: ['estimated_revenue'],
          privateEquity: ['fund_size', 'investment_size'],
          familyOffice: ['fund_size', 'aum'],
          searchFund: ['is_funded', 'target_company_size'],
          individual: ['funding_source', 'needs_loan', 'ideal_target']
        };

        if (!p.buyer_type) return true;

        const requiredFields = buyerSpecificFields[p.buyer_type as keyof typeof buyerSpecificFields] || [];
        return requiredFields.some(field => !p[field as keyof typeof p] || p[field as keyof typeof p] === '');
      }).length || 0;

      // Calculate drop-off rate (mock calculation)
      const completedSignups = funnelData?.filter(f => f.step_name === 'completion').length || 0;
      const startedSignups = funnelData?.filter(f => f.step_name === 'start').length || 0;
      const formDropOffRate = startedSignups > 0 ? ((startedSignups - completedSignups) / startedSignups) * 100 : 0;

      // Mock validation error rate
      const validationErrorRate = Math.random() * 5; // 0-5% error rate

      return {
        incompleteProfiles,
        missingCriticalFields,
        recentSignupsWithIssues,
        totalSignupsToday,
        formDropOffRate,
        validationErrorRate
      };
    },
    enabled: isAdmin,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
  });
}

export function useDataIntegrityAlerts() {
  const { data: metrics } = useDataIntegrity();

  const alerts = [];

  if (metrics) {
    if (metrics.formDropOffRate > 30) {
      alerts.push({
        type: 'error' as const,
        title: 'High Form Drop-off Rate',
        message: `${Math.round(metrics.formDropOffRate)}% of users are dropping off during signup. Consider reviewing the form UX.`,
        priority: 'high' as const
      });
    }

    if (metrics.validationErrorRate > 10) {
      alerts.push({
        type: 'warning' as const,
        title: 'High Validation Error Rate',
        message: `${Math.round(metrics.validationErrorRate)}% of form submissions have validation errors.`,
        priority: 'medium' as const
      });
    }

    if (metrics.recentSignupsWithIssues > 5) {
      alerts.push({
        type: 'warning' as const,
        title: 'Recent Signups Missing Data',
        message: `${metrics.recentSignupsWithIssues} users who signed up in the last 3 days have incomplete profiles.`,
        priority: 'medium' as const
      });
    }

    if (metrics.missingCriticalFields > 20) {
      alerts.push({
        type: 'info' as const,
        title: 'Users Need Profile Completion',
        message: `${metrics.missingCriticalFields} users are missing buyer-specific information. Consider running a data recovery campaign.`,
        priority: 'low' as const
      });
    }
  }

  return alerts;
}