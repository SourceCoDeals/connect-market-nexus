import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDate } from '@/lib/utils';
import { Mail, Send, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DealCommunicationTabProps {
  deal: Deal;
}

// Mock email history data
const mockEmails = [
  {
    id: '1',
    subject: 'Follow-up on Investment Opportunity',
    to: 'buyer@example.com',
    from: 'admin@sourceco.com',
    body: 'Thank you for your interest in this opportunity. I wanted to follow up...',
    sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'sent',
    type: 'follow_up'
  },
  {
    id: '2',
    subject: 'NDA Document - Next Steps',
    to: 'buyer@example.com',
    from: 'admin@sourceco.com',
    body: 'Please find attached the NDA document for your review...',
    sent_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: 'opened',
    type: 'nda'
  },
  {
    id: '3',
    subject: 'Investment Opportunity Introduction',
    to: 'buyer@example.com',
    from: 'admin@sourceco.com',
    body: 'I hope this email finds you well. I wanted to introduce you to an exciting...',
    sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: 'replied',
    type: 'introduction'
  }
];

export function DealCommunicationTab({ deal }: DealCommunicationTabProps) {
  const { toast } = useToast();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState({
    to: deal.contact_email || '',
    subject: '',
    body: ''
  });

  const handleSendEmail = async () => {
    if (!newEmail.to || !newEmail.subject || !newEmail.body) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      // Here we would call the email sending API
      console.log('Sending email:', newEmail);
      
      toast({
        title: "Success",
        description: "Email sent successfully"
      });
      
      setNewEmail({
        to: deal.contact_email || '',
        subject: '',
        body: ''
      });
      setIsComposeOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'opened':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'replied':
        return <Mail className="h-4 w-4 text-purple-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'opened':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'replied':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'nda':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'fee_agreement':
        return 'bg-violet-100 text-violet-800 border-violet-200';
      case 'follow_up':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'introduction':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Communication</h2>
          <p className="text-sm text-gray-600 mt-1">
            Email history and communication with {deal.contact_name || 'the buyer'}
          </p>
        </div>
        
        <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gray-900 hover:bg-gray-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Compose Email
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Compose Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">To</label>
                <Input
                  value={newEmail.to}
                  onChange={(e) => setNewEmail({ ...newEmail, to: e.target.value })}
                  placeholder="recipient@example.com"
                  className="border-gray-200"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Subject</label>
                <Input
                  value={newEmail.subject}
                  onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                  placeholder="Email subject"
                  className="border-gray-200"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Message</label>
                <Textarea
                  value={newEmail.body}
                  onChange={(e) => setNewEmail({ ...newEmail, body: e.target.value })}
                  placeholder="Compose your message..."
                  className="border-gray-200 resize-none min-h-[200px]"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button onClick={handleSendEmail} className="flex-1 bg-gray-900 hover:bg-gray-800">
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button variant="outline" onClick={() => setIsComposeOpen(false)} className="border-gray-200">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Email Templates */}
      <Card className="border-0 shadow-sm bg-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="justify-start border-gray-200 hover:bg-gray-100"
              onClick={() => {
                setNewEmail({
                  to: deal.contact_email || '',
                  subject: 'Follow-up on Your Investment Interest',
                  body: `Hi ${deal.contact_name || 'there'},\n\nI wanted to follow up on your interest in this investment opportunity...\n\nBest regards,`
                });
                setIsComposeOpen(true);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Follow-up Email
            </Button>
            
            <Button
              variant="outline"
              className="justify-start border-gray-200 hover:bg-gray-100"
              onClick={() => {
                setNewEmail({
                  to: deal.contact_email || '',
                  subject: 'NDA Documentation Required',
                  body: `Hi ${deal.contact_name || 'there'},\n\nTo proceed with this opportunity, we'll need you to review and sign the attached NDA...\n\nBest regards,`
                });
                setIsComposeOpen(true);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              NDA Email
            </Button>
            
            <Button
              variant="outline"
              className="justify-start border-gray-200 hover:bg-gray-100"
              onClick={() => {
                setNewEmail({
                  to: deal.contact_email || '',
                  subject: 'Investment Opportunity Update',
                  body: `Hi ${deal.contact_name || 'there'},\n\nI have an update regarding the investment opportunity we discussed...\n\nBest regards,`
                });
                setIsComposeOpen(true);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Status Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="h-5 w-5 text-gray-600" />
            Email History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {mockEmails.map((email) => (
              <div key={email.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{email.subject}</h3>
                      <Badge className={`${getStatusColor(email.status)} text-xs`}>
                        {getStatusIcon(email.status)}
                        <span className="ml-1">{email.status}</span>
                      </Badge>
                      <Badge className={`${getTypeColor(email.type)} text-xs`}>
                        {email.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>To:</strong> {email.to} • <strong>From:</strong> {email.from}
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {email.body}
                    </p>
                    
                    <div className="text-xs text-gray-500">
                      Sent {formatDate(email.sent_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {mockEmails.length === 0 && (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No emails yet</h3>
              <p className="text-gray-600 mb-4">Start communicating with the buyer</p>
              <Button 
                onClick={() => setIsComposeOpen(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Send First Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}