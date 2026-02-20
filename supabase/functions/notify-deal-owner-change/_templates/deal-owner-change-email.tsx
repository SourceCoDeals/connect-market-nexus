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
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';

interface DealOwnerChangeEmailProps {
  previousOwnerName: string;
  modifyingAdminName: string;
  modifyingAdminEmail?: string;
  dealTitle: string;
  companyName?: string;
  listingTitle?: string;
  oldStageName: string;
  newStageName: string;
  dealId: string;
}

export const DealOwnerChangeEmail = ({
  previousOwnerName,
  modifyingAdminName,
  modifyingAdminEmail,
  dealTitle,
  companyName,
  listingTitle,
  oldStageName,
  newStageName,
  dealId,
}: DealOwnerChangeEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {modifyingAdminName} modified your deal - {companyName || dealTitle}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Text style={headerLabel}>SOURCECO PIPELINE</Text>
          <Heading style={heading}>Deal Modified by Admin</Heading>
          <Text style={headerSubtext}>
            FYI: Changes have been made to a deal you own
          </Text>
        </Section>

        {/* Alert Box */}
        <Section style={alertBox}>
          <Text style={alertText}>
            Hi {previousOwnerName}, {modifyingAdminName} has made changes to a deal you own.
          </Text>
        </Section>

        {/* Deal Information */}
        <Section style={infoCard}>
          <Heading style={infoHeading}>Deal Information</Heading>
          
          {companyName && (
            <Row style={infoRow}>
              <Column style={infoLabelColumn}>
                <Text style={infoLabelText}>Company</Text>
              </Column>
              <Column style={infoValueColumn}>
                <Text style={infoValueText}>{companyName}</Text>
              </Column>
            </Row>
          )}
          
          <Row style={infoRow}>
            <Column style={infoLabelColumn}>
              <Text style={infoLabelText}>Contact</Text>
            </Column>
            <Column style={infoValueColumn}>
              <Text style={infoValueText}>{dealTitle}</Text>
            </Column>
          </Row>

          {listingTitle && (
            <Row style={infoRow}>
              <Column style={infoLabelColumn}>
                <Text style={infoLabelText}>Listing</Text>
              </Column>
              <Column style={infoValueColumn}>
                <Text style={infoValueText}>{listingTitle}</Text>
              </Column>
            </Row>
          )}

          <Row style={infoRow}>
            <Column style={infoLabelColumn}>
              <Text style={infoLabelText}>Modified By</Text>
            </Column>
            <Column style={infoValueColumn}>
              <Text style={infoValueText}>
                {modifyingAdminName}{modifyingAdminEmail ? ` • ${modifyingAdminEmail}` : ''}
              </Text>
            </Column>
          </Row>

          {oldStageName !== newStageName ? (
            <Row style={infoRow}>
              <Column style={infoLabelColumn}>
                <Text style={infoLabelText}>Stage Change</Text>
              </Column>
              <Column style={infoValueColumn}>
                <Text style={infoValueText}>
                  <Text style={stageOld}>{oldStageName}</Text>
                  <Text style={stageArrow}> → </Text>
                  <Text style={stageNew}>{newStageName}</Text>
                </Text>
              </Column>
            </Row>
          ) : (
            <Row style={infoRow}>
              <Column style={infoLabelColumn}>
                <Text style={infoLabelText}>Change Type</Text>
              </Column>
              <Column style={infoValueColumn}>
                <Text style={stageNew}>Owner Reassignment</Text>
              </Column>
            </Row>
          )}
        </Section>

        {/* CTA Button */}
        <Section style={buttonContainer}>
          <Link
            style={button}
            href={`https://marketplace.sourcecodeals.com/admin/deals/pipeline?deal=${dealId}`}
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
        <Section style={footerSection}>
          <Text style={footerText}>
            This is an automated notification from SourceCo Pipeline
          </Text>
          <Text style={footerMuted}>Deal ID: {dealId}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default DealOwnerChangeEmail;

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
  background: '#eff6ff',
  borderLeft: '4px solid #3b82f6',
  padding: '16px 20px',
  borderRadius: '4px',
  marginBottom: '24px',
};

const alertText = {
  margin: '0',
  color: '#1e40af',
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

const infoRow = {
  marginBottom: '12px',
};

const infoLabelColumn = {
  width: '120px',
  verticalAlign: 'top' as const,
};

const infoValueColumn = {
  verticalAlign: 'top' as const,
};

const infoLabelText = {
  color: '#64748b',
  fontSize: '13px',
  fontWeight: '500',
  margin: '0',
};

const infoValueText = {
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
};

const stageOld = {
  color: '#64748b',
  background: '#f1f5f9',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '13px',
  margin: '0',
  display: 'inline' as const,
};

const stageArrow = {
  color: '#94a3b8',
  margin: '0 8px',
  display: 'inline' as const,
};

const stageNew = {
  color: '#0f172a',
  background: '#d7b65c',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0',
  display: 'inline' as const,
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

const footerSection = {
  textAlign: 'center' as const,
  marginTop: '24px',
  borderTop: '1px solid #e2e8f0',
  paddingTop: '24px',
};

const footerText = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 4px 0',
};

const footerMuted = {
  color: '#cbd5e1',
  fontSize: '11px',
  margin: '0',
};
