import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { BuyerRecommendationCard } from './BuyerRecommendationCard';
import type { RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';

// ============================================================================
// Mock data helper
// ============================================================================

function makeMockBuyer(overrides: Partial<RecommendedBuyer> = {}): RecommendedBuyer {
  return {
    buyer_id: 'buyer-1',
    company_name: 'Acme Corp',
    pe_firm_name: null,
    buyer_type: 'strategic',
    hq_state: 'TX',
    hq_city: 'Houston',
    has_fee_agreement: false,
    acquisition_appetite: 'active',
    thesis_summary: null,
    total_acquisitions: 3,
    composite_fit_score: 70,
    human_override_score: null,
    geography_score: 60,
    size_score: 55,
    service_score: 65,
    owner_goals_score: 70,
    fit_reasoning: null,
    score_status: 'scored',
    tier: 'strong_candidate',
    tier_label: 'Strong Candidate',
    fit_signals: ['Regional geographic proximity'],
    last_engagement: null,
    last_engagement_type: null,
    days_since_engagement: null,
    engagement_cold: true,
    transcript_insights: {
      call_count: 0,
      ceo_detected: false,
      latest_call_date: null,
    },
    outreach_info: {
      contacted: false,
      nda_signed: false,
      cim_sent: false,
      meeting_scheduled: false,
      outcome: null,
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BuyerRecommendationCard', () => {
  // --------------------------------------------------------------------------
  // ScoreBadge color variants
  // --------------------------------------------------------------------------
  describe('ScoreBadge', () => {
    it('renders with emerald class for score >= 80', () => {
      const buyer = makeMockBuyer({ composite_fit_score: 85 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      const scoreBadge = screen.getByText('85');
      expect(scoreBadge.className).toContain('emerald');
    });

    it('renders with amber class for score 60-79', () => {
      const buyer = makeMockBuyer({ composite_fit_score: 65 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      const scoreBadge = screen.getByText('65');
      expect(scoreBadge.className).toContain('amber');
    });

    it('renders with muted class for score < 60', () => {
      const buyer = makeMockBuyer({ composite_fit_score: 45 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      const scoreBadge = screen.getByText('45');
      expect(scoreBadge.className).toContain('muted');
    });

    it('renders with emerald class for score exactly 80', () => {
      const buyer = makeMockBuyer({ composite_fit_score: 80 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      const scoreBadge = screen.getByText('80');
      expect(scoreBadge.className).toContain('emerald');
    });

    it('renders with amber class for score exactly 60', () => {
      const buyer = makeMockBuyer({ composite_fit_score: 60 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      const scoreBadge = screen.getByText('60');
      expect(scoreBadge.className).toContain('amber');
    });
  });

  // --------------------------------------------------------------------------
  // Expand/collapse toggle
  // --------------------------------------------------------------------------
  describe('expand/collapse toggle', () => {
    it('does not show expanded details initially', () => {
      const buyer = makeMockBuyer({ geography_score: 75 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      // Expanded details show score breakdown like "Geography"
      expect(screen.queryByText('Geography')).not.toBeInTheDocument();
    });

    it('shows expanded details after clicking toggle', async () => {
      const user = userEvent.setup();
      const buyer = makeMockBuyer({ geography_score: 75 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);

      // Find the toggle button (last button in the actions row)
      const buttons = screen.getAllByRole('button');
      const toggleButton = buttons[buttons.length - 1];
      await user.click(toggleButton);

      expect(screen.getByText('Geography')).toBeInTheDocument();
      expect(screen.getByText('Size Fit')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Owner Goals')).toBeInTheDocument();
    });

    it('hides expanded details after clicking toggle twice', async () => {
      const user = userEvent.setup();
      const buyer = makeMockBuyer({ geography_score: 75 });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);

      const buttons = screen.getAllByRole('button');
      const toggleButton = buttons[buttons.length - 1];

      // Expand
      await user.click(toggleButton);
      expect(screen.getByText('Geography')).toBeInTheDocument();

      // Collapse
      await user.click(toggleButton);
      expect(screen.queryByText('Geography')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // "Draft Outreach" button
  // --------------------------------------------------------------------------
  describe('Draft Outreach button', () => {
    it('renders Draft Outreach button when onDraftEmail is provided', () => {
      const onDraftEmail = vi.fn();
      const buyer = makeMockBuyer();
      render(<BuyerRecommendationCard buyer={buyer} rank={1} onDraftEmail={onDraftEmail} />);
      expect(screen.getByText('Draft Outreach')).toBeInTheDocument();
    });

    it('does not render Draft Outreach button when onDraftEmail is not provided', () => {
      const buyer = makeMockBuyer();
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      expect(screen.queryByText('Draft Outreach')).not.toBeInTheDocument();
    });

    it('fires callback with buyer_id when clicked', async () => {
      const user = userEvent.setup();
      const onDraftEmail = vi.fn();
      const buyer = makeMockBuyer({ buyer_id: 'test-buyer-123' });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} onDraftEmail={onDraftEmail} />);

      await user.click(screen.getByText('Draft Outreach'));
      expect(onDraftEmail).toHaveBeenCalledTimes(1);
      expect(onDraftEmail).toHaveBeenCalledWith('test-buyer-123');
    });
  });

  // --------------------------------------------------------------------------
  // Reject button
  // --------------------------------------------------------------------------
  describe('Reject button', () => {
    it('fires callback with buyer_id and company name when clicked', async () => {
      const user = userEvent.setup();
      const onReject = vi.fn();
      const buyer = makeMockBuyer({ buyer_id: 'b-1', company_name: 'Acme Corp' });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} onReject={onReject} />);

      await user.click(screen.getByText('Reject'));
      expect(onReject).toHaveBeenCalledWith('b-1', 'Acme Corp');
    });
  });

  // --------------------------------------------------------------------------
  // Display name
  // --------------------------------------------------------------------------
  describe('display name', () => {
    it('renders company name with PE firm name when present', () => {
      const buyer = makeMockBuyer({ company_name: 'Acme Corp', pe_firm_name: 'PE Capital' });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      expect(screen.getByText('Acme Corp (PE Capital)')).toBeInTheDocument();
    });

    it('renders company name alone when no PE firm', () => {
      const buyer = makeMockBuyer({ company_name: 'Acme Corp', pe_firm_name: null });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Fit signals display
  // --------------------------------------------------------------------------
  describe('fit signals', () => {
    it('renders fit signals as badges', () => {
      const buyer = makeMockBuyer({
        fit_signals: ['Strong geographic footprint overlap', 'Fee agreement signed'],
      });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      expect(screen.getByText('Strong geographic footprint overlap')).toBeInTheDocument();
      expect(screen.getByText('Fee agreement signed')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Tier badge
  // --------------------------------------------------------------------------
  describe('tier badge', () => {
    it('renders tier label', () => {
      const buyer = makeMockBuyer({ tier: 'move_now', tier_label: 'Move Now' });
      render(<BuyerRecommendationCard buyer={buyer} rank={1} />);
      expect(screen.getByText('Move Now')).toBeInTheDocument();
    });
  });
});
