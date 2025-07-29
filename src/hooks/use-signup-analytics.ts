import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignupStep {
  stepName: string;
  stepOrder: number;
  timeSpent?: number;
  formData?: Record<string, any>;
  dropOffReason?: string;
}

export const useSignupAnalytics = (sessionId: string, email?: string) => {
  const trackStep = async (step: SignupStep) => {
    try {
      await supabase.from('registration_funnel').insert({
        session_id: sessionId,
        email,
        step_name: step.stepName,
        step_order: step.stepOrder,
        time_spent: step.timeSpent,
        form_data: step.formData,
        dropped_off: false
      });
    } catch (error) {
      console.error('Error tracking signup step:', error);
    }
  };

  const trackDropOff = async (step: SignupStep) => {
    try {
      await supabase.from('registration_funnel').insert({
        session_id: sessionId,
        email,
        step_name: step.stepName,
        step_order: step.stepOrder,
        time_spent: step.timeSpent,
        form_data: step.formData,
        dropped_off: true,
        drop_off_reason: step.dropOffReason
      });
    } catch (error) {
      console.error('Error tracking signup drop-off:', error);
    }
  };

  const trackCompletion = async () => {
    try {
      await supabase.from('registration_funnel').insert({
        session_id: sessionId,
        email,
        step_name: 'completed',
        step_order: 999,
        dropped_off: false
      });
    } catch (error) {
      console.error('Error tracking signup completion:', error);
    }
  };

  return {
    trackStep,
    trackDropOff,
    trackCompletion
  };
};