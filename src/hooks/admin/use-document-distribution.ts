// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   use-document-distribution-types.ts    — DealDocument, TrackedLink, ReleaseLogEntry, ApprovalQueueEntry, DealDataRoomAccess
//   use-document-distribution-queries.ts  — useDealDocuments, useDealDocumentsByType, useTrackedLinks, useReleaseLog
//   use-document-distribution-mutations.ts — useGenerateTrackedLink, useRevokeTrackedLink, useLogPdfDownload, useUploadDealDocument
//   use-document-distribution-tracking.ts — useApprovalQueue, usePendingApprovalCount, useApproveMarketplaceBuyer, useDeclineMarketplaceBuyer, useDealDataRoomAccess, useGrantDataRoomAccess, useRevokeDataRoomAccess

export type {
  DealDocument,
  TrackedLink,
  ReleaseLogEntry,
  ApprovalQueueEntry,
  DealDataRoomAccess,
} from './use-document-distribution-types';

export {
  useDealDocuments,
  useDealDocumentsByType,
  useTrackedLinks,
  useReleaseLog,
} from './use-document-distribution-queries';

export {
  useGenerateTrackedLink,
  useRevokeTrackedLink,
  useLogPdfDownload,
  useUploadDealDocument,
} from './use-document-distribution-mutations';

export {
  useApprovalQueue,
  usePendingApprovalCount,
  useApproveMarketplaceBuyer,
  useDeclineMarketplaceBuyer,
  useDealDataRoomAccess,
  useGrantDataRoomAccess,
  useRevokeDataRoomAccess,
} from './use-document-distribution-tracking';
