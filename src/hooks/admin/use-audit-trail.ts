import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface AuditEntry {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  old_data?: any;
  new_data?: any;
  metadata?: any;
  created_at: string;
  description: string;
}

export interface AuditFilters {
  adminId?: string;
  entityType?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export function useAuditTrail(filters: AuditFilters = {}) {
  const { user, authChecked, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['audit-trail', filters],
    queryFn: async (): Promise<AuditEntry[]> => {
      // Since we don't have a dedicated audit table yet, we'll create audit entries
      // from existing data and actions. In a real implementation, we'd have triggers
      // that automatically log all admin actions.
      
      const auditEntries: AuditEntry[] = [];

      // Get lead mapping activities
      const { data: mappedLeads } = await supabase
        .from('inbound_leads')
        .select(`
          id, 
          name, 
          status, 
          mapped_at, 
          mapped_by,
          mapped_to_listing_id,
          profiles!inbound_leads_mapped_by_fkey(first_name, last_name, email)
        `)
        .not('mapped_at', 'is', null)
        .order('mapped_at', { ascending: false })
        .limit(filters.limit || 50);

      if (mappedLeads) {
        mappedLeads.forEach((lead: any) => {
          const adminProfile = lead.profiles;
          auditEntries.push({
            id: `lead-mapping-${lead.id}`,
            action_type: 'lead_mapped',
            entity_type: 'inbound_lead',
            entity_id: lead.id,
            admin_id: lead.mapped_by,
            admin_name: adminProfile ? `${adminProfile.first_name} ${adminProfile.last_name}` : 'Unknown Admin',
            admin_email: adminProfile?.email,
            metadata: {
              lead_name: lead.name,
              listing_id: lead.mapped_to_listing_id,
              status: lead.status
            },
            created_at: lead.mapped_at,
            description: `Lead "${lead.name}" mapped to listing`,
          });
        });
      }

      // Get connection request decisions
      const { data: decisions } = await supabase
        .from('connection_requests')
        .select(`
          id,
          status,
          decision_at,
          approved_by,
          rejected_by,
          on_hold_by,
          profiles!connection_requests_user_id_fkey(first_name, last_name),
          approvedByAdmin:profiles!connection_requests_approved_by_fkey(first_name, last_name, email),
          rejectedByAdmin:profiles!connection_requests_rejected_by_fkey(first_name, last_name, email),
          onHoldByAdmin:profiles!connection_requests_on_hold_by_fkey(first_name, last_name, email),
          listings(title)
        `)
        .not('decision_at', 'is', null)
        .order('decision_at', { ascending: false })
        .limit(filters.limit || 50) as { data: any[] | null; error: any };

      if (decisions) {
        decisions.forEach((decision: any) => {
          let adminProfile;
          let actionType = 'request_status_changed';
          
          if (decision.status === 'approved' && decision.approvedByAdmin) {
            adminProfile = decision.approvedByAdmin;
            actionType = 'request_approved';
          } else if (decision.status === 'rejected' && decision.rejectedByAdmin) {
            adminProfile = decision.rejectedByAdmin;
            actionType = 'request_rejected';
          } else if (decision.status === 'on_hold' && decision.onHoldByAdmin) {
            adminProfile = decision.onHoldByAdmin;
            actionType = 'request_on_hold';
          }

          if (adminProfile) {
            const userProfile = decision.profiles;
            auditEntries.push({
              id: `request-decision-${decision.id}`,
              action_type: actionType,
              entity_type: 'connection_request',
              entity_id: decision.id,
              admin_id: decision.approved_by || decision.rejected_by || decision.on_hold_by,
              admin_name: `${adminProfile.first_name} ${adminProfile.last_name}`,
              admin_email: adminProfile.email,
              metadata: {
                status: decision.status,
                user_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Unknown User',
                listing_title: decision.listings?.title || 'Unknown Listing'
              },
              created_at: decision.decision_at,
              description: `Connection request ${decision.status} for "${decision.listings?.title || 'Unknown Listing'}"`,
            });
          }
        });
      }

      // Sort all entries by date, newest first
      auditEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply filters
      let filteredEntries = auditEntries;

      if (filters.adminId) {
        filteredEntries = filteredEntries.filter(entry => entry.admin_id === filters.adminId);
      }

      if (filters.entityType) {
        filteredEntries = filteredEntries.filter(entry => entry.entity_type === filters.entityType);
      }

      if (filters.actionType) {
        filteredEntries = filteredEntries.filter(entry => entry.action_type === filters.actionType);
      }

      if (filters.startDate) {
        filteredEntries = filteredEntries.filter(entry => 
          new Date(entry.created_at) >= new Date(filters.startDate!)
        );
      }

      if (filters.endDate) {
        filteredEntries = filteredEntries.filter(entry => 
          new Date(entry.created_at) <= new Date(filters.endDate!)
        );
      }

      return filteredEntries.slice(0, filters.limit || 50);
    },
    enabled: authChecked && user && isAdmin,
    refetchInterval: 30000,
  });
}

export function useAuditStats() {
  const { user, authChecked, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

      // Get mapping activities
      const { data: mappings } = await supabase
        .from('inbound_leads')
        .select('mapped_at')
        .not('mapped_at', 'is', null);

      // Get decision activities
      const { data: decisions } = await supabase
        .from('connection_requests')
        .select('decision_at')
        .not('decision_at', 'is', null);

      const mappingsToday = mappings?.filter(m => 
        new Date(m.mapped_at!) >= startOfToday
      ).length || 0;

      const mappingsThisWeek = mappings?.filter(m => 
        new Date(m.mapped_at!) >= startOfWeek
      ).length || 0;

      const decisionsToday = decisions?.filter(d => 
        new Date(d.decision_at!) >= startOfToday
      ).length || 0;

      const decisionsThisWeek = decisions?.filter(d => 
        new Date(d.decision_at!) >= startOfWeek
      ).length || 0;

      return {
        mappingsToday,
        mappingsThisWeek,
        decisionsToday,
        decisionsThisWeek,
        totalActivities: (mappings?.length || 0) + (decisions?.length || 0),
      };
    },
    enabled: authChecked && user && isAdmin,
    refetchInterval: 60000,
  });
}

// Hook to manually log audit events (for future use)
export function useLogAudit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionType,
      entityType,
      entityId,
      oldData,
      newData,
      metadata,
      description
    }: {
      actionType: string;
      entityType: string;
      entityId: string;
      oldData?: any;
      newData?: any;
      metadata?: any;
      description: string;
    }) => {
      // In a real implementation, this would insert into an audit_logs table
      // For now, we'll just invalidate the audit trail to refresh it
      queryClient.invalidateQueries({ queryKey: ['audit-trail'] });
      queryClient.invalidateQueries({ queryKey: ['audit-stats'] });
    },
  });
}