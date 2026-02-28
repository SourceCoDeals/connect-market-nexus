import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import ListingCardTitle from './ListingCardTitle';

describe('ListingCardTitle', () => {
  it('renders the title text', () => {
    render(<ListingCardTitle title="HVAC Business" />);
    expect(screen.getByText('HVAC Business')).toBeInTheDocument();
  });

  it('renders title as h3 element', () => {
    render(<ListingCardTitle title="Test Title" />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Test Title');
  });

  it('shows pending status when connection is pending', () => {
    render(
      <MemoryRouter>
        <ListingCardTitle
          title="Business"
          connectionExists={true}
          connectionStatus="pending"
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Request Pending')).toBeInTheDocument();
    expect(screen.getByText('View Status')).toBeInTheDocument();
  });

  it('shows rejected status when connection is rejected', () => {
    render(
      <MemoryRouter>
        <ListingCardTitle
          title="Business"
          connectionExists={true}
          connectionStatus="rejected"
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Not Selected')).toBeInTheDocument();
  });

  it('does not show status when no connection exists', () => {
    render(
      <ListingCardTitle
        title="Business"
        connectionExists={false}
      />
    );
    expect(screen.queryByText('Request Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Not Selected')).not.toBeInTheDocument();
  });

  it('does not show status indicator for approved connections', () => {
    render(
      <ListingCardTitle
        title="Business"
        connectionExists={true}
        connectionStatus="approved"
      />
    );
    // Approved badge is rendered on the image, not in title
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });

  it('applies grid view type styling', () => {
    render(<ListingCardTitle title="Business" viewType="grid" />);
    const heading = screen.getByRole('heading');
    expect(heading.classList.contains('text-[20px]')).toBe(true);
  });

  it('applies list view type styling', () => {
    render(<ListingCardTitle title="Business" viewType="list" />);
    const heading = screen.getByRole('heading');
    expect(heading.classList.contains('text-[18px]')).toBe(true);
  });
});
