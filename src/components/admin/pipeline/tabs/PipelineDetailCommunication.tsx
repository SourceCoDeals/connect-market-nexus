import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Mail, Send, Clock, Check, User, Calendar } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDealEmails } from '@/hooks/admin/use-deal-emails';

interface PipelineDetailCommunicationProps {
  deal: Deal;
}

export function PipelineDetailCommunication({ deal }: PipelineDetailCommunicationProps) {
  const [showCompose, setShowCompose] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data: realEmailHistory = [], refetch: refetchEmails } = useDealEmails(deal.deal_id);

  const handleSendEmail = async () => {
    if (!deal.contact_email || !emailData.subject.trim() || !emailData.message.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      // Use the enhanced email delivery edge function
      const { error } = await supabase.functions.invoke('enhanced-email-delivery', {
        body: {
          to: deal.contact_email,
          subject: emailData.subject,
          content: emailData.message,
          email_type: 'custom',
          correlation_id: `deal-${deal.deal_id}-${Date.now()}`,
          metadata: {
            deal_id: deal.deal_id,
            deal_title: deal.deal_title,
            contact_name: deal.contact_name
          }
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Email Sent',
        description: `Email sent successfully to ${deal.contact_email}`,
      });
      
      setEmailData({ subject: '', message: '' });
      setShowCompose(false);
      
      // Refresh email history
      setTimeout(() => refetchEmails(), 1000);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to send email: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Use real email history from the database
  const emailHistory = realEmailHistory.map(email => ({
    id: email.id,
    type: email.email_type,
    subject: `Email to ${deal.contact_name || deal.contact_email}`,
    sent_at: email.sent_at,
    status: email.status,
    sent_by: 'Admin' // Could be enhanced to show actual admin name
  }));

  const getEmailTypeIcon = (type: string) => {
    switch (type) {
      case 'nda':
      case 'fee_agreement':
        return '📄';
      case 'followup':
        return '🔄';
      default:
        return '✉️';
    }
  };

  const getEmailTypeBadge = (type: string) => {
    switch (type) {
      case 'nda':
        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">NDA</Badge>;
      case 'fee_agreement':
        return <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Fee Agreement</Badge>;
      case 'followup':
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Follow-up</Badge>;
      default:
        return <Badge variant="outline" className="text-xs border-border/60">Custom</Badge>;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Email Stats - Clean Apple Style */}
        <div className="border-l border-border/20 pl-4">
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center space-y-1">
              <div className="text-2xl font-light text-foreground">{emailHistory.length}</div>
              <div className="text-xs text-muted-foreground/70">Total Emails</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-light text-emerald-600">
                {emailHistory.filter(e => e.status === 'delivered').length}
              </div>
              <div className="text-xs text-muted-foreground/70">Delivered</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-light text-muted-foreground">
                {emailHistory.filter(e => e.type === 'nda' || e.type === 'fee_agreement').length}
              </div>
              <div className="text-xs text-muted-foreground/70">Documents</div>
            </div>
          </div>
        </div>

        {/* Compose Email - Clean */}
        <div className="border-l border-border/20 pl-4 space-y-4">
          {!showCompose ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Send Email</h4>
                <Badge variant="outline" className="text-xs border-border/40">
                  To: {deal.contact_email || 'No email available'}
                </Badge>
              </div>
              
              <Button 
                onClick={() => setShowCompose(true)}
                disabled={!deal.contact_email}
                className="w-full justify-start gap-2 h-9"
                variant="outline"
              >
                <Mail className="h-4 w-4" />
                Compose Email
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Compose Email</h4>
                <Badge variant="outline" className="text-xs border-border/40">
                  To: {deal.contact_email}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <Input
                  placeholder="Email subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                />
                
                <Textarea
                  placeholder={`Hi ${deal.contact_name || 'there'},\n\nI wanted to follow up regarding the ${deal.listing_title} opportunity...\n\nBest regards`}
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  rows={8}
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleSendEmail}
                  disabled={!emailData.subject.trim() || !emailData.message.trim() || isLoading}
                  size="sm"
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {isLoading ? 'Sending...' : 'Send Email'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCompose(false)}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Email Templates - Clean */}
        <div className="border-l border-border/20 pl-4 space-y-4">
          <h4 className="font-medium text-sm">Quick Templates</h4>
          
          <div className="grid grid-cols-1 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setEmailData({
                  subject: `Follow-up on ${deal.listing_title}`,
                  message: `Hi ${deal.contact_name || 'there'},\n\nI wanted to follow up on your interest in the ${deal.listing_title} opportunity. Do you have any questions about the investment details?\n\nBest regards`
                });
                setShowCompose(true);
              }}
              className="justify-start text-xs h-8"
            >
              📞 Follow-up Template
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setEmailData({
                  subject: `Additional Information - ${deal.listing_title}`,
                  message: `Hi ${deal.contact_name || 'there'},\n\nI'm attaching additional information about the ${deal.listing_title} opportunity as requested.\n\nPlease let me know if you need any clarification.\n\nBest regards`
                });
                setShowCompose(true);
              }}
              className="justify-start text-xs h-8"
            >
              📎 Information Sharing Template
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setEmailData({
                  subject: `Schedule a Call - ${deal.listing_title}`,
                  message: `Hi ${deal.contact_name || 'there'},\n\nWould you be available for a call this week to discuss the ${deal.listing_title} opportunity in more detail?\n\nI'm available at your convenience.\n\nBest regards`
                });
                setShowCompose(true);
              }}
              className="justify-start text-xs h-8"
            >
              📅 Meeting Request Template
            </Button>
          </div>
        </div>

        {/* Email History - Clean */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Email History</h4>
          
          {emailHistory.length === 0 ? (
            <div className="border-l border-border/20 pl-4 py-6">
              <div className="text-center text-muted-foreground/70">
                <Mail className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No emails sent yet</p>
                <p className="text-xs mt-1">Send your first email to get started</p>
              </div>
            </div>
          ) : (
            <div className="border-l border-border/20 pl-4 space-y-3">
              {emailHistory.map((email) => (
                <div key={email.id} className="p-3 bg-muted/20 rounded-lg border border-border/10">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-sm">{getEmailTypeIcon(email.type)}</div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium text-sm">{email.subject}</h5>
                            {getEmailTypeBadge(email.type)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Sent by {email.sent_by}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDistanceToNow(new Date(email.sent_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {email.status === 'delivered' ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-600" />
                        )}
                        <Badge variant="outline" className={`text-xs ${
                          email.status === 'delivered' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {email.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}