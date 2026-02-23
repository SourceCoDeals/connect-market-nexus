import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { LoadingSpinner, OverlaySpinner, InlineSpinner, ButtonSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.classList.contains('animate-spin')).toBe(true);
  });

  it('does not show message by default', () => {
    render(<LoadingSpinner message="Loading data..." />);
    expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
  });

  it('shows message when showMessage is true', () => {
    render(<LoadingSpinner message="Loading data..." showMessage={true} />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('renders overlay variant', () => {
    const { container } = render(<LoadingSpinner variant="overlay" showMessage />);
    expect(container.querySelector('.fixed')).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders inline variant', () => {
    const { container } = render(<LoadingSpinner variant="inline" showMessage />);
    expect(container.querySelector('.flex.items-center')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="text-red-500" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('text-red-500')).toBe(true);
  });

  it('applies size classes', () => {
    const { container: sm } = render(<LoadingSpinner size="sm" />);
    expect(sm.querySelector('.h-4')).toBeTruthy();

    const { container: lg } = render(<LoadingSpinner size="lg" />);
    expect(lg.querySelector('.h-8')).toBeTruthy();

    const { container: xl } = render(<LoadingSpinner size="xl" />);
    expect(xl.querySelector('.h-12')).toBeTruthy();
  });
});

describe('OverlaySpinner', () => {
  it('renders as overlay with large size', () => {
    const { container } = render(<OverlaySpinner />);
    expect(container.querySelector('.fixed')).toBeTruthy();
  });

  it('shows message by default', () => {
    render(<OverlaySpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('accepts custom message', () => {
    render(<OverlaySpinner message="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });
});

describe('InlineSpinner', () => {
  it('renders inline', () => {
    const { container } = render(<InlineSpinner />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('does not show message by default', () => {
    render(<InlineSpinner message="Loading..." />);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});

describe('ButtonSpinner', () => {
  it('renders a small spinner', () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelector('.h-4')).toBeTruthy();
  });
});
