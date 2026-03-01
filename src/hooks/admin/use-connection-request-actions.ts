/**
 * use-connection-request-actions.ts
 *
 * Encapsulates NDA / fee-agreement status derivation and document-access
 * helpers originally inlined inside ConnectionRequestActions.tsx.
 *
 * Extracted from ConnectionRequestActions.tsx
 */
import { useConnectionRequestFirm } from '@/hooks/admin/use-connection-request-firm';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateAccess } from '@/hooks/admin/data-room/use-data-room';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { User as UserType } from '@/types';

export interface PendingAccessToggle {
  field: 'can_view_teaser' | 'can_view_full_memo' | 'can_view_data_room';
  newValue: boolean;
  label: string;
}

export function useConnectionRequestActionsState(
  user: UserType,
  listingId: string | undefined,
  requestId: string | undefined,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateAccess = useUpdateAccess();
  const { data: firmInfo } = useConnectionRequestFirm(requestId || null);

  const [pendingAccessToggle, setPendingAccessToggle] = useState<PendingAccessToggle | null>(null);

  // Fetch current data room access for this buyer + listing
  const { data: accessRecord } = useQuery({
    queryKey: ['buyer-access', listingId, user.id],
    queryFn: async () => {
      if (!listingId) return null;
      const { data, error } = await supabase
        .from('data_room_access')
        .select('id, can_view_teaser, can_view_full_memo, can_view_data_room')
        .eq('deal_id', listingId)
        .eq('marketplace_user_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!listingId,
  });

  // ── Derived status ──
  const hasFeeAgreement = firmInfo?.fee_agreement_signed || user.fee_agreement_signed || false;
  const hasNDA = firmInfo?.nda_signed || user.nda_signed || false;
  const ndaStatus =
    firmInfo?.nda_status ||
    (user.nda_signed ? 'signed' : user.nda_email_sent ? 'sent' : 'not_started');
  const feeStatus =
    firmInfo?.fee_agreement_status ||
    (user.fee_agreement_signed ? 'signed' : user.fee_agreement_email_sent ? 'sent' : 'not_started');

  // ── Access toggle logic ──

  const requestAccessToggle = (
    field: 'can_view_teaser' | 'can_view_full_memo' | 'can_view_data_room',
    newValue: boolean,
  ) => {
    if (!listingId) return;
    if (
      (field === 'can_view_full_memo' || field === 'can_view_data_room') &&
      newValue &&
      !hasFeeAgreement
    ) {
      toast({
        title: 'Fee Agreement Required',
        description:
          'A signed fee agreement is required before releasing the full memo or data room access.',
        variant: 'destructive',
      });
      return;
    }
    const labels: Record<string, string> = {
      can_view_teaser: 'Teaser',
      can_view_full_memo: 'Full Memo',
      can_view_data_room: 'Data Room',
    };
    setPendingAccessToggle({ field, newValue, label: labels[field] });
  };

  const confirmAccessToggle = () => {
    if (!pendingAccessToggle || !listingId) return;
    const { field, newValue } = pendingAccessToggle;
    updateAccess.mutate(
      {
        deal_id: listingId,
        marketplace_user_id: user.id,
        can_view_teaser:
          field === 'can_view_teaser' ? newValue : (accessRecord?.can_view_teaser ?? false),
        can_view_full_memo:
          field === 'can_view_full_memo' ? newValue : (accessRecord?.can_view_full_memo ?? false),
        can_view_data_room:
          field === 'can_view_data_room' ? newValue : (accessRecord?.can_view_data_room ?? false),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['buyer-access', listingId, user.id],
          });
        },
      },
    );
    setPendingAccessToggle(null);
  };

  return {
    firmInfo,
    accessRecord,
    hasFeeAgreement,
    hasNDA,
    ndaStatus,
    feeStatus,
    updateAccess,
    pendingAccessToggle,
    setPendingAccessToggle,
    requestAccessToggle,
    confirmAccessToggle,
  };
}
