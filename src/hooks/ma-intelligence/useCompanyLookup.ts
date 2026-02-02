import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeDomain } from '@/lib/ma-intelligence/normalizeDomain';

interface Company {
  id: string;
  domain: string;
  company_name: string;
  company_website: string | null;
  revenue: number | null;
  ebitda_amount: number | null;
  geography: string[] | null;
  service_mix: string | null;
  created_at: string;
}

interface DealHistoryItem {
  id: string;
  tracker_id: string;
  tracker_name: string;
  status: string | null;
  created_at: string;
}

export function useCompanyLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [existingCompany, setExistingCompany] = useState<Company | null>(null);
  const [dealHistory, setDealHistory] = useState<DealHistoryItem[]>([]);

  const lookupByDomain = useCallback(async (websiteOrDomain: string) => {
    const domain = normalizeDomain(websiteOrDomain);
    if (!domain) {
      setExistingCompany(null);
      setDealHistory([]);
      return null;
    }

    setIsLookingUp(true);
    try {
      // Look up company by domain
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('domain', domain)
        .maybeSingle();

      if (error) {
        console.error('Company lookup error:', error);
        setExistingCompany(null);
        setDealHistory([]);
        return null;
      }

      setExistingCompany(company);

      // If company exists, get deal history
      if (company) {
        const { data: deals } = await supabase
          .from('deals')
          .select(`
            id,
            tracker_id,
            status,
            created_at,
            industry_trackers:tracker_id (industry_name)
          `)
          .eq('company_id', company.id)
          .order('created_at', { ascending: false });

        const history: DealHistoryItem[] = (deals || []).map((d: any) => ({
          id: d.id,
          tracker_id: d.tracker_id,
          tracker_name: d.industry_trackers?.industry_name || 'Unknown',
          status: d.status,
          created_at: d.created_at,
        }));

        setDealHistory(history);
      } else {
        setDealHistory([]);
      }

      return company;
    } catch (err) {
      console.error('Lookup failed:', err);
      setExistingCompany(null);
      setDealHistory([]);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const clearLookup = useCallback(() => {
    setExistingCompany(null);
    setDealHistory([]);
  }, []);

  return {
    isLookingUp,
    existingCompany,
    dealHistory,
    lookupByDomain,
    clearLookup,
  };
}
