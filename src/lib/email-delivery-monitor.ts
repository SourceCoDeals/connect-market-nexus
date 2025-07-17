
import { supabase } from '@/integrations/supabase/client';

export interface EmailDeliveryStats {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  totalRetries: number;
  deliveryRate: number;
  recentFailures: any[];
}

export class EmailDeliveryMonitor {
  /**
   * Get email delivery statistics for a given time period
   */
  static async getDeliveryStats(hoursBack: number = 24): Promise<EmailDeliveryStats> {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    try {
      const { data: logs, error } = await supabase
        .from('email_delivery_logs')
        .select('*')
        .gte('created_at', cutoffDate);
      
      if (error) {
        console.error('Failed to fetch email delivery logs:', error);
        return this.getEmptyStats();
      }
      
      const stats: EmailDeliveryStats = {
        totalSent: logs.filter(log => log.status === 'sent').length,
        totalFailed: logs.filter(log => log.status === 'failed').length,
        totalPending: logs.filter(log => log.status === 'pending').length,
        totalRetries: logs.filter(log => log.status === 'retry').length,
        deliveryRate: 0,
        recentFailures: logs.filter(log => log.status === 'failed' && log.error_message).slice(0, 10)
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
  static async getEmailLogs(email: string): Promise<any[]> {
    try {
      const { data: logs, error } = await supabase
        .from('email_delivery_logs')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Failed to fetch email logs:', error);
        return [];
      }
      
      return logs || [];
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
        .from('email_delivery_logs')
        .select('*')
        .eq('status', 'failed')
        .lt('retry_count', maxRetries)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Failed to fetch failed deliveries:', error);
        return 0;
      }
      
      let retriedCount = 0;
      
      for (const log of failedLogs || []) {
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
