import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertTriangle, CheckCircle, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UnverifiedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export const BulkVerificationEmailSender = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedUsers, setUnverifiedUsers] = useState<UnverifiedUser[]>([]);
  const [sentEmails, setSentEmails] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{sent: number, failed: number, total: number}>({sent: 0, failed: 0, total: 0});
  const { toast } = useToast();

  const fetchUnverifiedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, created_at')
        .eq('email_verified', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setUnverifiedUsers(data || []);
      toast({
        title: 'Users loaded',
        description: `Found ${data?.length || 0} unverified users`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading users',
        description: error.message,
      });
    }
  };

  const sendVerificationEmailWithApology = async (user: UnverifiedUser) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-simple-verification-email', {
        body: {
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        }
      });

      if (error) throw error;

      setSentEmails(prev => [...prev, user.id]);
      return true;
    } catch (error: any) {
      console.error(`Failed to send email to ${user.email}:`, error);
      return false;
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a test email address',
      });
      return;
    }

    setIsTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-simple-verification-email', {
        body: {
          email: testEmail,
          firstName: 'Test',
          lastName: 'User'
        }
      });

      if (error) throw error;

      toast({
        title: 'Test email sent!',
        description: `Verification email sent to ${testEmail}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Test email failed',
        description: error.message,
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  const sendBulkEmails = async () => {
    setIsLoading(true);
    const remainingUsers = unverifiedUsers.filter(user => !sentEmails.includes(user.id));
    setBulkProgress({sent: 0, failed: 0, total: remainingUsers.length});
    
    let successCount = 0;
    let failureCount = 0;

    for (const user of remainingUsers) {
      const success = await sendVerificationEmailWithApology(user);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Update progress
      setBulkProgress({sent: successCount, failed: failureCount, total: remainingUsers.length});

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsLoading(false);
    
    toast({
      title: 'Bulk email complete',
      description: `Sent: ${successCount}, Failed: ${failureCount} out of ${remainingUsers.length} users`,
      variant: successCount > 0 ? 'default' : 'destructive',
    });
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Verification Email Sender
        </CardTitle>
        <CardDescription>
          Send plain text verification emails to users who didn't receive them due to technical issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Email Section */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Test Email
          </h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="testEmail">Test Email Address</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="ahaile14@gmail.com"
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={sendTestEmail} 
                disabled={isTestLoading}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isTestLoading ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will send a plain text email from Adam Haile apologizing for technical issues. The verification link is the same as the normal signup flow.
          </AlertDescription>
        </Alert>

        {isLoading && bulkProgress.total > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Sending emails...</span>
              <span className="text-sm text-gray-600">
                {bulkProgress.sent + bulkProgress.failed} / {bulkProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${((bulkProgress.sent + bulkProgress.failed) / bulkProgress.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>✅ Sent: {bulkProgress.sent}</span>
              <span>❌ Failed: {bulkProgress.failed}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={fetchUnverifiedUsers} variant="outline">
            Load Unverified Users
          </Button>
          {unverifiedUsers.length > 0 && (
            <Button 
              onClick={sendBulkEmails} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              {isLoading ? 'Sending...' : `Send to ${unverifiedUsers.length - sentEmails.length} users`}
            </Button>
          )}
        </div>

        {unverifiedUsers.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Unverified Users ({unverifiedUsers.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {unverifiedUsers.map((user) => (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    sentEmails.includes(user.id) ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                  }`}
                >
                  <div>
                    <div className="font-medium">{user.first_name} {user.last_name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    <div className="text-xs text-gray-500">
                      Registered: {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {sentEmails.includes(user.id) && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};