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

  it('renders three tabs: Search Fireflies, Paste Link, Upload File', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    expect(screen.getByRole('tab', { name: /search fireflies/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /paste link/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upload file/i })).toBeInTheDocument();
  });

  it('shows Search tab content by default', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search by company name, person/i)).toBeInTheDocument();
  });

  it('pre-populates search with company name', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/search by company name, person/i);
    expect(searchInput).toHaveValue('Acme Corp');
  });

  it('switches to Paste Link tab and validates URL', async () => {
    const user = userEvent.setup();
    render(<FirefliesManualLink {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /paste link/i }));
    const input = await screen.findByPlaceholderText(/fireflies\.ai\/view\/your-transcript/i);
    expect(input).toBeInTheDocument();

    // Link button should be disabled with empty input
    const linkButton = screen.getByRole('button', { name: /^link$/i });
    expect(linkButton).toBeDisabled();

    // Enter an invalid URL — button should stay disabled
    await user.type(input, 'https://other-site.com/transcript');
    expect(linkButton).toBeDisabled();

    // Warning should appear
    expect(await screen.findByText(/URL should be from app\.fireflies\.ai/i)).toBeInTheDocument();
  });

  it('links a valid Fireflies URL', async () => {
    const user = userEvent.setup();
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /paste link/i }));

    const input = await screen.findByPlaceholderText(/fireflies\.ai\/view\/your-transcript/i);
    await user.type(input, 'https://app.fireflies.ai/view/abc123');

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    expect(linkButton).not.toBeDisabled();
    await user.click(linkButton);

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

  it('extracts transcript ID from Fireflies URL with query params', async () => {
    const user = userEvent.setup();
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /paste link/i }));

    const input = await screen.findByPlaceholderText(/fireflies\.ai\/view\/your-transcript/i);
    await user.type(input, 'https://app.fireflies.ai/view/my-meeting-id?foo=bar');

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    await user.click(linkButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fireflies_transcript_id: 'my-meeting-id',
          title: 'Fireflies: my-meeting-id',
        }),
      );
    });
  });

  it('rejects non-Fireflies URLs with validation error', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    render(<FirefliesManualLink {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /paste link/i }));

    const input = await screen.findByPlaceholderText(/fireflies\.ai\/view\/your-transcript/i);
    await user.type(input, 'https://other-site.com/transcript');

    // Link button should be disabled for invalid URLs
    const linkButton = screen.getByRole('button', { name: /^link$/i });
    expect(linkButton).toBeDisabled();
  });

  it('performs search and displays results', async () => {
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

    // Search tab is now default, search input should be visible
    const searchInput = screen.getByPlaceholderText(/search by company name, person/i);
    expect(searchInput).toHaveValue('Acme Corp');

    // Click search
    const searchButtons = screen.getAllByRole('button');
    const searchButton = searchButtons.find((btn) => btn.textContent?.trim() === 'Search');
    expect(searchButton).toBeDefined();
    await user.click(searchButton!);

    // Wait for results — title should be a clickable link
    expect(await screen.findByText('Q1 Planning Call')).toBeInTheDocument();
    expect(screen.getByText(/Discussed Q1 goals/i)).toBeInTheDocument();
    expect(screen.getByText('planning')).toBeInTheDocument();

    // Results header should show count and instruction
    expect(screen.getByText(/1 result/i)).toBeInTheDocument();
    expect(screen.getByText(/click title to view in Fireflies/i)).toBeInTheDocument();
  });

  it('search result title is a clickable link to Fireflies', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'result-1',
            title: 'Clickable Call',
            date: '2026-01-15T14:00:00Z',
            duration_minutes: 30,
            participants: [],
            summary: '',
            meeting_url: 'https://app.fireflies.ai/view/result-1',
            keywords: [],
          },
        ],
      },
      error: null,
    });

    render(<FirefliesManualLink {...defaultProps} />);
    const searchButton = screen.getAllByRole('button').find((btn) => btn.textContent?.trim() === 'Search');
    await user.click(searchButton!);

    const link = await screen.findByText('Clickable Call');
    expect(link.closest('a')).toHaveAttribute('href', 'https://app.fireflies.ai/view/result-1');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('handles duplicate link gracefully', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    mockInsert.mockReturnValueOnce({ error: { code: '23505', message: 'duplicate' } });

    render(<FirefliesManualLink {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /paste link/i }));

    const input = await screen.findByPlaceholderText(/fireflies\.ai\/view\/your-transcript/i);
    await user.type(input, 'https://app.fireflies.ai/view/dup-id');

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    await user.click(linkButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        'This transcript is already linked',
        expect.any(Object),
      );
    });
  });

  it('calls onTranscriptLinked after successful link', async () => {
    const user = userEvent.setup();
    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesManualLink {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /paste link/i }));

    const input = await screen.findByPlaceholderText(/fireflies\.ai\/view\/your-transcript/i);
    await user.type(input, 'https://app.fireflies.ai/view/new-id');

    const linkButton = screen.getByRole('button', { name: /^link$/i });
    await user.click(linkButton);

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

    // Search tab is default now
    const searchButton = screen.getAllByRole('button').find((btn) => btn.textContent?.trim() === 'Search');
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

  it('shows empty state with guidance when no search performed', () => {
    render(<FirefliesManualLink {...defaultProps} />);
    expect(screen.getByText(/Search Fireflies to find and link call transcripts/i)).toBeInTheDocument();
  });

  it('shows upload tab with file format info', async () => {
    const user = userEvent.setup();
    render(<FirefliesManualLink {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /upload file/i }));
    expect(await screen.findByText(/Click to upload transcript files/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, DOC, DOCX, TXT, VTT, SRT/i)).toBeInTheDocument();
    expect(screen.getByText(/Text will be extracted from uploaded files/i)).toBeInTheDocument();
  });

  it('shows paste link tab with info text', async () => {
    const user = userEvent.setup();
    render(<FirefliesManualLink {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /paste link/i }));
    expect(await screen.findByText(/content will be fetched automatically/i)).toBeInTheDocument();
  });
});
