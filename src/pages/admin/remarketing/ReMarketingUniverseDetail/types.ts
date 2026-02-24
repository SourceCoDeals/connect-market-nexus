import {
  SizeCriteria,
  GeographyCriteria,
  ServiceCriteria,
  BuyerTypesCriteria,
  ScoringBehavior,
  DocumentReference,
  TargetBuyerTypeConfig
} from "@/types/remarketing";
import { UseMutationResult } from "@tanstack/react-query";

export interface UniverseFormData {
  name: string;
  description: string;
  fit_criteria: string;
  geography_weight: number;
  size_weight: number;
  service_weight: number;
  owner_goals_weight: number;
}

export interface UniverseFormState {
  formData: UniverseFormData;
  setFormData: React.Dispatch<React.SetStateAction<UniverseFormData>>;
  sizeCriteria: SizeCriteria;
  setSizeCriteria: React.Dispatch<React.SetStateAction<SizeCriteria>>;
  geographyCriteria: GeographyCriteria;
  setGeographyCriteria: React.Dispatch<React.SetStateAction<GeographyCriteria>>;
  serviceCriteria: ServiceCriteria;
  setServiceCriteria: React.Dispatch<React.SetStateAction<ServiceCriteria>>;
  buyerTypesCriteria: BuyerTypesCriteria;
  setBuyerTypesCriteria: React.Dispatch<React.SetStateAction<BuyerTypesCriteria>>;
  scoringBehavior: ScoringBehavior;
  setScoringBehavior: React.Dispatch<React.SetStateAction<ScoringBehavior>>;
  documents: DocumentReference[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentReference[]>>;
  maGuideContent: string;
  setMaGuideContent: React.Dispatch<React.SetStateAction<string>>;
  targetBuyerTypes: TargetBuyerTypeConfig[];
  setTargetBuyerTypes: React.Dispatch<React.SetStateAction<TargetBuyerTypeConfig[]>>;
}

export interface UniverseDialogState {
  buyerSearch: string;
  setBuyerSearch: React.Dispatch<React.SetStateAction<string>>;
  addDealDialogOpen: boolean;
  setAddDealDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addDealDefaultTab: 'existing' | 'new';
  setAddDealDefaultTab: React.Dispatch<React.SetStateAction<'existing' | 'new'>>;
  importDealsDialogOpen: boolean;
  setImportDealsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isScoringAllDeals: boolean;
  setIsScoringAllDeals: React.Dispatch<React.SetStateAction<boolean>>;
  showCriteriaEdit: boolean;
  setShowCriteriaEdit: React.Dispatch<React.SetStateAction<boolean>>;
  documentsOpen: boolean;
  setDocumentsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isParsing: boolean;
  setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
  importBuyersDialogOpen: boolean;
  setImportBuyersDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addBuyerDialogOpen: boolean;
  setAddBuyerDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showBuyerEnrichDialog: boolean;
  setShowBuyerEnrichDialog: React.Dispatch<React.SetStateAction<boolean>>;
  selectedBuyerIds: string[];
  setSelectedBuyerIds: React.Dispatch<React.SetStateAction<string[]>>;
  isRemovingSelected: boolean;
  setIsRemovingSelected: React.Dispatch<React.SetStateAction<boolean>>;
  editingHeader: boolean;
  setEditingHeader: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface BuyerRecord {
  id: string;
  company_name: string;
  company_website: string | null;
  platform_website: string | null;
  pe_firm_website: string | null;
  buyer_type: string | null;
  pe_firm_name: string | null;
  hq_city: string | null;
  hq_state: string | null;
  business_summary: string | null;
  thesis_summary: string | null;
  target_geographies: unknown;
  geographic_footprint: unknown;
  service_regions: unknown;
  operating_locations: unknown;
  alignment_score: number | null;
  alignment_reasoning: string | null;
  alignment_checked_at: string | null;
  has_fee_agreement: boolean | null;
}

export interface UniverseDeal {
  id: string;
  added_at: string;
  status: string;
  listing: {
    id: string;
    title: string;
    internal_company_name: string | null;
    description: string | null;
    location: string | null;
    revenue: number | null;
    ebitda: number | null;
    enriched_at: string | null;
    geographic_states: unknown;
    linkedin_employee_count: number | null;
    linkedin_employee_range: string | null;
    google_rating: number | null;
    google_review_count: number | null;
    deal_total_score: number | null;
    seller_interest_score: number | null;
  } | null;
}

export interface DealEngagementStats {
  [listingId: string]: {
    approved: number;
    interested: number;
    passed: number;
    avgScore: number;
    totalScore: number;
    count: number;
  };
}

export type SaveMutation = UseMutationResult<any, Error, void, unknown>;
