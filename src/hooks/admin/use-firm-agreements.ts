// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   use-firm-agreements-types.ts  — FirmAgreement, FirmMember, AgreementStatus, AgreementSource, AgreementScope, UpdateAgreementStatusParams, AgreementAuditEntry
//   use-firm-agreements-nda.ts    — useUpdateFirmNDA
//   use-firm-agreements-fee.ts    — useUpdateFirmFeeAgreement
//   use-firm-agreements-shared.ts — useFirmAgreements, useFirmMembers, useAllFirmMembersForSearch, useUpdateAgreementStatus, useAgreementAuditLog, useFirmDomainAliases, useAddDomainAlias, useRemoveDomainAlias

export type {
  AgreementStatus,
  AgreementSource,
  AgreementScope,
  FirmAgreement,
  FirmMember,
  UpdateAgreementStatusParams,
  AgreementAuditEntry,
} from './use-firm-agreements-types';

export { useUpdateFirmNDA } from './use-firm-agreements-nda';
export { useUpdateFirmFeeAgreement } from './use-firm-agreements-fee';

export {
  useFirmAgreements,
  useFirmMembers,
  useAllFirmMembersForSearch,
  useUpdateAgreementStatus,
  useAgreementAuditLog,
  useFirmDomainAliases,
  useAddDomainAlias,
  useRemoveDomainAlias,
} from './use-firm-agreements-shared';
