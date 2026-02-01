import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VisitorCompany {
  id: string;
  session_id: string | null;
  captured_url: string | null;
  seen_at: string | null;
  referrer: string | null;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  business_email: string | null;
  company_name: string | null;
  company_website: string | null;
  company_industry: string | null;
  company_size: string | null;
  estimated_revenue: string | null;
  company_city: string | null;
  company_state: string | null;
  company_country: string | null;
  source: 'rb2b' | 'warmly' | 'manual';
  is_repeat_visit: boolean;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CompanyStats {
  totalIdentified: number;
  uniqueCompanies: number;
  repeatVisitors: number;
  topIndustries: { industry: string; count: number }[];
  topCompanies: { company: string; visits: number; lastSeen: string }[];
  companySizes: { size: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
}

export function useVisitorCompanies(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['visitor-companies', timeRangeDays],
    queryFn: async (): Promise<VisitorCompany[]> => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRangeDays);

      const { data, error } = await supabase
        .from('visitor_companies')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching visitor companies:', error);
        throw error;
      }

      return (data || []) as VisitorCompany[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useVisitorCompanyStats(timeRangeDays: number = 30) {
  const { data: visitors = [], isLoading, error } = useVisitorCompanies(timeRangeDays);

  const stats: CompanyStats = {
    totalIdentified: visitors.length,
    uniqueCompanies: new Set(visitors.map(v => v.company_name).filter(Boolean)).size,
    repeatVisitors: visitors.filter(v => v.is_repeat_visit).length,
    topIndustries: [],
    topCompanies: [],
    companySizes: [],
    sourceBreakdown: [],
  };

  // Calculate industry breakdown
  const industryMap = new Map<string, number>();
  visitors.forEach(v => {
    if (v.company_industry) {
      industryMap.set(v.company_industry, (industryMap.get(v.company_industry) || 0) + 1);
    }
  });
  stats.topIndustries = Array.from(industryMap.entries())
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate top companies
  const companyMap = new Map<string, { visits: number; lastSeen: string }>();
  visitors.forEach(v => {
    if (v.company_name) {
      const existing = companyMap.get(v.company_name);
      if (existing) {
        existing.visits++;
        if (new Date(v.created_at) > new Date(existing.lastSeen)) {
          existing.lastSeen = v.created_at;
        }
      } else {
        companyMap.set(v.company_name, { visits: 1, lastSeen: v.created_at });
      }
    }
  });
  stats.topCompanies = Array.from(companyMap.entries())
    .map(([company, data]) => ({ company, ...data }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 15);

  // Calculate company size breakdown
  const sizeMap = new Map<string, number>();
  visitors.forEach(v => {
    if (v.company_size) {
      sizeMap.set(v.company_size, (sizeMap.get(v.company_size) || 0) + 1);
    }
  });
  stats.companySizes = Array.from(sizeMap.entries())
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.count - a.count);

  // Calculate source breakdown
  const sourceMap = new Map<string, number>();
  visitors.forEach(v => {
    sourceMap.set(v.source, (sourceMap.get(v.source) || 0) + 1);
  });
  stats.sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return { stats, visitors, isLoading, error };
}

export function useRecentVisitors(limit: number = 20) {
  return useQuery({
    queryKey: ['recent-visitor-companies', limit],
    queryFn: async (): Promise<VisitorCompany[]> => {
      const { data, error } = await supabase
        .from('visitor_companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent visitors:', error);
        throw error;
      }

      return (data || []) as VisitorCompany[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds for live feed
  });
}
