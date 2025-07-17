import { useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  emailProvider?: string;
}

export function useEmailDeliveryMonitoring() {
  const [emailStatus, setEmailStatus] = useState<Record<string, EmailDeliveryResult>>({});
  const { toast } = useToast();

  const trackEmailDelivery = useCallback((correlationId: string, result: EmailDeliveryResult) => {
    setEmailStatus(prev => ({
      ...prev,
      [correlationId]: result
    }));

    if (!result.success) {
      console.error('📧 Email delivery failed:', result.error);
      toast({
        variant: 'destructive',
        title: 'Email delivery failed',
        description: result.error || 'Failed to send email notification',
      });
    } else {
      console.log('📧 Email delivered successfully:', result.messageId);
    }
  }, [toast]);

  const getEmailStatus = useCallback((correlationId: string) => {
    return emailStatus[correlationId];
  }, [emailStatus]);

  const clearEmailStatus = useCallback((correlationId: string) => {
    setEmailStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[correlationId];
      return newStatus;
    });
  }, []);

  return {
    trackEmailDelivery,
    getEmailStatus,
    clearEmailStatus,
    emailStatus
  };
}