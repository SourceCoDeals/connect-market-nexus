import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { PipelineDetailPanel } from './PipelineDetailPanel';

// Mock all child tab components
vi.mock('./tabs/PipelineDetailOverview', () => ({
  PipelineDetailOverview: (_props: { deal: unknown }) => (
    <div data-testid="tab-overview">Overview Tab Content</div>
  ),
}));

vi.mock('./tabs/PipelineDetailNotes', () => ({
  PipelineDetailNotes: (_props: { deal: unknown }) => (
    <div data-testid="tab-notes">Notes Tab Content</div>
  ),
}));

vi.mock('./tabs/PipelineDetailDataRoom', () => ({
  PipelineDetailDataRoom: (_props: { deal: unknown }) => (
    <div data-testid="tab-dataroom">Data Room Tab Content</div>
  ),
}));

vi.mock('./tabs/PipelineDetailDealInfo', () => ({
  PipelineDetailDealInfo: (_props: { deal: unknown }) => (
    <div data-testid="tab-dealinfo">Deal Info Tab Content</div>
  ),
}));

vi.mock('./tabs/PipelineDetailOtherBuyers', () => ({
  PipelineDetailOtherBuyers: (_props: { deal: unknown }) => (
    <div data-testid="tab-otherbuyers">Other Buyers Tab Content</div>
  ),
}));

vi.mock('./tabs/PipelineDetailRecommendedBuyers', () => ({
  PipelineDetailRecommendedBuyers: (_props: { deal: unknown }) => (
    <div data-testid="tab-recommended">Recommended Buyers Tab Content</div>
  ),
}));

vi.mock('@/components/admin/deals/DeleteDealDialog', () => ({
  DeleteDealDialog: () => null,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ============================================================================
// Helpers
// ============================================================================

function makeMockDeal() {
  return {
    deal_id: 'deal-1',
    title: 'Test Deal',
    deal_description: '',
    deal_value: 100000,
    deal_priority: 'medium' as const,
    deal_probability: 50,
    deal_source: 'inbound',
    deal_created_at: '2025-01-01T00:00:00Z',
    deal_updated_at: '2025-01-01T00:00:00Z',
    deal_stage_entered_at: '2025-01-01T00:00:00Z',
    stage_id: 'stage-1',
    stage_name: 'Qualification',
    stage_color: '#22c55e',
    stage_position: 1,
    listing_id: 'listing-1',
    listing_title: 'Test Listing',
    listing_revenue: 5000000,
    listing_ebitda: 1000000,
    listing_location: 'Houston, TX',
    listing_real_company_name: 'Real Corp',
    contact_name: 'John Doe',
    contact_email: 'john@example.com',
    contact_company: 'Acme Inc',
    nda_status: 'not_sent' as const,
    fee_agreement_status: 'not_sent' as const,
    followed_up: false,
    negative_followed_up: false,
    total_tasks: 0,
    pending_tasks: 0,
  };
}

function makeMockPipeline(selectedDeal: ReturnType<typeof makeMockDeal> | null = null) {
  return {
    selectedDeal,
    setSelectedDeal: vi.fn(),
    // Include other properties that the type expects (they are not used in the panel tests)
    deals: [],
    filteredAndSortedDeals: [],
    stages: [],
    isLoading: false,
    error: null,
    selectedDeals: [],
    setSelectedDeals: vi.fn(),
    selectDeal: vi.fn(),
    toggleSelectDeal: vi.fn(),
    toggleSelectAll: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    sortConfig: { field: 'deal_created_at', direction: 'desc' as const },
    setSortConfig: vi.fn(),
    stageFilter: null,
    setStageFilter: vi.fn(),
    priorityFilter: null,
    setPriorityFilter: vi.fn(),
    ownerFilter: null,
    setOwnerFilter: vi.fn(),
    followupFilter: null,
    setFollowupFilter: vi.fn(),
    ndaFilter: null,
    setNdaFilter: vi.fn(),
    feeFilter: null,
    setFeeFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    viewMode: 'list' as const,
    setViewMode: vi.fn(),
    moveDeal: vi.fn(),
    bulkMoveDeal: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof import('@/hooks/admin/use-pipeline-core').usePipelineCore>;
}

// ============================================================================
// Tests
// ============================================================================

describe('PipelineDetailPanel', () => {
  it('shows "Select a deal" message when no deal is selected', () => {
    render(<PipelineDetailPanel pipeline={makeMockPipeline(null)} />);
    expect(screen.getByText('Select a deal')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // All 6 tabs rendered
  // --------------------------------------------------------------------------
  describe('tab rendering', () => {
    it('renders all 6 tabs in TabsList', () => {
      const pipeline = makeMockPipeline(makeMockDeal());
      render(<PipelineDetailPanel pipeline={pipeline} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(6);

      const tabNames = tabs.map((t) => t.textContent?.trim());
      expect(tabNames).toContain('Overview');
      expect(tabNames).toContain('Deal Overview');
      expect(tabNames).toContain('Notes');
      expect(tabNames).toContain('Data Room');
      expect(tabNames).toContain('Other Buyers');
      // AI Buyers tab has an icon + text
      expect(tabNames.some((name) => name?.includes('AI Buyers'))).toBe(true);
    });

    it('shows Overview tab content by default', () => {
      const pipeline = makeMockPipeline(makeMockDeal());
      render(<PipelineDetailPanel pipeline={pipeline} />);
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    });

    it('clicking "AI Buyers" tab renders recommended buyers content', async () => {
      const user = userEvent.setup();
      const pipeline = makeMockPipeline(makeMockDeal());
      render(<PipelineDetailPanel pipeline={pipeline} />);

      await user.click(screen.getByRole('tab', { name: /ai buyers/i }));
      expect(screen.getByTestId('tab-recommended')).toBeInTheDocument();
    });

    it('clicking "Notes" tab renders notes content', async () => {
      const user = userEvent.setup();
      const pipeline = makeMockPipeline(makeMockDeal());
      render(<PipelineDetailPanel pipeline={pipeline} />);

      await user.click(screen.getByRole('tab', { name: /notes/i }));
      expect(screen.getByTestId('tab-notes')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Deal header
  // --------------------------------------------------------------------------
  describe('deal header', () => {
    it('shows the deal title with real company name', () => {
      const pipeline = makeMockPipeline(makeMockDeal());
      render(<PipelineDetailPanel pipeline={pipeline} />);
      expect(screen.getByText(/Real Corp/)).toBeInTheDocument();
    });

    it('shows the contact name', () => {
      const pipeline = makeMockPipeline(makeMockDeal());
      render(<PipelineDetailPanel pipeline={pipeline} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
