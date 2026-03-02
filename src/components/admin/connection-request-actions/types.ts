/**
 * types.ts
 *
 * Shared type definitions for the ConnectionRequestActions component tree.
 */
import { User as UserType, Listing } from '@/types';

export interface ConnectionRequestActionsProps {
  user: UserType;
  listing?: Listing;
  requestId?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | 'on_hold';
  userMessage?: string;
  createdAt?: string;
  // Flag for review
  flaggedForReview?: boolean;
  flaggedByAdmin?: UserType | null;
  flaggedAssignedToAdmin?: UserType | null;
  // Legacy props — kept for call-site compatibility
  followedUp?: boolean;
  negativeFollowedUp?: boolean;
  onEmailSent?: () => void;
  onLocalStateUpdate?: (
    updatedUser: UserType,
    updatedFollowedUp?: boolean,
    updatedNegativeFollowedUp?: boolean,
  ) => void;
}

export type AccessField = 'can_view_teaser' | 'can_view_full_memo' | 'can_view_data_room';

export interface PendingAccessToggle {
  field: AccessField;
  newValue: boolean;
  label: string;
}

export interface AccessRecord {
  id: string;
  can_view_teaser: boolean;
  can_view_full_memo: boolean;
  can_view_data_room: boolean;
}

export interface AdminProfile {
  id: string;
  displayName: string;
}
