import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DataIntegrityIssue {
  id: string;
  type: 'duplicate_emails' | 'orphaned_requests' | 'missing_profiles' | 'inconsistent_status';
  severity: 'low' | 'medium' | 'high';
  message: string;
  table: string;
  recordId?: string;
  details?: any;
}

// Safe data integrity monitoring without modifying core functions
export function useDataIntegrityMonitor() {
  return useQuery<DataIntegrityIssue[]>({
    queryKey: ['data-integrity-monitor'],
    queryFn: async () => {
      const issues: DataIntegrityIssue[] = [];

      try {
        // Check for duplicate emails in profiles (case-insensitive)
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email')
          .not('email', 'is', null);

        if (!profilesError && profiles) {
          const emailMap = new Map<string, string[]>();
          profiles.forEach(profile => {
            const lowerEmail = profile.email.toLowerCase();
            if (!emailMap.has(lowerEmail)) {
              emailMap.set(lowerEmail, []);
            }
            emailMap.get(lowerEmail)!.push(profile.id);
          });

          emailMap.forEach((ids, email) => {
            if (ids.length > 1) {
              issues.push({
                id: `duplicate-email-${email}`,
                type: 'duplicate_emails',
                severity: 'high',
                message: `Duplicate email found: ${email} (${ids.length} profiles)`,
                table: 'profiles',
                details: { email, profileIds: ids }
              });
            }
          });
        }

        // Check for connection requests without valid listing references
        const { data: orphanedRequests, error: orphanedError } = await supabase
          .from('connection_requests')
          .select(`
            id,
            listing_id,
            listings!inner(id)
          `)
          .is('listings.id', null);

        if (!orphanedError && orphanedRequests) {
          orphanedRequests.forEach(request => {
            issues.push({
              id: `orphaned-request-${request.id}`,
              type: 'orphaned_requests',
              severity: 'medium',
              message: `Connection request references non-existent listing`,
              table: 'connection_requests',
              recordId: request.id,
              details: { listingId: request.listing_id }
            });
          });
        }

        // Check for lead-only requests with missing lead data
        const { data: incompleteLeadRequests, error: leadRequestsError } = await supabase
          .from('connection_requests')
          .select('id, lead_email, lead_name, user_id')
          .is('user_id', null)
          .or('lead_email.is.null,lead_name.is.null');

        if (!leadRequestsError && incompleteLeadRequests) {
          incompleteLeadRequests.forEach(request => {
            issues.push({
              id: `incomplete-lead-${request.id}`,
              type: 'missing_profiles',
              severity: 'medium',
              message: `Lead-only request missing required lead data`,
              table: 'connection_requests',
              recordId: request.id,
              details: { 
                hasEmail: !!request.lead_email, 
                hasName: !!request.lead_name 
              }
            });
          });
        }

      } catch (error) {
        console.error('Data integrity monitor error:', error);
        issues.push({
          id: 'monitor-error',
          type: 'inconsistent_status',
          severity: 'low',
          message: 'Error running data integrity checks',
          table: 'system',
          details: { error: error.message }
        });
      }

      return issues;
    },
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
  });
}

// Hook to get summary of data integrity status
export function useDataIntegritySummary() {
  const { data: issues = [] } = useDataIntegrityMonitor();
  
  return {
    totalIssues: issues.length,
    highSeverity: issues.filter(i => i.severity === 'high').length,
    mediumSeverity: issues.filter(i => i.severity === 'medium').length,
    lowSeverity: issues.filter(i => i.severity === 'low').length,
    hasIssues: issues.length > 0,
    issues
  };
}