import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factory runs
const { mockSelect, mockUpsert, mockInvoke, mockToast } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpsert: vi.fn(),
  mockInvoke: vi.fn(),
  mockToast: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

import { queueDealEnrichment, queueBuyerEnrichment } from './queueEnrichment';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

beforeEach(() => {
  vi.clearAllMocks();

  // Default: invoke returns a resolved promise
  mockInvoke.mockResolvedValue({ data: null, error: null });
});

/**
 * Helper to set up the chained mock: supabase.from().select().in().in()
 */
function setupExistingQuery(existingIds: string[], field: string = 'listing_id') {
  // Chaining: from().select().in('status',...).in('listing_id',...)
  const innerIn = vi.fn().mockResolvedValue({
    data: existingIds.map((id) => ({ [field]: id })),
    error: null,
  });
  const outerIn = vi.fn(() => ({ in: innerIn }));
  mockSelect.mockReturnValue({ in: outerIn });
}

function setupExistingQueryError() {
  const innerIn = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'DB error' },
  });
  const outerIn = vi.fn(() => ({ in: innerIn }));
  mockSelect.mockReturnValue({ in: outerIn });
}

describe('queueDealEnrichment', () => {
  it('returns 0 for empty dealIds array', async () => {
    const result = await queueDealEnrichment([]);
    expect(result).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queues new deals that are not already in progress', async () => {
    setupExistingQuery([]); // No existing deals
    mockUpsert.mockResolvedValue({ error: null });

    const result = await queueDealEnrichment(['deal-1', 'deal-2']);
    expect(result).toBe(2);
    expect(mockUpsert).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Queued 2 deal(s) for background enrichment');
  });

  it('filters out deals already in progress', async () => {
    setupExistingQuery(['deal-1']); // deal-1 already queued
    mockUpsert.mockResolvedValue({ error: null });

    const result = await queueDealEnrichment(['deal-1', 'deal-2']);
    expect(result).toBe(1);

    // Verify the upsert was called with only deal-2
    const upsertRows = mockUpsert.mock.calls[0][0];
    expect(upsertRows).toHaveLength(1);
    expect(upsertRows[0].listing_id).toBe('deal-2');
  });

  it('shows info toast when all deals are already queued', async () => {
    setupExistingQuery(['deal-1', 'deal-2']);

    const result = await queueDealEnrichment(['deal-1', 'deal-2']);
    expect(result).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('Enrichment already in progress for these deals');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('throws when checking existing queue fails', async () => {
    setupExistingQueryError();

    await expect(queueDealEnrichment(['deal-1'])).rejects.toEqual({ message: 'DB error' });
  });

  it('throws when upsert fails', async () => {
    setupExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: { message: 'Insert failed' } });

    await expect(queueDealEnrichment(['deal-1'])).rejects.toEqual({ message: 'Insert failed' });
    expect(toast.error).toHaveBeenCalledWith('Failed to queue enrichment');
  });

  it('triggers the worker function after queuing', async () => {
    setupExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueDealEnrichment(['deal-1']);
    expect(mockInvoke).toHaveBeenCalledWith('process-enrichment-queue', {
      body: { trigger: 'deal-enrichment' },
    });
  });

  it('shows singular toast for a single deal', async () => {
    setupExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueDealEnrichment(['deal-1']);
    expect(toast.info).toHaveBeenCalledWith('Deal queued for background enrichment');
  });

  it('sets force flag in queued rows', async () => {
    setupExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueDealEnrichment(['deal-1'], true);
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows[0].force).toBe(true);

    vi.clearAllMocks();
    setupExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await queueDealEnrichment(['deal-1'], false);
    const rows2 = mockUpsert.mock.calls[0][0];
    expect(rows2[0].force).toBe(false);
  });
});

describe('queueBuyerEnrichment', () => {
  function setupBuyerExistingQuery(existingIds: string[]) {
    const innerIn = vi.fn().mockResolvedValue({
      data: existingIds.map((id) => ({ buyer_id: id })),
      error: null,
    });
    const outerIn = vi.fn(() => ({ in: innerIn }));
    mockSelect.mockReturnValue({ in: outerIn });
  }

  it('returns 0 for empty buyerIds array', async () => {
    const result = await queueBuyerEnrichment([]);
    expect(result).toBe(0);
  });

  it('queues new buyers that are not already in progress', async () => {
    setupBuyerExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    const result = await queueBuyerEnrichment(['buyer-1', 'buyer-2']);
    expect(result).toBe(2);
    expect(toast.info).toHaveBeenCalledWith('Queued 2 buyer(s) for background enrichment');
  });

  it('filters out buyers already queued', async () => {
    setupBuyerExistingQuery(['buyer-1']);
    mockUpsert.mockResolvedValue({ error: null });

    const result = await queueBuyerEnrichment(['buyer-1', 'buyer-2']);
    expect(result).toBe(1);
    const upsertRows = mockUpsert.mock.calls[0][0];
    expect(upsertRows[0].buyer_id).toBe('buyer-2');
  });

  it('includes universe_id in queued rows when provided', async () => {
    setupBuyerExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueBuyerEnrichment(['buyer-1'], 'universe-abc');
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows[0].universe_id).toBe('universe-abc');
  });

  it('sets universe_id to null when not provided', async () => {
    setupBuyerExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueBuyerEnrichment(['buyer-1']);
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows[0].universe_id).toBeNull();
  });

  it('triggers the buyer worker function', async () => {
    setupBuyerExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueBuyerEnrichment(['buyer-1']);
    expect(mockInvoke).toHaveBeenCalledWith('process-buyer-enrichment-queue', {
      body: { trigger: 'buyer-enrichment' },
    });
  });

  it('shows singular toast for a single buyer', async () => {
    setupBuyerExistingQuery([]);
    mockUpsert.mockResolvedValue({ error: null });

    await queueBuyerEnrichment(['buyer-1']);
    expect(toast.info).toHaveBeenCalledWith('Buyer queued for background enrichment');
  });
});
