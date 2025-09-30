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
  | 'follow_up';

interface LogActivityParams {
  dealId: string;
  activityType: DealActivityType;
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

export async function logDealActivity({
  dealId,
  activityType,
  title,
  description,
  metadata = {}
}: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('deal_activities')
      .insert({
        deal_id: dealId,
        admin_id: user?.id,
        activity_type: activityType,
        title,
        description,
        metadata
      });

    if (error) {
      console.error('Failed to log deal activity:', error);
    }
  } catch (error) {
    console.error('Error logging deal activity:', error);
  }
}
