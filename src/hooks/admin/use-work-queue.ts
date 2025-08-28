import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface WorkQueueItem {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  role?: string;
  message?: string;
  priority_score: number;
  source: string;
  created_at: string;
  status: string;
  urgency: 'high' | 'medium' | 'low';
  daysOld: number;
}

export interface WorkQueueFilters {
  status?: string;
  source?: string;
  role?: string;
  urgency?: string;
  minScore?: number;
  maxAge?: number;
}

export function useWorkQueue(filters: WorkQueueFilters = {}) {
  const { user, authChecked, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['work-queue', filters],
    queryFn: async (): Promise<WorkQueueItem[]> => {
      let query = supabase
        .from('inbound_leads')
        .select('*');

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.source) {
        query = query.eq('source', filters.source);
      }
      
      if (filters.role) {
        query = query.eq('role', filters.role);
      }
      
      if (filters.minScore) {
        query = query.gte('priority_score', filters.minScore);
      }

      const { data: leads } = await query.order('priority_score', { ascending: false });

      if (!leads) return [];

      const now = new Date();

      return leads
        .map((lead): WorkQueueItem => {
          const createdAt = new Date(lead.created_at);
          const daysOld = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          
          // Calculate urgency based on age and score
          let urgency: 'high' | 'medium' | 'low' = 'low';
          if (daysOld > 7 || lead.priority_score >= 80) {
            urgency = 'high';
          } else if (daysOld > 3 || lead.priority_score >= 60) {
            urgency = 'medium';
          }

          return {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            company_name: lead.company_name,
            role: lead.role,
            message: lead.message,
            priority_score: lead.priority_score,
            source: lead.source,
            created_at: lead.created_at,
            status: lead.status,
            urgency,
            daysOld,
          };
        })
        .filter(item => {
          // Apply additional filters
          if (filters.urgency && item.urgency !== filters.urgency) return false;
          if (filters.maxAge && item.daysOld > filters.maxAge) return false;
          return true;
        })
        .sort((a, b) => {
          // Sort by urgency first, then by score, then by age
          const urgencyOrder = { high: 3, medium: 2, low: 1 };
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
          }
          if (a.priority_score !== b.priority_score) {
            return b.priority_score - a.priority_score;
          }
          return b.daysOld - a.daysOld;
        });
    },
    enabled: authChecked && user && isAdmin,
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useWorkQueueStats() {
  const { user, authChecked, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['work-queue-stats'],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from('inbound_leads')
        .select('status, priority_score, created_at');

      if (!leads) return { totalItems: 0, highPriority: 0, overdue: 0, avgWaitTime: 0 };

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const pendingLeads = leads.filter(l => l.status === 'pending');
      const totalItems = pendingLeads.length;
      
      const highPriority = pendingLeads.filter(l => 
        l.priority_score >= 80 || new Date(l.created_at) < threeDaysAgo
      ).length;
      
      const overdue = pendingLeads.filter(l => 
        new Date(l.created_at) < oneDayAgo
      ).length;

      const avgWaitTime = pendingLeads.length > 0
        ? pendingLeads.reduce((acc, lead) => {
            const createdAt = new Date(lead.created_at);
            const waitTime = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // hours
            return acc + waitTime;
          }, 0) / pendingLeads.length
        : 0;

      return {
        totalItems,
        highPriority,
        overdue,
        avgWaitTime,
      };
    },
    enabled: authChecked && user && isAdmin,
    refetchInterval: 60000,
  });
}