import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import ListingCardFinancials from './ListingCardFinancials';

describe('ListingCardFinancials', () => {
  const mockFormatCurrency = vi.fn((value: number) => `$${value.toLocaleString()}`);

  it('renders all financial fields', () => {
    render(
      <ListingCardFinancials
        revenue={5000000}
        ebitda={1000000}
        formatCurrency={mockFormatCurrency}
      />
    );
    expect(screen.getByText('ANNUAL REVENUE')).toBeInTheDocument();
    expect(screen.getByText('EBITDA')).toBeInTheDocument();
    expect(screen.getByText('EBITDA MARGIN')).toBeInTheDocument();
    expect(screen.getByText('EMPLOYEES')).toBeInTheDocument();
  });

  it('formats revenue and ebitda using formatCurrency', () => {
    render(
      <ListingCardFinancials
        revenue={5000000}
        ebitda={1000000}
        formatCurrency={mockFormatCurrency}
      />
    );
    expect(mockFormatCurrency).toHaveBeenCalledWith(5000000);
    expect(mockFormatCurrency).toHaveBeenCalledWith(1000000);
  });

  it('calculates EBITDA margin correctly', () => {
    render(
      <ListingCardFinancials
        revenue={10000000}
        ebitda={2000000}
        formatCurrency={mockFormatCurrency}
      />
    );
    expect(screen.getByText('20.0%')).toBeInTheDocument();
  });

  it('handles zero revenue for margin', () => {
    render(
      <ListingCardFinancials
        revenue={0}
        ebitda={0}
        formatCurrency={mockFormatCurrency}
      />
    );
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('shows employee count when provided', () => {
    render(
      <ListingCardFinancials
        revenue={5000000}
        ebitda={1000000}
        formatCurrency={mockFormatCurrency}
        fullTimeEmployees={50}
        partTimeEmployees={10}
      />
    );
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('shows em dash for zero employees', () => {
    render(
      <ListingCardFinancials
        revenue={5000000}
        ebitda={1000000}
        formatCurrency={mockFormatCurrency}
        fullTimeEmployees={0}
        partTimeEmployees={0}
      />
    );
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders in list view type', () => {
    const { container } = render(
      <ListingCardFinancials
        revenue={5000000}
        ebitda={1000000}
        formatCurrency={mockFormatCurrency}
        viewType="list"
      />
    );
    expect(container.querySelector('.grid-cols-4')).toBeTruthy();
  });

  it('renders in grid view type by default', () => {
    const { container } = render(
      <ListingCardFinancials
        revenue={5000000}
        ebitda={1000000}
        formatCurrency={mockFormatCurrency}
      />
    );
    expect(container.querySelector('.grid-cols-2')).toBeTruthy();
  });
});
