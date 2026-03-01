import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { DocuSealStatusBadge } from './DocuSealStatusBadge';
import type { DocuSealStatus } from '@/hooks/admin/use-docuseal';

describe('DocuSealStatusBadge', () => {
  const statuses: DocuSealStatus[] = ['not_sent', 'sent', 'viewed', 'signed', 'declined'];

  it.each(statuses)('renders badge for status "%s"', (status) => {
    render(<DocuSealStatusBadge status={status} />);
    const expectedLabels: Record<DocuSealStatus, string> = {
      not_sent: 'Not Sent',
      sent: 'Sent',
      viewed: 'Viewed',
      signed: 'Signed',
      declined: 'Declined',
    };
    expect(screen.getByText(expectedLabels[status])).toBeInTheDocument();
  });

  it('renders custom label when provided', () => {
    render(<DocuSealStatusBadge status="signed" label="NDA Signed" />);
    expect(screen.getByText('NDA Signed')).toBeInTheDocument();
  });

  it('falls back to not_sent config for unknown status', () => {
    render(<DocuSealStatusBadge status={'unknown' as DocuSealStatus} />);
    expect(screen.getByText('Not Sent')).toBeInTheDocument();
  });

  it('renders without action menu when no actions are provided', () => {
    render(<DocuSealStatusBadge status="not_sent" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders action menu trigger when onSend is provided', () => {
    const onSend = vi.fn();
    render(<DocuSealStatusBadge status="not_sent" onSend={onSend} />);
    const trigger = screen.getByRole('button', { name: /not sent status actions/i });
    expect(trigger).toBeInTheDocument();
  });

  it('opens dropdown menu on click for not_sent with onSend', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<DocuSealStatusBadge status="not_sent" onSend={onSend} />);
    const trigger = screen.getByRole('button', { name: /not sent status actions/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /send for signing/i })).toBeInTheDocument();
    });
  });

  it('opens dropdown menu with Resend for sent status', async () => {
    const user = userEvent.setup();
    const onResend = vi.fn();
    render(<DocuSealStatusBadge status="sent" onResend={onResend} />);
    const trigger = screen.getByRole('button', { name: /sent status actions/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /resend/i })).toBeInTheDocument();
    });
  });

  it('opens dropdown with Download for signed status with https URL', async () => {
    const user = userEvent.setup();
    render(
      <DocuSealStatusBadge
        status="signed"
        signedDocumentUrl="https://docuseal.com/docs/signed.pdf"
      />,
    );
    const trigger = screen.getByRole('button', { name: /signed status actions/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /download signed doc/i })).toBeInTheDocument();
    });
  });

  it('does not show download for non-https URLs', async () => {
    const user = userEvent.setup();
    const onManualOverride = vi.fn();
    render(
      <DocuSealStatusBadge
        status="signed"
        signedDocumentUrl="http://insecure.com/doc.pdf"
        onManualOverride={onManualOverride}
      />,
    );
    const trigger = screen.getByRole('button', { name: /signed status actions/i });
    await user.click(trigger);
    await new Promise((r) => setTimeout(r, 200));
    expect(
      screen.queryByRole('menuitem', { name: /download signed doc/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Manual Override for non-signed status', async () => {
    const user = userEvent.setup();
    const onManualOverride = vi.fn();
    render(<DocuSealStatusBadge status="sent" onManualOverride={onManualOverride} />);
    const trigger = screen.getByRole('button', { name: /sent status actions/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /manual override/i })).toBeInTheDocument();
    });
  });

  it('does not show Manual Override for signed status', async () => {
    const user = userEvent.setup();
    const onManualOverride = vi.fn();
    render(
      <DocuSealStatusBadge
        status="signed"
        signedDocumentUrl="https://example.com/doc.pdf"
        onManualOverride={onManualOverride}
      />,
    );
    const trigger = screen.getByRole('button', { name: /signed status actions/i });
    await user.click(trigger);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole('menuitem', { name: /manual override/i })).not.toBeInTheDocument();
  });

  it('applies correct CSS classes for each status', () => {
    const { unmount } = render(<DocuSealStatusBadge status="signed" />);
    const badge = screen.getByText('Signed');
    expect(badge.className).toContain('border-emerald');
    unmount();

    render(<DocuSealStatusBadge status="declined" />);
    const declinedBadge = screen.getByText('Declined');
    expect(declinedBadge.className).toContain('border-red');
  });

  // --------------------------------------------------------------------------
  // Per-status badge variant and label tests
  // --------------------------------------------------------------------------
  describe('per-status badge variant and label', () => {
    it('pending (not_sent) renders with muted/border class and label "Not Sent"', () => {
      render(<DocuSealStatusBadge status="not_sent" />);
      const badge = screen.getByText('Not Sent');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-muted');
      expect(badge.className).toContain('text-muted-foreground');
    });

    it('sent renders with blue class and label "Sent"', () => {
      render(<DocuSealStatusBadge status="sent" />);
      const badge = screen.getByText('Sent');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('border-blue');
      expect(badge.className).toContain('text-blue');
    });

    it('signed renders with emerald class and label "Signed"', () => {
      render(<DocuSealStatusBadge status="signed" />);
      const badge = screen.getByText('Signed');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('border-emerald');
      expect(badge.className).toContain('text-emerald');
    });

    it('declined renders with red class and label "Declined"', () => {
      render(<DocuSealStatusBadge status="declined" />);
      const badge = screen.getByText('Declined');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('border-red');
      expect(badge.className).toContain('text-red');
    });
  });
});
