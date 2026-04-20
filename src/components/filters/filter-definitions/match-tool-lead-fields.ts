import {
  Building2,
  DollarSign,
  MapPin,
  Tag,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Star,
  Briefcase,
  Globe,
  Clock,
} from 'lucide-react';

import type { FilterFieldDef } from './types';

/** Buyer / Seller Match Tool Leads (external `match_tool_leads` table) */
export const MATCH_TOOL_LEAD_FIELDS: FilterFieldDef[] = [
  // ── Core ─────────────────────────────────────────────────────────
  {
    key: 'website',
    label: 'Website',
    type: 'text',
    group: 'Core',
    icon: Globe,
  },
  {
    key: 'business_name',
    label: 'Business Name',
    type: 'text',
    group: 'Core',
    icon: Building2,
  },
  {
    key: 'submission_stage',
    label: 'Submission Stage',
    type: 'select',
    group: 'Core',
    icon: Tag,
    options: [
      { label: 'Wants Buyers (Full Form)', value: 'full_form' },
      { label: 'Has Financials', value: 'financials' },
      { label: 'Browse Only', value: 'browse' },
    ],
  },

  // ── Contact ───────────────────────────────────────────────────────
  { key: 'full_name', label: 'Contact Name', type: 'text', group: 'Contact', icon: Users },
  { key: 'email', label: 'Email', type: 'text', group: 'Contact', icon: Users },
  { key: 'phone', label: 'Phone', type: 'text', group: 'Contact', icon: Users },

  // ── Financials (bucketed) ─────────────────────────────────────────
  {
    key: 'revenue',
    label: 'Revenue Bucket',
    type: 'select',
    group: 'Financials',
    icon: DollarSign,
    options: [
      { label: '<$500K', value: 'under_500k' },
      { label: '$500K–1M', value: '500k_1m' },
      { label: '$1M–5M', value: '1m_5m' },
      { label: '$5M–10M', value: '5m_10m' },
      { label: '$10M–25M', value: '10m_25m' },
      { label: '$25M–50M', value: '25m_50m' },
      { label: '$50M+', value: '50m_plus' },
    ],
  },
  {
    key: 'profit',
    label: 'Profit Bucket',
    type: 'select',
    group: 'Financials',
    icon: TrendingUp,
    options: [
      { label: '<$100K', value: 'under_100k' },
      { label: '$100K–500K', value: '100k_500k' },
      { label: '$500K–1M', value: '500k_1m' },
      { label: '$1M–3M', value: '1m_3m' },
      { label: '$3M–5M', value: '3m_5m' },
      { label: '$5M+', value: '5m_plus' },
    ],
  },
  {
    key: 'timeline',
    label: 'Exit Timeline',
    type: 'select',
    group: 'Financials',
    icon: Clock,
    options: [
      { label: '<6 months', value: 'less_than_6_months' },
      { label: '6–12 months', value: '6_to_12_months' },
      { label: '1–2 years', value: '1_to_2_years' },
      { label: '2+ years', value: '2_plus_years' },
      { label: 'Not sure', value: 'not_sure' },
    ],
  },

  // ── Business ─────────────────────────────────────────────────────
  {
    key: 'industry',
    label: 'Industry',
    type: 'select',
    group: 'Business',
    icon: Briefcase,
    dynamicOptions: true,
  },
  { key: 'location', label: 'Location', type: 'text', group: 'Business', icon: MapPin },

  // ── Status ───────────────────────────────────────────────────────
  {
    key: 'is_priority_target',
    label: 'Priority Target',
    type: 'boolean',
    group: 'Status',
    icon: Star,
  },
  {
    key: 'pushed_to_all_deals',
    label: 'Pushed to Active Deals',
    type: 'boolean',
    group: 'Status',
    icon: Activity,
  },
  {
    key: 'not_a_fit',
    label: 'Not a Fit',
    type: 'boolean',
    group: 'Status',
    icon: Activity,
  },
  {
    key: 'status',
    label: 'Lead Status',
    type: 'select',
    group: 'Status',
    icon: Tag,
    dynamicOptions: true,
  },

  // ── Scoring ──────────────────────────────────────────────────────
  {
    key: 'quality_label',
    label: 'Quality Tier',
    type: 'select',
    group: 'Scoring',
    icon: TrendingUp,
    options: [
      { label: 'Very Strong', value: 'Very Strong' },
      { label: 'Strong', value: 'Strong' },
      { label: 'Solid', value: 'Solid' },
      { label: 'Average', value: 'Average' },
      { label: 'Needs Work', value: 'Needs Work' },
    ],
  },
  { key: 'lead_score', label: 'Lead Score', type: 'number', group: 'Scoring', icon: TrendingUp },

  // ── Admin ────────────────────────────────────────────────────────
  { key: 'created_at', label: 'Submitted Date', type: 'date', group: 'Admin', icon: Calendar },
];
