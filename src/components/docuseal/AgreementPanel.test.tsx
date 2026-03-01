import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AgreementPanel } from './AgreementPanel';
import type { FirmAgreement } from '@/hooks/admin/use-firm-agreements';

// Mock DocuSeal hooks
vi.mock('@/hooks/admin/use-docuseal', () => ({
  useCreateDocuSealSubmission: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const baseFirm: FirmAgreement = {
  id: 'firm-1',
  normalized_company_name: 'test corp',
  primary_company_name: 'Test Corp',
  website_domain: null,
  email_domain: null,
  company_name_variations: [],
  fee_agreement_signed: false,
  fee_agreement_signed_at: null,
  fee_agreement_signed_by: null,
  fee_agreement_signed_by_name: null,
  fee_agreement_email_sent: false,
  fee_agreement_email_sent_at: null,
  nda_signed: false,
  nda_signed_at: null,
  nda_signed_by: null,
  nda_signed_by_name: null,
  nda_email_sent: false,
  nda_email_sent_at: null,
  nda_status: 'not_started',
  fee_agreement_status: 'not_started',
  fee_agreement_scope: 'blanket',
  fee_agreement_deal_id: null,
  nda_expires_at: null,
  fee_agreement_expires_at: null,
  nda_document_url: null,
  fee_agreement_document_url: null,
  nda_redline_notes: null,
  fee_agreement_redline_notes: null,
  nda_redline_document_url: null,
  fee_agreement_redline_document_url: null,
  nda_custom_terms: null,
  fee_agreement_custom_terms: null,
  nda_inherited_from_firm_id: null,
  fee_inherited_from_firm_id: null,
  nda_sent_at: null,
  fee_agreement_sent_at: null,
  nda_docuseal_submission_id: null,
  nda_docuseal_status: null,
  nda_signed_document_url: null,
  fee_docuseal_submission_id: null,
  fee_docuseal_status: null,
  fee_signed_document_url: null,
  member_count: 1,
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('AgreementPanel', () => {
  it('renders NDA and Fee Agreement sections', () => {
    render(<AgreementPanel firm={baseFirm} />);
    expect(screen.getByText('NDA')).toBeInTheDocument();
    expect(screen.getByText('Fee Agreement')).toBeInTheDocument();
    expect(screen.getByText('Agreements')).toBeInTheDocument();
  });

  it('shows "Send NDA" button when NDA is not signed', () => {
    render(<AgreementPanel firm={baseFirm} />);
    expect(screen.getByText('Send NDA')).toBeInTheDocument();
  });

  it('shows "Send Fee Agreement" button when fee agreement is not signed', () => {
    render(<AgreementPanel firm={baseFirm} />);
    expect(screen.getByText('Send Fee Agreement')).toBeInTheDocument();
  });

  it('hides "Send NDA" button when NDA is signed', () => {
    const signedFirm = {
      ...baseFirm,
      nda_signed: true,
      nda_signed_at: '2026-01-15T00:00:00Z',
    };
    render(<AgreementPanel firm={signedFirm} />);
    expect(screen.queryByText('Send NDA')).not.toBeInTheDocument();
  });

  it('hides "Send Fee Agreement" button when fee agreement is signed', () => {
    const signedFirm = {
      ...baseFirm,
      fee_agreement_signed: true,
      fee_agreement_signed_at: '2026-01-15T00:00:00Z',
    };
    render(<AgreementPanel firm={signedFirm} />);
    expect(screen.queryByText('Send Fee Agreement')).not.toBeInTheDocument();
  });

  it('shows signed-by name and relative time when NDA is signed', () => {
    const signedFirm = {
      ...baseFirm,
      nda_signed: true,
      nda_signed_at: new Date().toISOString(),
      nda_signed_by_name: 'John Doe',
    };
    render(<AgreementPanel firm={signedFirm} />);
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('shows Download button when signed document URL exists', () => {
    const signedFirm = {
      ...baseFirm,
      nda_signed: true,
      nda_signed_at: '2026-01-15T00:00:00Z',
      nda_signed_document_url: 'https://docuseal.com/docs/signed.pdf',
    };
    render(<AgreementPanel firm={signedFirm} />);
    const downloadButtons = screen.getAllByText('Download');
    expect(downloadButtons.length).toBeGreaterThan(0);
  });

  it('shows DocuSealStatusBadge with correct status', () => {
    const firmWithStatus = {
      ...baseFirm,
      nda_docuseal_status: 'sent',
    };
    render(<AgreementPanel firm={firmWithStatus} />);
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('opens SendAgreementDialog when Send NDA is clicked', async () => {
    render(<AgreementPanel firm={baseFirm} buyerEmail="buyer@test.com" buyerName="Test Buyer" />);
    fireEvent.click(screen.getByText('Send NDA'));
    // The dialog should open — look for dialog-specific content (e.g. "Signing Method" radio group)
    expect(await screen.findByText(/Signing Method/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Signed status hides send buttons completely
  // --------------------------------------------------------------------------
  describe('when NDA status is "signed"', () => {
    it('hides Send NDA button and shows Signed badge', () => {
      const signedFirm = {
        ...baseFirm,
        nda_signed: true,
        nda_signed_at: '2026-01-15T00:00:00Z',
        nda_docuseal_status: 'signed',
      };
      render(<AgreementPanel firm={signedFirm} />);
      expect(screen.queryByText('Send NDA')).not.toBeInTheDocument();
      expect(screen.getByText('Signed')).toBeInTheDocument();
    });

    it('hides Send Fee Agreement button when fee agreement is signed', () => {
      const signedFirm = {
        ...baseFirm,
        fee_agreement_signed: true,
        fee_agreement_signed_at: '2026-01-15T00:00:00Z',
        fee_docuseal_status: 'signed',
      };
      render(<AgreementPanel firm={signedFirm} />);
      expect(screen.queryByText('Send Fee Agreement')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Pending status shows send buttons and correct badge
  // --------------------------------------------------------------------------
  describe('when status is "pending" (not_sent)', () => {
    it('shows Send NDA button when NDA is not signed', () => {
      const pendingFirm = {
        ...baseFirm,
        nda_signed: false,
        nda_docuseal_status: null,
      };
      render(<AgreementPanel firm={pendingFirm} />);
      expect(screen.getByText('Send NDA')).toBeInTheDocument();
      // Badge shows "Not Sent" for null status
      expect(screen.getAllByText('Not Sent').length).toBeGreaterThan(0);
    });

    it('shows Send Fee Agreement button when fee agreement is pending', () => {
      const pendingFirm = {
        ...baseFirm,
        fee_agreement_signed: false,
        fee_docuseal_status: null,
      };
      render(<AgreementPanel firm={pendingFirm} />);
      expect(screen.getByText('Send Fee Agreement')).toBeInTheDocument();
    });

    it('shows "Sent" badge when NDA has been sent but not yet signed', () => {
      const sentFirm = {
        ...baseFirm,
        nda_signed: false,
        nda_docuseal_status: 'sent',
      };
      render(<AgreementPanel firm={sentFirm} />);
      expect(screen.getByText('Sent')).toBeInTheDocument();
      // Send NDA button should still be present (as resend)
      expect(screen.getByText('Send NDA')).toBeInTheDocument();
    });
  });
});
