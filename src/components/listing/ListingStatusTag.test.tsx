import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import ListingStatusTag from './ListingStatusTag';

describe('ListingStatusTag', () => {
  it('returns null for null status', () => {
    const { container } = render(<ListingStatusTag status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for unknown status', () => {
    const { container } = render(<ListingStatusTag status="unknown_status" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders just_listed status', () => {
    render(<ListingStatusTag status="just_listed" />);
    expect(screen.getByText('Just Listed')).toBeInTheDocument();
  });

  it('renders reviewing_buyers status', () => {
    render(<ListingStatusTag status="reviewing_buyers" />);
    expect(screen.getByText('Reviewing Buyers')).toBeInTheDocument();
  });

  it('renders in_diligence status', () => {
    render(<ListingStatusTag status="in_diligence" />);
    expect(screen.getByText('In Diligence')).toBeInTheDocument();
  });

  it('renders under_loi status', () => {
    render(<ListingStatusTag status="under_loi" />);
    expect(screen.getByText('Under LOI')).toBeInTheDocument();
  });

  it('renders accepted_offer status', () => {
    render(<ListingStatusTag status="accepted_offer" />);
    expect(screen.getByText('Accepted Offer')).toBeInTheDocument();
  });

  it('applies absolute positioning by default', () => {
    const { container } = render(<ListingStatusTag status="just_listed" />);
    const badge = container.querySelector('.absolute');
    expect(badge).toBeTruthy();
  });

  it('applies inline positioning when variant is inline', () => {
    const { container } = render(<ListingStatusTag status="just_listed" variant="inline" />);
    const badge = container.querySelector('.absolute');
    expect(badge).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<ListingStatusTag status="just_listed" className="custom-class" />);
    const badge = container.querySelector('.custom-class');
    expect(badge).toBeTruthy();
  });
});
