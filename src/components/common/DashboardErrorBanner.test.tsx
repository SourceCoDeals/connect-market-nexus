/**
 * DashboardErrorBanner.test.tsx
 *
 * Regression tests for the dashboard error banner. These pin the behaviour
 * that — if lost — puts the V2 Remarketing dashboard back into the "blank on
 * query failure" state fixed in this branch.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { fireEvent } from '@testing-library/react';
import { DashboardErrorBanner } from './DashboardErrorBanner';

describe('DashboardErrorBanner', () => {
  it('renders the title and error.message', () => {
    render(
      <DashboardErrorBanner
        title="Couldn't load Pipeline data"
        error={new Error('permission denied for table deal_pipeline')}
      />,
    );
    expect(screen.getByText(/Couldn't load Pipeline data/)).toBeInTheDocument();
    expect(screen.getByText(/permission denied for table deal_pipeline/)).toBeInTheDocument();
  });

  it('falls back to a generic hint when error.message is missing', () => {
    render(<DashboardErrorBanner title="Broken" error={null} />);
    // Empty/falsy error still shows the banner so the user never sees a blank
    // page — just with a generic hint instead of a real message.
    expect(screen.getByText('Broken')).toBeInTheDocument();
    expect(screen.getByText(/RLS policies, migrations, and network/)).toBeInTheDocument();
  });

  it('omits the retry button when onRetry is not provided', () => {
    render(<DashboardErrorBanner title="X" error={new Error('y')} />);
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('fires onRetry when the retry button is clicked', () => {
    const retry = vi.fn();
    render(<DashboardErrorBanner title="X" error={new Error('y')} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
