import { supabase } from '@/integrations/supabase/client';

export type DealActivityType =
  | 'stage_change'
  | 'nda_status_changed'
  | 'nda_email_sent'
  | 'fee_agreement_status_changed'
  | 'fee_agreement_email_sent'
  | 'task_created'
  | 'task_completed'
  | 'task_assigned'
  | 'assignment_changed'
  | 'deal_updated'
  | 'deal_created'
  | 'deal_deleted'
  | 'deal_restored'
  | 'follow_up';

interface LogActivityParams {
  dealId: string;
  activityType: DealActivityType;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function logDealActivity({
  dealId,
  activityType,
  title,
  description,
  metadata = {},
}: LogActivityParams): Promise<void> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;

    const { error } = await supabase.from('deal_activities').insert({
      deal_id: dealId,
      admin_id: user?.id,
      activity_type: activityType,
      title,
      description,
      metadata: metadata as unknown,
    } as never);

    if (error) {
      console.error('Failed to log deal activity:', error);
    }
  } catch (error) {
    console.error('Error logging deal activity:', error);
  }
}
