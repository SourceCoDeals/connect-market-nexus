/**
 * Pre-built Industry Templates for KPI Scoring Configuration
 *
 * These templates provide starter configurations for common industries.
 * Users can start with a template and customize, or build from scratch.
 */

export interface KPIRule {
  field_name: string;
  display_name: string;
  weight: number;
  scoring_rules: {
    ideal_range?: [number, number];
    bonus_per_item?: number;
    max_bonus?: number;
    penalty_below?: number;
    penalty_above?: number;
    boolean?: boolean;
  };
  description?: string;
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  primary_focus: string[];
  excluded_services: string[];
  kpis: KPIRule[];
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  collision_repair: {
    id: 'collision_repair',
    name: 'Collision Repair',
    description: 'Auto body shops, collision centers, paint & refinish',
    primary_focus: [
      'collision repair',
      'auto body',
      'body shop',
      'paint',
      'refinish',
      'adas',
      'calibration',
      'frame repair'
    ],
    excluded_services: [
      'towing',
      'tow truck',
      'wrecker',
      'flatbed',
      'mechanical repair only',
      'oil change only'
    ],
    kpis: [
      {
        field_name: 'drp_mix_pct',
        display_name: 'DRP Mix %',
        weight: 10,
        scoring_rules: { ideal_range: [40, 80], penalty_below: 5, penalty_above: 3 },
        description: 'Percentage of revenue from Direct Repair Program insurance work'
      },
      {
        field_name: 'oem_certifications',
        display_name: 'OEM Certifications',
        weight: 8,
        scoring_rules: { bonus_per_item: 3, max_bonus: 12 },
        description: 'Number of OEM manufacturer certifications'
      },
      {
        field_name: 'adas_capable',
        display_name: 'ADAS Capable',
        weight: 6,
        scoring_rules: { boolean: true },
        description: 'Has ADAS calibration equipment and capability'
      },
      {
        field_name: 'cycle_time_days',
        display_name: 'Cycle Time (days)',
        weight: 5,
        scoring_rules: { ideal_range: [3, 7], penalty_above: 3 },
        description: 'Average days to complete a repair'
      },
      {
        field_name: 'csi_score',
        display_name: 'CSI Score',
        weight: 5,
        scoring_rules: { ideal_range: [85, 100], penalty_below: 3 },
        description: 'Customer satisfaction index score'
      },
      {
        field_name: 'sqft_per_location',
        display_name: 'Sq Ft per Location',
        weight: 4,
        scoring_rules: { ideal_range: [8000, 25000], penalty_below: 2 },
        description: 'Square footage per shop location'
      }
    ]
  },

  roofing: {
    id: 'roofing',
    name: 'Roofing',
    description: 'Residential & commercial roofing contractors',
    primary_focus: [
      'roofing',
      'roof replacement',
      'roof repair',
      'roof inspection',
      're-roofing',
      'shingle',
      'flat roof',
      'metal roof'
    ],
    excluded_services: [
      'gutters only',
      'solar only',
      'siding only',
      'general contractor'
    ],
    kpis: [
      {
        field_name: 'storm_revenue_pct',
        display_name: 'Storm vs Retail Mix %',
        weight: 10,
        scoring_rules: { ideal_range: [20, 70], penalty_below: 3, penalty_above: 5 },
        description: 'Percentage of revenue from storm/insurance work vs retail'
      },
      {
        field_name: 'manufacturer_certs',
        display_name: 'Manufacturer Certifications',
        weight: 6,
        scoring_rules: { bonus_per_item: 2, max_bonus: 10 },
        description: 'GAF, Owens Corning, CertainTeed certifications'
      },
      {
        field_name: 'crew_count',
        display_name: 'Crew Count',
        weight: 5,
        scoring_rules: { ideal_range: [5, 20], penalty_below: 2 },
        description: 'Number of roofing crews'
      },
      {
        field_name: 'average_job_size',
        display_name: 'Avg Job Size ($)',
        weight: 5,
        scoring_rules: { ideal_range: [8000, 25000] },
        description: 'Average revenue per roofing job'
      },
      {
        field_name: 'commercial_pct',
        display_name: 'Commercial Mix %',
        weight: 4,
        scoring_rules: { ideal_range: [20, 60] },
        description: 'Percentage of revenue from commercial vs residential'
      },
      {
        field_name: 'warranty_claims_rate',
        display_name: 'Warranty Claims Rate %',
        weight: 4,
        scoring_rules: { ideal_range: [0, 2], penalty_above: 5 },
        description: 'Percentage of jobs with warranty claims'
      }
    ]
  },

  hvac: {
    id: 'hvac',
    name: 'HVAC',
    description: 'Heating, ventilation, and air conditioning services',
    primary_focus: [
      'hvac',
      'heating',
      'cooling',
      'air conditioning',
      'furnace',
      'heat pump',
      'ductwork',
      'ventilation'
    ],
    excluded_services: [
      'plumbing only',
      'electrical only',
      'refrigeration only'
    ],
    kpis: [
      {
        field_name: 'service_agreement_pct',
        display_name: 'Service Agreement %',
        weight: 10,
        scoring_rules: { ideal_range: [30, 60], penalty_below: 5 },
        description: 'Percentage of customers on maintenance agreements'
      },
      {
        field_name: 'residential_commercial_mix',
        display_name: 'Residential Mix %',
        weight: 6,
        scoring_rules: { ideal_range: [40, 80] },
        description: 'Percentage residential vs commercial'
      },
      {
        field_name: 'tech_count',
        display_name: 'Technician Count',
        weight: 5,
        scoring_rules: { ideal_range: [5, 30] },
        description: 'Number of field technicians'
      },
      {
        field_name: 'avg_ticket_size',
        display_name: 'Avg Ticket Size ($)',
        weight: 5,
        scoring_rules: { ideal_range: [500, 2000] },
        description: 'Average revenue per service call'
      },
      {
        field_name: 'nate_certified_pct',
        display_name: 'NATE Certified %',
        weight: 4,
        scoring_rules: { ideal_range: [50, 100], penalty_below: 3 },
        description: 'Percentage of technicians NATE certified'
      }
    ]
  },

