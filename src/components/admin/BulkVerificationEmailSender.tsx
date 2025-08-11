import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertTriangle, CheckCircle } from 'lucide-react';
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
      const { data, error } = await supabase.functions.invoke('send-verification-email-with-apology', {
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

  const sendBulkEmails = async () => {
    setIsLoading(true);
    let successCount = 0;
    let failureCount = 0;

    for (const user of unverifiedUsers) {
      if (sentEmails.includes(user.id)) continue;

      const success = await sendVerificationEmailWithApology(user);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsLoading(false);
    
    toast({
      title: 'Bulk email complete',
      description: `Sent: ${successCount}, Failed: ${failureCount}`,
      variant: successCount > 0 ? 'default' : 'destructive',
    });
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Bulk Verification Email Sender
        </CardTitle>
        <CardDescription>
          Send verification emails with apology to users who didn't receive them due to Brevo credit issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will send a special verification email with an apology for the delay to all unverified users.
          </AlertDescription>
        </Alert>

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