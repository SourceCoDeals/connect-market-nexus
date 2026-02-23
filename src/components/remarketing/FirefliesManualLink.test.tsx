import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { FirefliesManualLink } from './FirefliesManualLink';

// Mock supabase
const mockInvoke = vi.fn();
const mockInsert = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: () => ({
      insert: (...args: unknown[]) => mockInsert(...args),
    }),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('FirefliesManualLink', () => {
  const defaultProps = {
    listingId: 'listing-1',
    companyName: 'Acme Corp',
    onTranscriptLinked: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders card with title and description', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    expect(screen.getByText('Link Transcripts')).toBeInTheDocument();
    expect(screen.getByText(/Search Fireflies, paste a link, or upload/)).toBeInTheDocument();
  });

  it('renders three tabs: Paste Link, Upload File, Search', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    expect(screen.getByRole('tab', { name: /paste link/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upload file/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /search/i })).toBeInTheDocument();
  });

  it('shows Paste Link tab content by default', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    expect(screen.getByPlaceholderText(/fireflies\.ai\/view/i)).toBeInTheDocument();
  });

  it('links a Fireflies URL by pasting and clicking Link', async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    const input = screen.getByPlaceholderText(/fireflies\.ai\/view/i);
    fireEvent.change(input, { target: { value: 'https://app.fireflies.ai/view/abc123' } });

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          listing_id: 'listing-1',
          fireflies_transcript_id: 'abc123',
          transcript_url: 'https://app.fireflies.ai/view/abc123',
          source: 'fireflies',
        }),
      );
    });
  });

  it('extracts transcript ID from Fireflies URL', async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    const input = screen.getByPlaceholderText(/fireflies\.ai\/view/i);
    fireEvent.change(input, {
      target: { value: 'https://app.fireflies.ai/view/my-meeting-id?foo=bar' },
    });

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fireflies_transcript_id: 'my-meeting-id',
          title: 'Fireflies: my-meeting-id',
        }),
      );
    });
  });

  it('uses fallback ID for non-Fireflies URLs', async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    const input = screen.getByPlaceholderText(/fireflies\.ai\/view/i);
    fireEvent.change(input, { target: { value: 'https://other-site.com/transcript' } });

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Fireflies Transcript',
        }),
      );
    });
  });

  it('disables Link button when URL input is empty', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    const linkButton = screen.getByRole('button', { name: /^link$/i });
    expect(linkButton).toBeDisabled();
  });

  it('switches to Search tab and performs search', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'result-1',
            title: 'Q1 Planning Call',
            date: '2026-01-15T14:00:00Z',
            duration_minutes: 45,
            participants: ['Alice', 'Bob'],
            summary: 'Discussed Q1 goals',
            meeting_url: 'https://app.fireflies.ai/view/result-1',
            keywords: ['planning', 'Q1'],
          },
        ],
      },
      error: null,
    });

    render(<FirefliesManualLink {...defaultProps} />);

    // Switch to Search tab using userEvent for proper Radix activation
    await user.click(screen.getByRole('tab', { name: /search/i }));

    // Wait for tab content to be visible
    const searchInput = await screen.findByPlaceholderText(/search by company name/i);
    expect(searchInput).toHaveValue('Acme Corp');

    // Click search — find the button within the search tab
    const searchButtons = screen.getAllByRole('button');
    const searchButton = searchButtons.find((btn) => btn.textContent?.trim() === 'Search');
    expect(searchButton).toBeDefined();
    await user.click(searchButton!);

    // Wait for results
    expect(await screen.findByText('Q1 Planning Call')).toBeInTheDocument();
    expect(screen.getByText('Discussed Q1 goals')).toBeInTheDocument();
    expect(screen.getByText('planning')).toBeInTheDocument();
  });

  it('handles duplicate link gracefully', async () => {
    const { toast } = await import('sonner');

    mockInsert.mockReturnValueOnce({ error: { code: '23505', message: 'duplicate' } });

    render(<FirefliesManualLink {...defaultProps} />);
    const input = screen.getByPlaceholderText(/fireflies\.ai\/view/i);
    fireEvent.change(input, { target: { value: 'https://app.fireflies.ai/view/dup-id' } });

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        'This transcript is already linked',
        expect.any(Object),
      );
    });
  });

  it('calls onTranscriptLinked after successful link', async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    const input = screen.getByPlaceholderText(/fireflies\.ai\/view/i);
    fireEvent.change(input, { target: { value: 'https://app.fireflies.ai/view/new-id' } });

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(defaultProps.onTranscriptLinked).toHaveBeenCalled();
    });
  });

  it('links search result to deal on link click', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'sr-1',
            title: 'Linkable Call',
            date: '2026-02-01T10:00:00Z',
            duration_minutes: 20,
            participants: ['Alice'],
            summary: 'Summary text',
            meeting_url: 'https://app.fireflies.ai/view/sr-1',
            keywords: [],
          },
        ],
      },
      error: null,
    });

    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);

    // Switch to search tab using userEvent
    await user.click(screen.getByRole('tab', { name: /search/i }));

    // Wait for tab content, then find and click search button
    await screen.findByPlaceholderText(/search by company name/i);
    const searchButtons = screen.getAllByRole('button');
    const searchButton = searchButtons.find((btn) => btn.textContent?.trim() === 'Search');
    await user.click(searchButton!);

    // Wait for result and click link
    await screen.findByText('Linkable Call');
    const allButtons = screen.getAllByRole('button');
    const linkButton = allButtons.find((btn) => btn.textContent?.trim() === 'Link');
    await user.click(linkButton!);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          listing_id: 'listing-1',
          fireflies_transcript_id: 'sr-1',
          source: 'fireflies',
          auto_linked: false,
        }),
      );
    });
  });
});