  plumbing: {
    id: 'plumbing',
    name: 'Plumbing',
    description: 'Residential & commercial plumbing services',
    primary_focus: [
      'plumbing',
      'plumber',
      'pipe',
      'drain',
      'water heater',
      'sewer',
      'fixture',
      'leak repair'
    ],
    excluded_services: [
      'hvac only',
      'electrical only',
      'septic only'
    ],
    kpis: [
      {
        field_name: 'recurring_revenue_pct',
        display_name: 'Recurring Revenue %',
        weight: 10,
        scoring_rules: { ideal_range: [20, 50], penalty_below: 3 },
        description: 'Revenue from maintenance agreements and recurring services'
      },
      {
        field_name: 'emergency_service',
        display_name: '24/7 Emergency Service',
        weight: 6,
        scoring_rules: { boolean: true },
        description: 'Offers 24/7 emergency plumbing service'
      },
      {
        field_name: 'truck_count',
        display_name: 'Service Trucks',
        weight: 5,
        scoring_rules: { ideal_range: [5, 25] },
        description: 'Number of service vehicles'
      },
      {
        field_name: 'commercial_pct',
        display_name: 'Commercial Mix %',
        weight: 5,
        scoring_rules: { ideal_range: [20, 60] },
        description: 'Percentage of commercial vs residential revenue'
      }
    ]
  },

  landscaping: {
    id: 'landscaping',
    name: 'Landscaping & Lawn Care',
    description: 'Commercial and residential landscaping services',
    primary_focus: [
      'landscaping',
      'lawn care',
      'lawn maintenance',
      'mowing',
      'hardscape',
      'irrigation',
      'tree service',
      'snow removal'
    ],
    excluded_services: [
      'pest control only',
      'pool service only'
    ],
    kpis: [
      {
        field_name: 'contract_revenue_pct',
        display_name: 'Contract Revenue %',
        weight: 12,
        scoring_rules: { ideal_range: [60, 90], penalty_below: 5 },
        description: 'Revenue from recurring maintenance contracts'
      },
      {
        field_name: 'commercial_pct',
        display_name: 'Commercial Mix %',
        weight: 8,
        scoring_rules: { ideal_range: [50, 90], penalty_below: 3 },
        description: 'Commercial vs residential revenue mix'
      },
      {
        field_name: 'crew_count',
        display_name: 'Crew Count',
        weight: 5,
        scoring_rules: { ideal_range: [5, 30] },
        description: 'Number of field crews'
      },
      {
        field_name: 'snow_revenue_pct',
        display_name: 'Snow Removal %',
        weight: 4,
        scoring_rules: { ideal_range: [10, 40] },
        description: 'Revenue from snow/ice management services'
      }
    ]
  }
};

/**
 * Get a template by ID
 */
export function getIndustryTemplate(templateId: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[templateId] || null;
}

/**
 * Get all available templates
 */
export function getAllTemplates(): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES);
}

/**
 * Match industry name to a template
 */
export function matchIndustryToTemplate(industryName: string): IndustryTemplate | null {
  const lower = industryName.toLowerCase();

  // Direct matches
  if (lower.includes('collision') || lower.includes('auto body') || lower.includes('body shop')) {
    return INDUSTRY_TEMPLATES.collision_repair;
  }
  if (lower.includes('roof')) {
    return INDUSTRY_TEMPLATES.roofing;
  }
  if (lower.includes('hvac') || lower.includes('heating') || lower.includes('cooling') || lower.includes('air condition')) {
    return INDUSTRY_TEMPLATES.hvac;
  }
  if (lower.includes('plumb')) {
    return INDUSTRY_TEMPLATES.plumbing;
  }
  if (lower.includes('landscap') || lower.includes('lawn')) {
    return INDUSTRY_TEMPLATES.landscaping;
  }

  return null;
}

/**
 * Convert template to tracker service_criteria format
 */
export function templateToServiceCriteria(template: IndustryTemplate): {
  primary_focus: string[];
  excluded_services: string[];
  required_services: string[];
  preferred_services: string[];
} {
  return {
    primary_focus: template.primary_focus,
    excluded_services: template.excluded_services,
    required_services: template.primary_focus.slice(0, 3), // First 3 as required
    preferred_services: template.primary_focus.slice(3), // Rest as preferred
  };
}

/**
 * Convert template to tracker kpi_scoring_config format
 */
export function templateToKPIConfig(template: IndustryTemplate): {
  template_id: string;
  template_name: string;
  kpis: KPIRule[];
} {
  return {
    template_id: template.id,
    template_name: template.name,
    kpis: template.kpis,
  };
}
