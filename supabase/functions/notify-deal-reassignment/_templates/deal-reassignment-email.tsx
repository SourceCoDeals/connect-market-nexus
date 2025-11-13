import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface DealReassignmentEmailProps {
  previousOwnerName: string;
  dealTitle: string;
  companyName?: string;
  listingTitle?: string;
  newOwnerName?: string;
  newOwnerEmail?: string;
  dealId: string;
  isUnassignment?: boolean;
}

export const DealReassignmentEmail = ({
  previousOwnerName,
  dealTitle,
  companyName,
  listingTitle,
  newOwnerName,
  newOwnerEmail,
  dealId,
  isUnassignment = false,
}: DealReassignmentEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {isUnassignment 
        ? `Your deal "${dealTitle}" has been unassigned`
        : `Your deal "${dealTitle}" has been reassigned to ${newOwnerName}`
      }
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Text style={headerLabel}>SOURCECO PIPELINE</Text>
          <Heading style={heading}>
            {isUnassignment ? 'Deal Unassigned' : 'Deal Reassignment'}
          </Heading>
          <Text style={headerSubtext}>
            FYI: Changes have been made to a deal you own
          </Text>
        </Section>

        {/* Alert Box */}
        <Section style={alertBox}>
          <Text style={alertText}>
            Hi {previousOwnerName}, {isUnassignment 
              ? 'your deal has been unassigned.' 
              : `your deal has been reassigned to ${newOwnerName}.`
            }
          </Text>
        </Section>

        {/* Deal Information */}
        <Section style={infoCard}>
          <Heading style={infoHeading}>Deal Information</Heading>
          
          {companyName && (
            <>
              <table style={infoTable}>
                <tr>
                  <td style={infoLabel}>Company</td>
                  <td style={infoValue}>{companyName}</td>
                </tr>
              </table>
            </>
          )}
          
          <table style={infoTable}>
            <tr>
              <td style={infoLabel}>Contact</td>
              <td style={infoValue}>{dealTitle}</td>
            </tr>
          </table>

          {listingTitle && (
            <table style={infoTable}>
              <tr>
                <td style={infoLabel}>Listing</td>
                <td style={infoValue}>{listingTitle}</td>
              </tr>
            </table>
          )}

          {!isUnassignment && newOwnerName && (
            <>
              <Hr style={divider} />
              <table style={infoTable}>
                <tr>
                  <td style={infoLabel}>Reassigned To</td>
                  <td style={infoValue}>
                    {newOwnerName}
                    {newOwnerEmail && (
                      <span style={infoValueSecondary}> • {newOwnerEmail}</span>
                    )}
                  </td>
                </tr>
              </table>
            </>
          )}
        </Section>

        {/* CTA Button */}
        <Section style={buttonContainer}>
          <Link
            style={button}
            href={`https://marketplace.sourcecodeals.com/admin/pipeline?deal=${dealId}`}
          >
            View Deal Details
          </Link>
        </Section>

        {/* Why am I getting this */}
        <Section style={infoBox}>
          <Text style={infoBoxHeading}>Why am I getting this?</Text>
          <Text style={infoBoxText}>
            You're assigned as the owner of this deal. When another admin makes changes, 
            we notify you to keep everyone in sync. This is expected behavior and doesn't 
            require any action unless you want to review the changes.
          </Text>
        </Section>

        {/* Footer */}
        <Text style={footer}>
          This is an automated notification from SourceCo Pipeline
          <br />
          <span style={footerMuted}>Deal ID: {dealId}</span>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default DealReassignmentEmail;

// Styles
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
};

const header = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  padding: '32px 24px',
  borderRadius: '8px',
  marginBottom: '24px',
};

const headerLabel = {
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.8px',
  color: '#94a3b8',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
};

const heading = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0',
  lineHeight: '1.3',
};

const headerSubtext = {
  color: '#cbd5e1',
  fontSize: '14px',
  margin: '8px 0 0 0',
};

const alertBox = {
  background: '#fef9f3',
  borderLeft: '4px solid #d7b65c',
  padding: '16px 20px',
  borderRadius: '4px',
  marginBottom: '24px',
};

const alertText = {
  margin: '0',
  color: '#78350f',
  fontWeight: '500',
  fontSize: '14px',
};

const infoCard = {
  background: '#f8fafc',
  padding: '24px',
  borderRadius: '8px',
  marginBottom: '24px',
  border: '1px solid #e2e8f0',
};

const infoHeading = {
  margin: '0 0 16px 0',
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: '700',
};

const infoTable = {
  width: '100%',
  marginBottom: '12px',
};

const infoLabel = {
  color: '#64748b',
  fontSize: '13px',
  fontWeight: '500',
  paddingRight: '16px',
  verticalAlign: 'top',
  width: '120px',
};

const infoValue = {
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: '600',
};

const infoValueSecondary = {
  color: '#64748b',
  fontWeight: '400',
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#d7b65c',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
  borderRadius: '6px',
  transition: 'background-color 0.2s ease',
};

const infoBox = {
  background: '#fffbeb',
  padding: '20px',
  borderRadius: '8px',
  marginBottom: '24px',
  border: '1px solid #fde68a',
};

const infoBoxHeading = {
  margin: '0 0 8px 0',
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '700',
};

const infoBoxText = {
  margin: '0',
  color: '#78350f',
  fontSize: '13px',
  lineHeight: '1.6',
};

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  marginTop: '24px',
};

const footerMuted = {
  color: '#cbd5e1',
  fontSize: '11px',
};
