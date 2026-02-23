import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import AcquisitionTypeBadge from './AcquisitionTypeBadge';

describe('AcquisitionTypeBadge', () => {
  it('returns null for null type', () => {
    const { container } = render(<AcquisitionTypeBadge type={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for undefined type', () => {
    const { container } = render(<AcquisitionTypeBadge type={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for unknown type', () => {
    const { container } = render(<AcquisitionTypeBadge type="unknown" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Add-On badge for add_on type', () => {
    render(<AcquisitionTypeBadge type="add_on" />);
    expect(screen.getByText('Add-On')).toBeInTheDocument();
  });

  it('renders Platform badge for platform type', () => {
    render(<AcquisitionTypeBadge type="platform" />);
    expect(screen.getByText('Platform')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AcquisitionTypeBadge type="add_on" className="extra-class" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.classList.contains('extra-class')).toBe(true);
  });

  it('renders with gold background', () => {
    const { container } = render(<AcquisitionTypeBadge type="platform" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.classList.contains('bg-[#D8B75D]')).toBe(true);
  });
});
