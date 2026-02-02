import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PEFirm {
  id: string;
  user_id: string;
  domain: string;
  name: string;
  website: string | null;
  linkedin: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  hq_region: string | null;
  num_platforms: number | null;
  portfolio_companies: string[] | null;
  has_fee_agreement: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Platform {
  id: string;
  pe_firm_id: string;
  domain: string;
  name: string;
  website: string | null;
  linkedin: string | null;
  industry_vertical: string | null;
  business_summary: string | null;
  thesis_summary: string | null;
  thesis_confidence: string | null;
  // Size criteria
  min_revenue: number | null;
  max_revenue: number | null;
  revenue_sweet_spot: number | null;
  min_ebitda: number | null;
  max_ebitda: number | null;
  ebitda_sweet_spot: number | null;
  // Fee agreement
  has_fee_agreement: boolean | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  data_last_updated: string;
}

export interface TrackerBuyer {
  id: string;
  tracker_id: string;
  pe_firm_id: string;
  platform_id: string | null;
  fee_agreement_status: string | null;
  added_at: string;
}

export interface PEFirmWithPlatforms extends PEFirm {
  platforms: Platform[];
  trackerIds: string[];
}

export function usePEFirmsHierarchy() {
  const [peFirms, setPeFirms] = useState<PEFirmWithPlatforms[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch PE firms
      const { data: peFirmsData, error: peFirmsError } = await supabase
        .from("pe_firms")
        .select("*")
        .order("name");

      if (peFirmsError) throw peFirmsError;

      if (!peFirmsData || peFirmsData.length === 0) {
        setPeFirms([]);
        setIsLoading(false);
        return;
      }

      // Fetch platforms
      const { data: platformsData, error: platformsError } = await supabase
        .from("platforms")
        .select("*")
        .order("name");

      if (platformsError) throw platformsError;

      // Fetch tracker_buyers to know which trackers each PE firm/platform is in
      const { data: trackerBuyersData, error: trackerBuyersError } = await supabase
        .from("tracker_buyers")
        .select("*");

      if (trackerBuyersError) throw trackerBuyersError;

      // Build the hierarchy
      const peFirmMap = new Map<string, PEFirmWithPlatforms>();

      for (const peFirm of peFirmsData) {
        peFirmMap.set(peFirm.id, {
          ...peFirm,
          platforms: [],
          trackerIds: [],
        });
      }

      // Add platforms to their PE firms
      for (const platform of platformsData || []) {
        const peFirm = peFirmMap.get(platform.pe_firm_id);
        if (peFirm) {
          peFirm.platforms.push(platform);
        }
      }

      // Add tracker IDs
      for (const tb of trackerBuyersData || []) {
        const peFirm = peFirmMap.get(tb.pe_firm_id);
        if (peFirm && !peFirm.trackerIds.includes(tb.tracker_id)) {
          peFirm.trackerIds.push(tb.tracker_id);
        }
      }

      setPeFirms(Array.from(peFirmMap.values()));
    } catch (err: any) {
      console.error("Error loading PE firms hierarchy:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { peFirms, isLoading, error, refetch: loadData };
}

export function usePlatformDetail(platformId: string | undefined) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [peFirm, setPeFirm] = useState<PEFirm | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!platformId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      const { data: platformData, error: platformError } = await supabase
        .from("platforms")
        .select("*")
        .eq("id", platformId)
        .single();

      if (platformError) {
        console.error("Error loading platform:", platformError);
        setIsLoading(false);
        return;
      }

      setPlatform(platformData);

      // Load PE firm
      const { data: peFirmData } = await supabase
        .from("pe_firms")
        .select("*")
        .eq("id", platformData.pe_firm_id)
        .single();

      setPeFirm(peFirmData);
      setIsLoading(false);
    };

    loadData();
  }, [platformId]);

  return { platform, peFirm, isLoading };
}
