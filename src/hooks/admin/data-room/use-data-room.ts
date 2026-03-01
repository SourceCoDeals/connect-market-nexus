// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   use-data-room-types.ts        — DataRoomDocument, DataRoomAccessRecord, LeadMemo, DistributionLogEntry, AuditLogEntry
//   use-data-room-documents.ts    — useDataRoomDocuments, useUploadDocument, useDeleteDocument, useDocumentUrl
//   use-data-room-access.ts       — useDataRoomAccess, useUpdateAccess, useRevokeAccess, useBulkUpdateAccess, useDataRoomAuditLog, useBuyerDealHistory
//   use-data-room-distribution.ts — useLeadMemos, useGenerateMemo, useUpdateMemo, usePublishMemo, useDistributionLog, useLogManualSend, useDraftOutreachEmail, useSendMemoEmail

export type {
  DataRoomDocument,
  DataRoomAccessRecord,
  LeadMemo,
  DistributionLogEntry,
  AuditLogEntry,
} from './use-data-room-types';

export {
  useDataRoomDocuments,
  useUploadDocument,
  useDeleteDocument,
  useDocumentUrl,
} from './use-data-room-documents';

export {
  useDataRoomAccess,
  useUpdateAccess,
  useRevokeAccess,
  useBulkUpdateAccess,
  useDataRoomAuditLog,
  useBuyerDealHistory,
} from './use-data-room-access';

export {
  useLeadMemos,
  useGenerateMemo,
  useUpdateMemo,
  usePublishMemo,
  useDistributionLog,
  useLogManualSend,
  useDraftOutreachEmail,
  useSendMemoEmail,
} from './use-data-room-distribution';
