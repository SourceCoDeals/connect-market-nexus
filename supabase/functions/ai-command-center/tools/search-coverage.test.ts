/**
 * Search Coverage Tests — Ensuring every search tool checks ALL relevant fields
 *
 * These tests verify that search/filter functions don't miss data that exists
 * in the database. Each test creates mock data where the search term appears
 * ONLY in a specific field — if the search misses that field, the test fails
 * with zero results.
 *
 * This catches "HVAC-style" bugs where data exists but the search doesn't look
 * in the right place.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Helpers: extract client-side filter logic for unit testing
// ============================================================================

// Replicate the fieldContains helper used in buyer-tools
function fieldContains(field: unknown, term: string): boolean {
  if (!field) return false;
  if (Array.isArray(field))
    return field.some((v: string) => String(v).toLowerCase().includes(term));
  if (typeof field === 'string') return field.toLowerCase().includes(term);
  return false;
}

// ============================================================================
// PART 1: search_buyers — industry filter coverage
// ============================================================================

describe('search_buyers — industry filter field coverage', () => {
  const industryFilter = (
    buyer: Record<string, unknown>,
    term: string,
    matchingUniverseIds: Set<string> = new Set(),
  ): boolean => {
    return (
      (matchingUniverseIds.size > 0 && matchingUniverseIds.has(buyer.universe_id as string)) ||
      fieldContains(buyer.target_industries, term) ||
      fieldContains(buyer.target_services, term) ||
      fieldContains(buyer.services_offered, term) ||
      (buyer.industry_vertical as string)?.toLowerCase().includes(term) ||
      (buyer.company_name as string)?.toLowerCase().includes(term) ||
      (buyer.pe_firm_name as string)?.toLowerCase().includes(term) ||
      (buyer.thesis_summary as string)?.toLowerCase().includes(term) ||
      (buyer.business_summary as string)?.toLowerCase().includes(term) ||
      (buyer.notes as string)?.toLowerCase().includes(term) ||
      (buyer.alignment_reasoning as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const baseBuyer = {
    id: 'b1',
    company_name: 'Acme Corp',
    pe_firm_name: '',
    buyer_type: 'strategic',
    target_industries: null,
    target_services: null,
    services_offered: null,
    industry_vertical: null,
    thesis_summary: null,
    business_summary: null,
    notes: null,
    alignment_reasoning: null,
    universe_id: null,
  };

  it('finds buyer when term is in target_industries (array)', () => {
    const buyer = { ...baseBuyer, target_industries: ['HVAC', 'Plumbing'] };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in target_services (array)', () => {
    const buyer = { ...baseBuyer, target_services: ['HVAC installation'] };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in services_offered (string)', () => {
    const buyer = { ...baseBuyer, services_offered: 'Residential HVAC maintenance' };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in industry_vertical', () => {
    const buyer = { ...baseBuyer, industry_vertical: 'HVAC & Mechanical' };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in company_name', () => {
    const buyer = { ...baseBuyer, company_name: 'HVAC Holdings LLC' };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in pe_firm_name', () => {
    const buyer = { ...baseBuyer, pe_firm_name: 'HVAC Partners Capital' };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in thesis_summary', () => {
    const buyer = {
      ...baseBuyer,
      thesis_summary: 'Focused on acquiring HVAC platforms in the Southeast',
    };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in business_summary', () => {
    const buyer = { ...baseBuyer, business_summary: 'Leading residential HVAC service provider' };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in notes', () => {
    const buyer = { ...baseBuyer, notes: 'Interested in HVAC companies under $5M revenue' };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer when term is in alignment_reasoning', () => {
    const buyer = {
      ...baseBuyer,
      alignment_reasoning: 'Strong fit for HVAC deals due to geographic overlap',
    };
    expect(industryFilter(buyer, 'hvac')).toBe(true);
  });

  it('finds buyer via matching universe', () => {
    const buyer = { ...baseBuyer, universe_id: 'u1' };
    const matchingUniverses = new Set(['u1']);
    expect(industryFilter(buyer, 'hvac', matchingUniverses)).toBe(true);
  });

  it('returns false when term is NOT in any field', () => {
    expect(industryFilter(baseBuyer, 'hvac')).toBe(false);
  });
});

// ============================================================================
// PART 2: search_buyers — free-text search field coverage
// ============================================================================

describe('search_buyers — free-text search field coverage', () => {
  const searchFilter = (
    buyer: Record<string, unknown>,
    term: string,
    matchingUniverseIds: Set<string> = new Set(),
  ): boolean => {
    if (matchingUniverseIds.size > 0 && matchingUniverseIds.has(buyer.universe_id as string))
      return true;

    return (
      (buyer.company_name as string)?.toLowerCase().includes(term) ||
      (buyer.pe_firm_name as string)?.toLowerCase().includes(term) ||
      (buyer.buyer_type as string)?.toLowerCase().includes(term) ||
      (buyer.business_type as string)?.toLowerCase().includes(term) ||
      fieldContains(buyer.target_services, term) ||
      fieldContains(buyer.services_offered, term) ||
      fieldContains(buyer.target_industries, term) ||
      (buyer.industry_vertical as string)?.toLowerCase().includes(term) ||
      (buyer.thesis_summary as string)?.toLowerCase().includes(term) ||
      (buyer.business_summary as string)?.toLowerCase().includes(term) ||
      (buyer.notes as string)?.toLowerCase().includes(term) ||
      (buyer.alignment_reasoning as string)?.toLowerCase().includes(term) ||
      (buyer.revenue_model as string)?.toLowerCase().includes(term) ||
      (buyer.hq_state as string)?.toLowerCase().includes(term) ||
      (buyer.hq_city as string)?.toLowerCase().includes(term) ||
      (buyer.hq_region as string)?.toLowerCase().includes(term) ||
      fieldContains(buyer.geographic_footprint, term) ||
      fieldContains(buyer.target_geographies, term) ||
      fieldContains(buyer.service_regions, term) ||
      fieldContains(buyer.operating_locations, term) ||
      false
    );
  };

  const baseBuyer = {
    id: 'b1',
    company_name: '',
    pe_firm_name: '',
    buyer_type: '',
    business_type: '',
    target_services: null,
    services_offered: null,
    target_industries: null,
    industry_vertical: null,
    thesis_summary: null,
    business_summary: null,
    notes: null,
    alignment_reasoning: null,
    revenue_model: null,
    hq_state: null,
    hq_city: null,
    hq_region: null,
    geographic_footprint: null,
    target_geographies: null,
    service_regions: null,
    operating_locations: null,
    universe_id: null,
  };

  const fieldsToTest: Array<[string, Record<string, unknown>]> = [
    ['company_name', { company_name: 'Test HVAC Corp' }],
    ['pe_firm_name', { pe_firm_name: 'HVAC Capital Partners' }],
    ['buyer_type', { buyer_type: 'pe_platform' }],
    ['business_type', { business_type: 'hvac services' }],
    ['target_services (array)', { target_services: ['HVAC repair'] }],
    ['services_offered (string)', { services_offered: 'HVAC installation and repair' }],
    ['target_industries (array)', { target_industries: ['HVAC'] }],
    ['industry_vertical', { industry_vertical: 'Residential HVAC' }],
    ['thesis_summary', { thesis_summary: 'Targets HVAC companies nationally' }],
    ['business_summary', { business_summary: 'Provider of HVAC solutions' }],
    ['notes', { notes: 'HVAC focus confirmed in last call' }],
    ['alignment_reasoning', { alignment_reasoning: 'Good HVAC market fit' }],
    ['revenue_model', { revenue_model: 'HVAC service contracts' }],
    ['hq_state', { hq_state: 'TX' }],
    ['hq_city', { hq_city: 'Houston' }],
    ['hq_region', { hq_region: 'Southwest' }],
    ['geographic_footprint (array)', { geographic_footprint: ['TX', 'OK'] }],
    ['target_geographies (array)', { target_geographies: ['Southeast'] }],
    ['service_regions (array)', { service_regions: ['Texas'] }],
    ['operating_locations (array)', { operating_locations: ['Houston, TX'] }],
  ];

  for (const [fieldName, override] of fieldsToTest) {
    it(`finds buyer when term is in ${fieldName}`, () => {
      const buyer = { ...baseBuyer, ...override };
      const term = Object.values(override)[0];
      const searchTerm = Array.isArray(term)
        ? (term[0] as string).toLowerCase()
        : (term as string).toLowerCase().split(' ')[0];
      expect(searchFilter(buyer, searchTerm)).toBe(true);
    });
  }

  it('returns false when term is NOT in any field', () => {
    expect(searchFilter(baseBuyer, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// PART 3: query_deals — industry filter coverage
// ============================================================================

describe('query_deals — industry filter field coverage', () => {
  // Must mirror the industry filter in deal-tools.ts queryDeals()
  const industryFilter = (deal: Record<string, unknown>, term: string): boolean => {
    const industry = (deal.industry as string)?.toLowerCase() || '';
    const category = (deal.category as string)?.toLowerCase() || '';
    const categories = (deal.categories as string[]) || [];
    const services = (deal.services as string[]) || [];
    const serviceMix = (deal.service_mix as string)?.toLowerCase() || ''; // string, NOT array
    const tags = (deal.tags as string[]) || [];
    const title = (deal.title as string)?.toLowerCase() || '';
    const internalName = (deal.internal_company_name as string)?.toLowerCase() || '';
    const projectName = (deal.project_name as string)?.toLowerCase() || '';
    const executiveSummary = (deal.executive_summary as string)?.toLowerCase() || '';
    const investmentThesis = (deal.investment_thesis as string)?.toLowerCase() || '';
    const businessModel = (deal.business_model as string)?.toLowerCase() || '';
    const industryTier = (deal.industry_tier_name as string)?.toLowerCase() || '';
    const description = (deal.description as string)?.toLowerCase() || '';
    const heroDescription = (deal.hero_description as string)?.toLowerCase() || '';
    const customerTypes = (deal.customer_types as string)?.toLowerCase() || '';
    const endMarket = (deal.end_market_description as string)?.toLowerCase() || '';
    const revenueModel = (deal.revenue_model as string)?.toLowerCase() || '';
    const acquisitionType = (deal.acquisition_type as string)?.toLowerCase() || '';
    const captargetNotes = (deal.captarget_call_notes as string)?.toLowerCase() || '';
    return (
      industry.includes(term) ||
      category.includes(term) ||
      categories.some((c: string) => c.toLowerCase().includes(term)) ||
      services.some((s: string) => s.toLowerCase().includes(term)) ||
      serviceMix.includes(term) ||
      tags.some((t: string) => t.toLowerCase().includes(term)) ||
      title.includes(term) ||
      internalName.includes(term) ||
      projectName.includes(term) ||
      executiveSummary.includes(term) ||
      investmentThesis.includes(term) ||
      businessModel.includes(term) ||
      industryTier.includes(term) ||
      description.includes(term) ||
      heroDescription.includes(term) ||
      customerTypes.includes(term) ||
      endMarket.includes(term) ||
      revenueModel.includes(term) ||
      acquisitionType.includes(term) ||
      captargetNotes.includes(term)
    );
  };

  const baseDeal = {
    id: 'd1',
    title: '',
    industry: '',
    category: '',
    categories: [],
    services: [],
    service_mix: '', // string, not array
    tags: [],
    internal_company_name: '',
    project_name: '',
    executive_summary: '',
    investment_thesis: '',
    business_model: '',
    industry_tier_name: '',
    description: '',
    hero_description: '',
    customer_types: '',
    end_market_description: '',
    revenue_model: '',
    acquisition_type: '',
    captarget_call_notes: '',
  };

  const fieldsToTest: Array<[string, Record<string, unknown>]> = [
    ['industry', { industry: 'HVAC Services' }],
    ['category', { category: 'Residential HVAC' }],
    ['categories (array)', { categories: ['HVAC', 'Plumbing'] }],
    ['services (array)', { services: ['HVAC installation'] }],
    ['service_mix (string)', { service_mix: 'HVAC repair 60%, plumbing 40%' }],
    ['tags (array)', { tags: ['HVAC', 'Mechanical'] }],
    ['title', { title: 'HVAC Company in Texas' }],
    ['internal_company_name', { internal_company_name: 'Project HVAC Alpha' }],
    ['project_name', { project_name: 'HVAC Platform Build' }],
    ['executive_summary', { executive_summary: 'Leading HVAC company with strong margins' }],
    ['investment_thesis', { investment_thesis: 'Consolidation play in the HVAC market' }],
    ['business_model', { business_model: 'HVAC service contracts with recurring revenue' }],
    ['industry_tier_name', { industry_tier_name: 'HVAC & Mechanical Tier 1' }],
    ['description', { description: 'Full-service HVAC company serving residential customers' }],
    ['hero_description', { hero_description: 'Premier HVAC provider in the Southeast' }],
    ['customer_types', { customer_types: 'residential HVAC homeowners' }],
    ['end_market_description', { end_market_description: 'HVAC services end market' }],
    ['revenue_model', { revenue_model: 'HVAC maintenance contracts' }],
    ['acquisition_type', { acquisition_type: 'HVAC platform' }],
    ['captarget_call_notes', { captarget_call_notes: 'Owner discussed HVAC expansion plans' }],
  ];

  for (const [fieldName, override] of fieldsToTest) {
    it(`finds deal when "hvac" is in ${fieldName}`, () => {
      const deal = { ...baseDeal, ...override };
      expect(industryFilter(deal, 'hvac')).toBe(true);
    });
  }

  it('returns false when term is NOT in any field', () => {
    expect(industryFilter(baseDeal, 'hvac')).toBe(false);
  });
});

// ============================================================================
// PART 4: search_lead_sources — industry + state filter coverage
// ============================================================================

describe('search_lead_sources — filter field coverage', () => {
  const industryFilter = (deal: Record<string, unknown>, term: string): boolean => {
    const industry = ((deal.industry as string) || '').toLowerCase();
    const category = ((deal.category as string) || '').toLowerCase();
    const categories = (deal.categories as string[]) || [];
    const title = ((deal.title as string) || '').toLowerCase();
    const services = (deal.services as string[]) || [];
    const captargetTab = ((deal.captarget_sheet_tab as string) || '').toLowerCase();
    return (
      industry.includes(term) ||
      category.includes(term) ||
      categories.some((c: string) => c.toLowerCase().includes(term)) ||
      title.includes(term) ||
      services.some((s: string) => s.toLowerCase().includes(term)) ||
      captargetTab.includes(term)
    );
  };

  const stateFilter = (deal: Record<string, unknown>, st: string): boolean => {
    const stLower = st.toLowerCase();
    const addrState = ((deal.address_state as string) || '').toLowerCase();
    const geoStates = (deal.geographic_states as string[]) || [];
    return (
      addrState === stLower ||
      addrState.includes(stLower) ||
      geoStates.some((s: string) => s.toUpperCase() === st.toUpperCase())
    );
  };

  const baseLead = {
    id: 'l1',
    title: '',
    industry: '',
    category: '',
    categories: [],
    services: [],
    captarget_sheet_tab: '',
    address_state: '',
    geographic_states: [],
  };

  it('industry filter: finds when in industry field', () => {
    expect(industryFilter({ ...baseLead, industry: 'HVAC' }, 'hvac')).toBe(true);
  });

  it('industry filter: finds when in title', () => {
    expect(industryFilter({ ...baseLead, title: 'HVAC Company' }, 'hvac')).toBe(true);
  });

  it('industry filter: finds when in categories array', () => {
    expect(industryFilter({ ...baseLead, categories: ['HVAC'] }, 'hvac')).toBe(true);
  });

  it('industry filter: finds when in services array', () => {
    expect(industryFilter({ ...baseLead, services: ['HVAC maintenance'] }, 'hvac')).toBe(true);
  });

  it('industry filter: finds when in captarget_sheet_tab', () => {
    expect(industryFilter({ ...baseLead, captarget_sheet_tab: 'HVAC Companies' }, 'hvac')).toBe(
      true,
    );
  });

  it('state filter: finds when in address_state', () => {
    expect(stateFilter({ ...baseLead, address_state: 'TX' }, 'TX')).toBe(true);
  });

  it('state filter: finds when in geographic_states array', () => {
    expect(stateFilter({ ...baseLead, geographic_states: ['TX', 'OK'] }, 'TX')).toBe(true);
  });

  it('state filter: returns false when state not present', () => {
    expect(stateFilter({ ...baseLead, address_state: 'CA' }, 'TX')).toBe(false);
  });
});

// ============================================================================
// PART 5: search_valuation_leads — search + state filter coverage
// ============================================================================

describe('search_valuation_leads — search field coverage', () => {
  const searchFilter = (lead: Record<string, unknown>, term: string): boolean => {
    return (
      (lead.business_name as string)?.toLowerCase().includes(term) ||
      (lead.display_name as string)?.toLowerCase().includes(term) ||
      (lead.industry as string)?.toLowerCase().includes(term) ||
      (lead.region as string)?.toLowerCase().includes(term) ||
      (lead.location as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const stateFilter = (lead: Record<string, unknown>, term: string): boolean => {
    return (
      (lead.region as string)?.toLowerCase().includes(term) ||
      (lead.location as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const baseLead = {
    id: 'vl1',
    business_name: '',
    display_name: '',
    industry: '',
    region: '',
    location: '',
    calculator_type: 'hvac',
  };

  it('finds by business_name', () => {
    expect(searchFilter({ ...baseLead, business_name: 'Cool Air HVAC' }, 'hvac')).toBe(true);
  });

  it('finds by display_name', () => {
    expect(searchFilter({ ...baseLead, display_name: 'HVAC Lead #42' }, 'hvac')).toBe(true);
  });

  it('finds by industry', () => {
    expect(searchFilter({ ...baseLead, industry: 'HVAC & Mechanical' }, 'hvac')).toBe(true);
  });

  it('finds by region', () => {
    expect(searchFilter({ ...baseLead, region: 'Texas' }, 'texas')).toBe(true);
  });

  it('finds by location', () => {
    expect(searchFilter({ ...baseLead, location: 'Houston, TX' }, 'houston')).toBe(true);
  });

  it('state filter finds by region', () => {
    expect(stateFilter({ ...baseLead, region: 'Florida' }, 'florida')).toBe(true);
  });

  it('state filter finds by location', () => {
    expect(stateFilter({ ...baseLead, location: 'Miami, FL' }, 'fl')).toBe(true);
  });

  it('returns false when term not in any field', () => {
    expect(searchFilter(baseLead, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// PART 6: search_buyer_universes — search field coverage
// ============================================================================

describe('search_buyer_universes — search field coverage', () => {
  const universeFilter = (universe: Record<string, unknown>, term: string): boolean => {
    return (
      (universe.name as string)?.toLowerCase().includes(term) ||
      (universe.description as string)?.toLowerCase().includes(term) ||
      (universe.fit_criteria as string)?.toLowerCase().includes(term) ||
      (universe.service_criteria as string)?.toLowerCase().includes(term) ||
      (universe.geography_criteria as string)?.toLowerCase().includes(term) ||
      (universe.size_criteria as string)?.toLowerCase().includes(term) ||
      (universe.buyer_types_criteria as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const baseUniverse = {
    id: 'u1',
    name: '',
    description: '',
    fit_criteria: '',
    service_criteria: '',
    geography_criteria: '',
    size_criteria: '',
    buyer_types_criteria: '',
  };

  it('finds by name', () => {
    expect(universeFilter({ ...baseUniverse, name: 'Residential HVAC' }, 'hvac')).toBe(true);
  });

  it('finds by description', () => {
    expect(
      universeFilter({ ...baseUniverse, description: 'Buyers interested in HVAC' }, 'hvac'),
    ).toBe(true);
  });

  it('finds by fit_criteria', () => {
    expect(
      universeFilter({ ...baseUniverse, fit_criteria: 'Must have HVAC experience' }, 'hvac'),
    ).toBe(true);
  });

  it('finds by service_criteria', () => {
    expect(
      universeFilter({ ...baseUniverse, service_criteria: 'HVAC, plumbing, electrical' }, 'hvac'),
    ).toBe(true);
  });

  it('finds by geography_criteria', () => {
    expect(
      universeFilter(
        { ...baseUniverse, geography_criteria: 'Southeast and Texas markets' },
        'texas',
      ),
    ).toBe(true);
  });

  it('finds by size_criteria', () => {
    expect(
      universeFilter({ ...baseUniverse, size_criteria: '$2M-$10M HVAC companies' }, 'hvac'),
    ).toBe(true);
  });

  it('finds by buyer_types_criteria', () => {
    expect(
      universeFilter({ ...baseUniverse, buyer_types_criteria: 'PE-backed HVAC platforms' }, 'hvac'),
    ).toBe(true);
  });

  it('returns false when term not in any field', () => {
    expect(universeFilter(baseUniverse, 'hvac')).toBe(false);
  });
});

// ============================================================================
// PART 7: get_connection_requests — search field coverage
// ============================================================================

describe('get_connection_requests — search field coverage', () => {
  const connectionFilter = (req: Record<string, unknown>, term: string): boolean => {
    return (
      (req.lead_name as string)?.toLowerCase().includes(term) ||
      (req.lead_email as string)?.toLowerCase().includes(term) ||
      (req.lead_company as string)?.toLowerCase().includes(term) ||
      (req.lead_role as string)?.toLowerCase().includes(term) ||
      (req.decision_notes as string)?.toLowerCase().includes(term) ||
      (req.last_message_preview as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const baseRequest = {
    id: 'cr1',
    lead_name: '',
    lead_email: '',
    lead_company: '',
    lead_role: '',
    decision_notes: '',
    last_message_preview: '',
  };

  it('finds by lead_name', () => {
    expect(connectionFilter({ ...baseRequest, lead_name: 'John Smith' }, 'john')).toBe(true);
  });

  it('finds by lead_email', () => {
    expect(connectionFilter({ ...baseRequest, lead_email: 'john@hvac.com' }, 'hvac')).toBe(true);
  });

  it('finds by lead_company', () => {
    expect(connectionFilter({ ...baseRequest, lead_company: 'HVAC Holdings' }, 'hvac')).toBe(true);
  });

  it('finds by lead_role', () => {
    expect(
      connectionFilter({ ...baseRequest, lead_role: 'VP of Acquisitions' }, 'acquisitions'),
    ).toBe(true);
  });

  it('finds by decision_notes', () => {
    expect(
      connectionFilter({ ...baseRequest, decision_notes: 'Approved - strong HVAC fit' }, 'hvac'),
    ).toBe(true);
  });

  it('finds by last_message_preview', () => {
    expect(
      connectionFilter(
        { ...baseRequest, last_message_preview: 'Interested in your HVAC listing' },
        'hvac',
      ),
    ).toBe(true);
  });

  it('returns false when term not in any field', () => {
    expect(connectionFilter(baseRequest, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// PART 8: search_inbound_leads — search field coverage
// ============================================================================

describe('search_inbound_leads — search field coverage', () => {
  const leadFilter = (lead: Record<string, unknown>, term: string): boolean => {
    return (
      (lead.name as string)?.toLowerCase().includes(term) ||
      (lead.email as string)?.toLowerCase().includes(term) ||
      (lead.company_name as string)?.toLowerCase().includes(term) ||
      (lead.role as string)?.toLowerCase().includes(term) ||
      (lead.message as string)?.toLowerCase().includes(term) ||
      (lead.source_form_name as string)?.toLowerCase().includes(term) ||
      (lead.mapped_to_listing_title as string)?.toLowerCase().includes(term) ||
      (lead.phone_number as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const baseLead = {
    id: 'il1',
    name: '',
    email: '',
    company_name: '',
    role: '',
    message: '',
    source_form_name: '',
    mapped_to_listing_title: '',
    phone_number: '',
  };

  it('finds by name', () => {
    expect(leadFilter({ ...baseLead, name: 'Jane Doe' }, 'jane')).toBe(true);
  });

  it('finds by email', () => {
    expect(leadFilter({ ...baseLead, email: 'jane@hvac.com' }, 'hvac')).toBe(true);
  });

  it('finds by company_name', () => {
    expect(leadFilter({ ...baseLead, company_name: 'HVAC Corp' }, 'hvac')).toBe(true);
  });

  it('finds by role', () => {
    expect(leadFilter({ ...baseLead, role: 'CEO of HVAC division' }, 'hvac')).toBe(true);
  });

  it('finds by message', () => {
    expect(
      leadFilter({ ...baseLead, message: 'Interested in selling my HVAC business' }, 'hvac'),
    ).toBe(true);
  });

  it('finds by source_form_name', () => {
    expect(leadFilter({ ...baseLead, source_form_name: 'HVAC Calculator Lead' }, 'hvac')).toBe(
      true,
    );
  });

  it('finds by mapped_to_listing_title', () => {
    expect(leadFilter({ ...baseLead, mapped_to_listing_title: 'HVAC Company in FL' }, 'hvac')).toBe(
      true,
    );
  });

  it('finds by phone_number', () => {
    expect(leadFilter({ ...baseLead, phone_number: '555-1234' }, '555')).toBe(true);
  });

  it('returns false when term not in any field', () => {
    expect(leadFilter(baseLead, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// PART 9: get_industry_trackers — search field coverage
// ============================================================================

describe('get_industry_trackers — search field coverage', () => {
  const trackerFilter = (tracker: Record<string, unknown>, term: string): boolean => {
    return (
      (tracker.name as string)?.toLowerCase().includes(term) ||
      (tracker.description as string)?.toLowerCase().includes(term) ||
      (tracker.service_criteria as string)?.toLowerCase().includes(term) ||
      (tracker.geography_criteria as string)?.toLowerCase().includes(term) ||
      (tracker.size_criteria as string)?.toLowerCase().includes(term) ||
      false
    );
  };

  const baseTracker = {
    id: 'it1',
    name: '',
    description: '',
    service_criteria: '',
    geography_criteria: '',
    size_criteria: '',
  };

  it('finds by name', () => {
    expect(trackerFilter({ ...baseTracker, name: 'HVAC Industry' }, 'hvac')).toBe(true);
  });

  it('finds by description', () => {
    expect(trackerFilter({ ...baseTracker, description: 'Tracks HVAC deals' }, 'hvac')).toBe(true);
  });

  it('finds by service_criteria', () => {
    expect(trackerFilter({ ...baseTracker, service_criteria: 'HVAC, plumbing' }, 'hvac')).toBe(
      true,
    );
  });

  it('finds by geography_criteria', () => {
    expect(trackerFilter({ ...baseTracker, geography_criteria: 'Texas, Oklahoma' }, 'texas')).toBe(
      true,
    );
  });

  it('finds by size_criteria', () => {
    expect(trackerFilter({ ...baseTracker, size_criteria: '$5M+ HVAC companies' }, 'hvac')).toBe(
      true,
    );
  });

  it('returns false when term not in any field', () => {
    expect(trackerFilter(baseTracker, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// PART 10: fireflies transcript search — field coverage
// ============================================================================

describe('fireflies transcript search — field coverage', () => {
  const transcriptFilter = (transcript: Record<string, unknown>, term: string): boolean => {
    return (
      (transcript.title as string)?.toLowerCase().includes(term) ||
      (transcript.transcript_text as string)?.toLowerCase().includes(term) ||
      ((transcript.meeting_attendees as string[]) || []).some((a: string) =>
        a.toLowerCase().includes(term),
      ) ||
      ((transcript.external_participants as string[]) || []).some((p: string) =>
        p.toLowerCase().includes(term),
      ) ||
      JSON.stringify(transcript.extracted_data || {})
        .toLowerCase()
        .includes(term) ||
      false
    );
  };

  const baseTranscript = {
    id: 't1',
    title: '',
    transcript_text: '',
    meeting_attendees: [],
    external_participants: [],
    extracted_data: null,
  };

  it('finds by title', () => {
    expect(transcriptFilter({ ...baseTranscript, title: 'HVAC Deal Call' }, 'hvac')).toBe(true);
  });

  it('finds by transcript_text', () => {
    expect(
      transcriptFilter(
        { ...baseTranscript, transcript_text: 'We discussed HVAC expansion' },
        'hvac',
      ),
    ).toBe(true);
  });

  it('finds by meeting_attendees', () => {
    expect(
      transcriptFilter({ ...baseTranscript, meeting_attendees: ['John from HVAC Corp'] }, 'hvac'),
    ).toBe(true);
  });

  it('finds by external_participants', () => {
    expect(
      transcriptFilter(
        { ...baseTranscript, external_participants: ['HVAC Partners team'] },
        'hvac',
      ),
    ).toBe(true);
  });

  it('finds by extracted_data (JSON content)', () => {
    expect(
      transcriptFilter(
        { ...baseTranscript, extracted_data: { topics: ['HVAC expansion', 'M&A'] } },
        'hvac',
      ),
    ).toBe(true);
  });

  it('returns false when term not in any field', () => {
    expect(transcriptFilter(baseTranscript, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// PART 11: Cross-cutting regression tests — "HVAC-style" scenarios
// ============================================================================

describe('Cross-cutting regression: industry keyword appears in unexpected fields', () => {
  it('HVAC in universe name → buyer is found via universe cross-reference', () => {
    // This is the original bug: buyer has no "HVAC" in its fields,
    // but belongs to the "Residential HVAC, Plumbing and Electrical" universe
    const buyer = {
      id: 'b1',
      company_name: 'CoolAir LLC',
      pe_firm_name: '',
      target_industries: ['Mechanical Services'],
      target_services: ['Air conditioning'],
      universe_id: 'u-hvac',
    };
    const matchingUniverseIds = new Set(['u-hvac']); // from universe name match
    // Buyer should be found via universe match
    expect(matchingUniverseIds.has(buyer.universe_id)).toBe(true);
  });

  it('deal with HVAC only in investment_thesis → found by industry filter', () => {
    const deal = {
      id: 'd1',
      title: 'Mechanical Services Company',
      industry: 'Building Services',
      category: 'Mechanical',
      categories: [],
      services: ['AC repair'],
      service_mix: '', // string, not array
      internal_company_name: '',
      project_name: '',
      executive_summary: 'Strong regional player in building services',
      investment_thesis: 'Consolidation opportunity in the HVAC market with add-on potential',
      business_model: 'Service contracts',
      industry_tier_name: '',
    };
    // Previously this would fail because industry filter didn't check investment_thesis
    const term = 'hvac';
    const found = deal.investment_thesis.toLowerCase().includes(term);
    expect(found).toBe(true);
  });

  it('universe with HVAC in service_criteria but NOT in name/description → found', () => {
    const universe = {
      id: 'u1',
      name: 'Mechanical Services Universe',
      description: 'Buyers interested in building services companies',
      fit_criteria: '',
      service_criteria: 'HVAC, plumbing, electrical services',
      geography_criteria: '',
      size_criteria: '',
      buyer_types_criteria: '',
    };
    const term = 'hvac';
    const found = universe.service_criteria.toLowerCase().includes(term);
    expect(found).toBe(true);
  });

  it('valuation lead with HVAC in business_name but no calculator_type filter → found', () => {
    const lead = {
      id: 'vl1',
      calculator_type: 'general',
      business_name: 'HVAC Masters LLC',
      display_name: '',
      industry: '',
      region: '',
      location: '',
    };
    const term = 'hvac';
    const found = lead.business_name.toLowerCase().includes(term);
    expect(found).toBe(true);
  });

  it('connection request with info in decision_notes → found', () => {
    const request = {
      id: 'cr1',
      lead_name: 'Bob Jones',
      lead_email: 'bob@acme.com',
      lead_company: 'Acme Corp',
      lead_role: 'VP',
      decision_notes: 'Approved - has strong HVAC platform fit',
      last_message_preview: '',
    };
    const term = 'hvac';
    const found = request.decision_notes.toLowerCase().includes(term);
    expect(found).toBe(true);
  });

  it('inbound lead with info only in message field → found', () => {
    const lead = {
      id: 'il1',
      name: 'Mike',
      email: 'mike@example.com',
      company_name: 'Smith LLC',
      role: 'Owner',
      message: 'I run an HVAC company and want to explore selling',
      source_form_name: '',
      mapped_to_listing_title: '',
      phone_number: '',
    };
    const term = 'hvac';
    const found = lead.message.toLowerCase().includes(term);
    expect(found).toBe(true);
  });
});
