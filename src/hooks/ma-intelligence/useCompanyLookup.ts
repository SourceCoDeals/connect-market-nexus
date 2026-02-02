import { useState, useCallback } from 'react';

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
    // Companies table not in current schema - stub implementation
    console.warn('[useCompanyLookup] companies table not available - stub implementation');
    setExistingCompany(null);
    setDealHistory([]);
    return null;
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
