import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface LeadMetrics {
  // Intake metrics
  totalLeads: number;
  newLeadsToday: number;
  newLeadsThisWeek: number;
  newLeadsThisMonth: number;
  
  // Status breakdown
  pendingLeads: number;
  mappedLeads: number;
  mergedLeads: number;
  discardedLeads: number;
  
  // Source breakdown
  webflowLeads: number;
  manualLeads: number;
  
  // Conversion metrics
  conversionRate: number;
  avgTimeToMap: number;
  avgScore: number;
  
  // Performance tracking
  mappingsToday: number;
  mappingsThisWeek: number;
  topPerformingRoles: Array<{ role: string; count: number }>;
  topPerformingCompanies: Array<{ company: string; count: number }>;
}

export function useLeadMetrics() {
  const { user, authChecked, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['lead-metrics'],
    queryFn: async (): Promise<LeadMetrics> => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all leads data
      const { data: leads } = await supabase
        .from('inbound_leads')
        .select('*');

      if (!leads) {
        return {
          totalLeads: 0,
          newLeadsToday: 0,
          newLeadsThisWeek: 0,
          newLeadsThisMonth: 0,
          pendingLeads: 0,
          mappedLeads: 0,
          mergedLeads: 0,
          discardedLeads: 0,
          webflowLeads: 0,
          manualLeads: 0,
          conversionRate: 0,
          avgTimeToMap: 0,
          avgScore: 0,
          mappingsToday: 0,
          mappingsThisWeek: 0,
          topPerformingRoles: [],
          topPerformingCompanies: [],
        };
      }

      // Calculate basic counts
      const totalLeads = leads.length;
      const newLeadsToday = leads.filter(l => new Date(l.created_at) >= startOfToday).length;
      const newLeadsThisWeek = leads.filter(l => new Date(l.created_at) >= startOfWeek).length;
      const newLeadsThisMonth = leads.filter(l => new Date(l.created_at) >= startOfMonth).length;

      // Status breakdown
      const pendingLeads = leads.filter(l => l.status === 'pending').length;
      const mappedLeads = leads.filter(l => l.status === 'mapped').length;
      const mergedLeads = leads.filter(l => l.status === 'merged').length;
      const discardedLeads = leads.filter(l => l.status === 'discarded').length;

      // Source breakdown
      const webflowLeads = leads.filter(l => l.source === 'webflow').length;
      const manualLeads = leads.filter(l => l.source === 'manual').length;

      // Conversion metrics
      const convertedLeads = mappedLeads + mergedLeads;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Average time to map (in hours)
      const mappedLeadsWithTime = leads.filter(l => l.status === 'mapped' && l.mapped_at);
      const avgTimeToMap = mappedLeadsWithTime.length > 0 
        ? mappedLeadsWithTime.reduce((acc, lead) => {
            const createdAt = new Date(lead.created_at);
            const mappedAt = new Date(lead.mapped_at!);
            return acc + (mappedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // hours
          }, 0) / mappedLeadsWithTime.length
        : 0;

      // Average score
      const leadsWithScore = leads.filter(l => l.priority_score > 0);
      const avgScore = leadsWithScore.length > 0
        ? leadsWithScore.reduce((acc, lead) => acc + lead.priority_score, 0) / leadsWithScore.length
        : 0;

      // Mappings today and this week
      const mappingsToday = leads.filter(l => 
        l.status === 'mapped' && l.mapped_at && new Date(l.mapped_at) >= startOfToday
      ).length;
      
      const mappingsThisWeek = leads.filter(l => 
        l.status === 'mapped' && l.mapped_at && new Date(l.mapped_at) >= startOfWeek
      ).length;

      // Top performing roles
      const roleCount: Record<string, number> = {};
      leads.filter(l => l.role).forEach(lead => {
        roleCount[lead.role!] = (roleCount[lead.role!] || 0) + 1;
      });
      const topPerformingRoles = Object.entries(roleCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([role, count]) => ({ role, count }));

      // Top performing companies
      const companyCount: Record<string, number> = {};
      leads.filter(l => l.company_name).forEach(lead => {
        companyCount[lead.company_name!] = (companyCount[lead.company_name!] || 0) + 1;
      });
      const topPerformingCompanies = Object.entries(companyCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([company, count]) => ({ company, count }));

      return {
        totalLeads,
        newLeadsToday,
        newLeadsThisWeek,
        newLeadsThisMonth,
        pendingLeads,
        mappedLeads,
        mergedLeads,
        discardedLeads,
        webflowLeads,
        manualLeads,
        conversionRate,
        avgTimeToMap,
        avgScore,
        mappingsToday,
        mappingsThisWeek,
        topPerformingRoles,
        topPerformingCompanies,
      };
    },
    enabled: authChecked && user && isAdmin,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}