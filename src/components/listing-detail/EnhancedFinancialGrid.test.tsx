import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { EnhancedFinancialGrid } from './EnhancedFinancialGrid';

/**
 * EnhancedFinancialGrid is the shared component used by ListingDetail and
 * ListingPreview (and a near-identical inline version in EditorLivePreview /
 * ClientPreviewDialog). Metric 3 is now "custom only" — the legacy Team Size
 * branch has been removed. These tests lock in the two invariants those
 * preview surfaces now depend on:
 *
 *   1. The grid adapts its column count to the number of metrics passed in.
 *   2. No preview ever shows a "Team Size" or "EMPLOYEES" tile unless the
 *      caller explicitly passes one in (which no current caller does).
 */
describe('EnhancedFinancialGrid', () => {
  const revenueMetric = { label: '2025 Revenue', value: '$5M' };
  const ebitdaMetric = { label: 'EBITDA', value: '$1M' };
  const ebitdaMarginMetric = { label: 'EBITDA Margin', value: '20%' };
  const customMetric3 = { label: 'Locations', value: '12' };

  it('renders 4 columns when 4 metrics are provided', () => {
    const { container } = render(
      <EnhancedFinancialGrid
        metrics={[revenueMetric, ebitdaMetric, customMetric3, ebitdaMarginMetric]}
      />,
    );
    expect(container.querySelector('.sm\\:grid-cols-4')).toBeTruthy();
  });

  it('collapses to 3 columns when metric 3 is omitted (the common case after de-employeeification)', () => {
    const { container } = render(
      <EnhancedFinancialGrid metrics={[revenueMetric, ebitdaMetric, ebitdaMarginMetric]} />,
    );
    expect(container.querySelector('.sm\\:grid-cols-3')).toBeTruthy();
    expect(container.querySelector('.sm\\:grid-cols-4')).toBeFalsy();
  });

  it('falls back to 2 columns when only revenue + EBITDA are passed', () => {
    const { container } = render(<EnhancedFinancialGrid metrics={[revenueMetric, ebitdaMetric]} />);
    expect(container.querySelector('.grid-cols-2')).toBeTruthy();
    expect(container.querySelector('.sm\\:grid-cols-3')).toBeFalsy();
    expect(container.querySelector('.sm\\:grid-cols-4')).toBeFalsy();
  });

  it('does not render "Team Size" or "Employees" labels for any typical preview metric set', () => {
    render(<EnhancedFinancialGrid metrics={[revenueMetric, ebitdaMetric, ebitdaMarginMetric]} />);
    expect(screen.queryByText(/team size/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/employees/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FT,.*PT/i)).not.toBeInTheDocument();
  });

  it('renders all provided metric labels and values', () => {
    render(
      <EnhancedFinancialGrid
        metrics={[revenueMetric, ebitdaMetric, customMetric3, ebitdaMarginMetric]}
      />,
    );
    expect(screen.getByText('2025 Revenue')).toBeInTheDocument();
    expect(screen.getByText('$5M')).toBeInTheDocument();
    expect(screen.getByText('EBITDA')).toBeInTheDocument();
    expect(screen.getByText('$1M')).toBeInTheDocument();
    expect(screen.getByText('Locations')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('EBITDA Margin')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
