import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { FirefliesTranscriptSearch } from './FirefliesTranscriptSearch';

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

describe('FirefliesTranscriptSearch', () => {
  const defaultProps = {
    buyerId: 'buyer-1',
    companyName: 'Acme Corp',
    onTranscriptLinked: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with company name as default query', () => {
    render(<FirefliesTranscriptSearch {...defaultProps} />);
    const input = screen.getByPlaceholderText(/search by company name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Acme Corp');
  });

  it('renders Search button', () => {
    render(<FirefliesTranscriptSearch {...defaultProps} />);
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('disables Search button when query is empty', () => {
    render(<FirefliesTranscriptSearch {...defaultProps} companyName="" />);
    const input = screen.getByPlaceholderText(/search by company name/i);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('shows empty state text when no results', () => {
    render(<FirefliesTranscriptSearch {...defaultProps} />);
    expect(screen.getByText(/Search Fireflies to find relevant/i)).toBeInTheDocument();
  });

  it('calls search-fireflies-for-buyer edge function on search', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { results: [] },
      error: null,
    });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'search-fireflies-for-buyer',
        expect.objectContaining({
          body: expect.objectContaining({
            query: 'Acme Corp',
            limit: 30,
          }),
        }),
      );
    });
  });

  it('displays search results', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'ff-1',
            title: 'Call with Acme Corp CEO',
            date: '2026-02-01T10:00:00Z',
            duration_minutes: 30,
            participants: ['John', 'Jane'],
            summary: 'Discussed acquisition terms',
            meeting_url: 'https://app.fireflies.ai/view/ff-1',
            keywords: ['acquisition', 'terms'],
          },
        ],
      },
      error: null,
    });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText('Call with Acme Corp CEO')).toBeInTheDocument();
    expect(screen.getByText('Discussed acquisition terms')).toBeInTheDocument();
    expect(screen.getByText('acquisition')).toBeInTheDocument();
    expect(screen.getByText('terms')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  it('passes participant emails to search when contacts are provided', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { results: [] },
      error: null,
    });

    render(
      <FirefliesTranscriptSearch
        {...defaultProps}
        contacts={[{ email: 'john@acme.com' }, { email: 'jane@acme.com' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'search-fireflies-for-buyer',
        expect.objectContaining({
          body: expect.objectContaining({
            participantEmails: ['john@acme.com', 'jane@acme.com'],
          }),
        }),
      );
    });
  });

  it('links transcript to buyer on link click', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'ff-2',
            title: 'Test Call',
            date: '2026-02-01T10:00:00Z',
            duration_minutes: 15,
            participants: [],
            summary: 'Test summary',
            meeting_url: 'https://app.fireflies.ai/view/ff-2',
            keywords: [],
          },
        ],
      },
      error: null,
    });

    mockInsert.mockReturnValueOnce({ error: null });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    const linkButton = await screen.findByRole('button', { name: /link to buyer/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          buyer_id: 'buyer-1',
          fireflies_transcript_id: 'ff-2',
          title: 'Test Call',
        }),
      );
    });
  });

  it('shows info toast for duplicate link (23505 error)', async () => {
    const { toast } = await import('sonner');

    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'ff-3',
            title: 'Dup Call',
            date: '2026-02-01T10:00:00Z',
            duration_minutes: 10,
            participants: [],
            summary: '',
            meeting_url: '',
            keywords: [],
          },
        ],
      },
      error: null,
    });

    mockInsert.mockReturnValueOnce({ error: { code: '23505', message: 'duplicate' } });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    const linkButton = await screen.findByRole('button', { name: /link to buyer/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('This transcript is already linked to this buyer');
    });
  });

  it('triggers search on Enter key', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { results: [] },
      error: null,
    });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    const input = screen.getByPlaceholderText(/search by company name/i);
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  it('shows clear button when results exist', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'ff-4',
            title: 'Clearable Call',
            date: '2026-02-01T10:00:00Z',
            duration_minutes: 5,
            participants: [],
            summary: '',
            meeting_url: '',
            keywords: [],
          },
        ],
      },
      error: null,
    });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    const clearButton = await screen.findByText('Clear');
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(screen.queryByText('Clearable Call')).not.toBeInTheDocument();
  });

  it('shows result count label', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: '1',
            title: 'A',
            date: '2026-01-01',
            duration_minutes: 1,
            participants: [],
            summary: '',
            meeting_url: '',
            keywords: [],
          },
          {
            id: '2',
            title: 'B',
            date: '2026-01-01',
            duration_minutes: 2,
            participants: [],
            summary: '',
            meeting_url: '',
            keywords: [],
          },
        ],
      },
      error: null,
    });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText('2 results')).toBeInTheDocument();
  });

  it('shows +N more badge when keywords exceed 5', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 'ff-5',
            title: 'Keywords Call',
            date: '2026-02-01T10:00:00Z',
            duration_minutes: 20,
            participants: [],
            summary: '',
            meeting_url: '',
            keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          },
        ],
      },
      error: null,
    });

    render(<FirefliesTranscriptSearch {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText('+2 more')).toBeInTheDocument();
  });
});
