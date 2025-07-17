
import { supabase } from '@/integrations/supabase/client';

export interface EmailDeliveryStats {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  totalRetries: number;
  deliveryRate: number;
  recentFailures: any[];
}

interface EmailDeliveryLogRow {
  id: string;
  email: string;
  email_type: string;
  status: 'pending' | 'sent' | 'failed' | 'retry';
  retry_count: number;
  max_retries: number;
  correlation_id: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export class EmailDeliveryMonitor {
  /**
   * Get email delivery statistics for a given time period
   */
  static async getDeliveryStats(hoursBack: number = 24): Promise<EmailDeliveryStats> {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    try {
      // Use rpc or direct query to avoid TypeScript issues
      const { data: logs, error } = await supabase
        .from('email_delivery_logs' as any)
        .select('*')
        .gte('created_at', cutoffDate);
      
      if (error) {
        console.error('Failed to fetch email delivery logs:', error);
        return this.getEmptyStats();
      }
      
      const typedLogs = logs as EmailDeliveryLogRow[];
      
      const stats: EmailDeliveryStats = {
        totalSent: typedLogs.filter(log => log.status === 'sent').length,
        totalFailed: typedLogs.filter(log => log.status === 'failed').length,
        totalPending: typedLogs.filter(log => log.status === 'pending').length,
        totalRetries: typedLogs.filter(log => log.status === 'retry').length,
        deliveryRate: 0,
        recentFailures: typedLogs.filter(log => log.status === 'failed' && log.error_message).slice(0, 10)
      };
      
      const totalAttempts = stats.totalSent + stats.totalFailed;
      stats.deliveryRate = totalAttempts > 0 ? (stats.totalSent / totalAttempts) * 100 : 0;
      
      return stats;
    } catch (error) {
      console.error('Error getting email delivery stats:', error);
      return this.getEmptyStats();
    }
  }
  
  /**
   * Check if email delivery is healthy
   */
  static async isDeliveryHealthy(hoursBack: number = 24): Promise<boolean> {
    const stats = await this.getDeliveryStats(hoursBack);
    
    // Consider delivery healthy if:
    // - Delivery rate is above 90%
    // - No more than 5 recent failures
    return stats.deliveryRate >= 90 && stats.recentFailures.length <= 5;
  }
  
  /**
   * Get email delivery logs for a specific email
   */
  static async getEmailLogs(email: string): Promise<EmailDeliveryLogRow[]> {
    try {
      const { data: logs, error } = await supabase
        .from('email_delivery_logs' as any)
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Failed to fetch email logs:', error);
        return [];
      }
      
      return (logs as EmailDeliveryLogRow[]) || [];
    } catch (error) {
      console.error('Error getting email logs:', error);
      return [];
    }
  }
  
  /**
   * Retry failed email deliveries
   */
  static async retryFailedDeliveries(maxRetries: number = 3): Promise<number> {
    try {
      const { data: failedLogs, error } = await supabase
        .from('email_delivery_logs' as any)
        .select('*')
        .eq('status', 'failed')
        .lt('retry_count', maxRetries)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Failed to fetch failed deliveries:', error);
        return 0;
      }
      
      const typedLogs = failedLogs as EmailDeliveryLogRow[];
      let retriedCount = 0;
      
      for (const log of typedLogs || []) {
        try {
          // Retry the email delivery
          await supabase.functions.invoke('enhanced-email-delivery', {
            body: {
              type: log.email_type,
              recipientEmail: log.email,
              recipientName: 'User', // Default name
              correlationId: log.correlation_id,
              retryCount: log.retry_count,
              maxRetries: log.max_retries,
              priority: 'medium'
            }
          });
          
          retriedCount++;
        } catch (error) {
          console.error(`Failed to retry email ${log.id}:`, error);
        }
      }
      
      return retriedCount;
    } catch (error) {
      console.error('Error retrying failed deliveries:', error);
      return 0;
    }
  }
  
  private static getEmptyStats(): EmailDeliveryStats {
    return {
      totalSent: 0,
      totalFailed: 0,
      totalPending: 0,
      totalRetries: 0,
      deliveryRate: 0,
      recentFailures: []
    };
  }
}
