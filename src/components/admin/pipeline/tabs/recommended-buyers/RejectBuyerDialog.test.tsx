import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { RejectBuyerDialog } from './RejectBuyerDialog';

describe('RejectBuyerDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    buyerName: 'Acme Corp',
    onConfirm: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with buyer name in title', () => {
    render(<RejectBuyerDialog {...defaultProps} />);
    expect(screen.getByText(/Reject Acme Corp/)).toBeInTheDocument();
  });

  it('confirm button is disabled until a reason is selected', () => {
    render(<RejectBuyerDialog {...defaultProps} />);
    const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('renders rejection reason select and notes textarea', () => {
    render(<RejectBuyerDialog {...defaultProps} />);
    expect(screen.getByText('Reason *')).toBeInTheDocument();
    expect(screen.getByText('Notes (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add any additional context...')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<RejectBuyerDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Rejecting...')).toBeInTheDocument();
  });
});
