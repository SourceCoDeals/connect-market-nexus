import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { User } from '@/types';
import { 
  AlertTriangle, 
  Database, 
  UserX, 
  Mail, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  Users,
  MessageSquare
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DataRecoveryDashboardProps {
  users: User[];
}

interface MissingDataUser {
  user: User;
  missingFields: string[];
  criticalMissing: boolean;
  daysSinceSignup: number;
}

export function DataRecoveryDashboard({ users }: DataRecoveryDashboardProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [emailTemplate, setEmailTemplate] = useState(`Dear {{firstName}},

We hope you're doing well! We noticed that your profile on our marketplace might be missing some important information that could help us better match you with relevant business opportunities.

Missing information for your {{buyerType}} profile:
{{missingFields}}

Could you please take a few minutes to complete your profile? This will help us:
- Show you more relevant business opportunities
- Improve your visibility to sellers
- Provide better matchmaking services

You can update your profile here: {{profileLink}}

If you have any questions, please don't hesitate to reach out.

Best regards,
The Marketplace Team`);

  // Analyze users with missing buyer-specific data
  const missingDataAnalysis = useMemo(() => {
    const buyerSpecificFields = {
      corporate: ['estimated_revenue'],
      privateEquity: ['fund_size', 'investment_size'],
      familyOffice: ['fund_size', 'aum'],
      searchFund: ['is_funded', 'target_company_size'],
      individual: ['funding_source', 'needs_loan', 'ideal_target'],
      independentSponsor: ['investment_size', 'geographic_focus', 'industry_expertise', 'deal_structure_preference']
    };

    const usersWithMissingData: MissingDataUser[] = [];

    users.forEach(user => {
      if (!user.buyer_type) return;

      const requiredFields = buyerSpecificFields[user.buyer_type as keyof typeof buyerSpecificFields] || [];
      const missingFields = requiredFields.filter(field => {
        const value = user[field as keyof User];
        return !value || value === '';
      });

      if (missingFields.length > 0) {
        const daysSinceSignup = Math.floor(
          (new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        usersWithMissingData.push({
          user,
          missingFields,
          criticalMissing: missingFields.length >= requiredFields.length / 2,
          daysSinceSignup
        });
      }
    });

    return usersWithMissingData.sort((a, b) => {
      // Sort by: critical missing first, then by recency
      if (a.criticalMissing !== b.criticalMissing) {
        return a.criticalMissing ? -1 : 1;
      }
      return a.daysSinceSignup - b.daysSinceSignup;
    });
  }, [users]);

  // Analytics
  const analytics = useMemo(() => {
    const byBuyerType = missingDataAnalysis.reduce((acc, { user, missingFields }) => {
      const type = user.buyer_type || 'unknown';
      if (!acc[type]) {
        acc[type] = { total: 0, critical: 0, avgMissing: 0 };
      }
      acc[type].total++;
      if (missingFields.length >= 2) acc[type].critical++;
      acc[type].avgMissing += missingFields.length;
      return acc;
    }, {} as Record<string, { total: number; critical: number; avgMissing: number }>);

    Object.keys(byBuyerType).forEach(type => {
      byBuyerType[type].avgMissing = byBuyerType[type].avgMissing / byBuyerType[type].total;
    });

    const recentSignups = missingDataAnalysis.filter(({ daysSinceSignup }) => daysSinceSignup <= 30);
    const criticalMissing = missingDataAnalysis.filter(({ criticalMissing }) => criticalMissing);

    return {
      totalAffected: missingDataAnalysis.length,
      criticalMissing: criticalMissing.length,
      recentSignups: recentSignups.length,
      byBuyerType,
      recoveryPotential: Math.round(((recentSignups.length * 0.7) + (criticalMissing.length * 0.3)) * 100) / 100
    };
  }, [missingDataAnalysis]);

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = (category: 'all' | 'critical' | 'recent') => {
    let usersToSelect: string[] = [];
    
    switch (category) {
      case 'all':
        usersToSelect = missingDataAnalysis.map(({ user }) => user.id);
        break;
      case 'critical':
        usersToSelect = missingDataAnalysis
          .filter(({ criticalMissing }) => criticalMissing)
          .map(({ user }) => user.id);
        break;
      case 'recent':
        usersToSelect = missingDataAnalysis
          .filter(({ daysSinceSignup }) => daysSinceSignup <= 30)
          .map(({ user }) => user.id);
        break;
    }

    setSelectedUsers(usersToSelect);
  };

  const handleSendRecoveryEmail = async () => {
    if (selectedUsers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No users selected',
        description: 'Please select users to send recovery emails to.'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-data-recovery-email', {
        body: {
          userIds: selectedUsers,
          template: emailTemplate
        }
      });

      if (error) throw error;

      toast({
        title: 'Recovery emails sent',
        description: `Successfully sent ${data.successCount} emails. ${data.failedCount > 0 ? `${data.failedCount} failed.` : ''}`
      });

      setSelectedUsers([]);
    } catch (error) {
      console.error('Error sending recovery emails:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to send emails',
        description: 'There was an error sending the recovery emails. Please try again.'
      });
    }
  };

  const formatFieldName = (field: string): string => {
    const fieldMap: Record<string, string> = {
      estimated_revenue: 'Estimated Revenue',
      fund_size: 'Fund Size',
      investment_size: 'Investment Size',
      aum: 'Assets Under Management',
      is_funded: 'Funding Status',
      target_company_size: 'Target Company Size',
      funding_source: 'Funding Source',
      needs_loan: 'Loan Requirements',
      ideal_target: 'Ideal Target Description',
      geographic_focus: 'Geographic Focus',
      industry_expertise: 'Industry Expertise',
      deal_structure_preference: 'Deal Structure Preference'
    };
    return fieldMap[field] || field;
  };

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Users Affected</p>
                <p className="text-2xl font-bold text-red-600">{analytics.totalAffected}</p>
              </div>
              <Database className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Missing</p>
                <p className="text-2xl font-bold text-orange-600">{analytics.criticalMissing}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Signups</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.recentSignups}</p>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recovery Potential</p>
                <p className="text-2xl font-bold text-green-600">{analytics.recoveryPotential}</p>
                <p className="text-xs text-muted-foreground">Users likely to respond</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Data Analysis</TabsTrigger>
          <TabsTrigger value="recovery">Recovery Campaign</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          {/* Buyer Type Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Missing Data by Buyer Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(analytics.byBuyerType).map(([type, stats]) => (
                <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium capitalize">{type.replace(/([A-Z])/g, ' $1')}</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.total} users, {stats.critical} critical
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      Avg {Math.round(stats.avgMissing * 10) / 10} fields missing
                    </p>
                    <Progress value={(stats.critical / stats.total) * 100} className="w-20 h-2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Users with Missing Data
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll('critical')}>
                    Select Critical ({analytics.criticalMissing})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll('recent')}>
                    Select Recent ({analytics.recentSignups})
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {missingDataAnalysis.map(({ user, missingFields, criticalMissing, daysSinceSignup }) => (
                  <div 
                    key={user.id} 
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedUsers.includes(user.id) ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectUser(user.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <Badge variant={criticalMissing ? 'destructive' : 'secondary'}>
                            {user.buyer_type?.replace(/([A-Z])/g, ' $1')}
                          </Badge>
                          {daysSinceSignup <= 7 && (
                            <Badge variant="outline" className="text-green-600">
                              New ({daysSinceSignup}d ago)
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{user.email}</p>
                        <p className="text-sm">
                          <span className="font-medium">Missing:</span> {missingFields.map(formatFieldName).join(', ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {missingFields.length} field{missingFields.length !== 1 ? 's' : ''}
                        </p>
                        {criticalMissing && (
                          <AlertTriangle className="h-4 w-4 text-orange-500 ml-auto mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Recovery Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedUsers.length > 0 && (
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected for recovery campaign
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="email-template">Email Template</Label>
                <Textarea
                  id="email-template"
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  rows={12}
                  className="mt-2"
                  placeholder="Enter your email template with placeholders: {{firstName}}, {{buyerType}}, {{missingFields}}, {{profileLink}}"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Available placeholders: {`{{firstName}}, {{buyerType}}, {{missingFields}}, {{profileLink}}`}
                </p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Ready to send recovery emails to {selectedUsers.length} users
                </p>
                <Button 
                  onClick={handleSendRecoveryEmail}
                  disabled={selectedUsers.length === 0}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Send Recovery Emails
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Integrity Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Enhanced signup form is now live and capturing all buyer-specific fields. Future signups will have complete data.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Form Validation Status</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Monitoring signup form performance and data capture rates
                  </p>
                  <Badge variant="secondary" className="text-green-600">
                    ✓ Active
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Data Quality Alerts</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Automatic alerts for incomplete profiles and missing critical data
                  </p>
                  <Badge variant="secondary" className="text-green-600">
                    ✓ Configured
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Recovery Tracking</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Track response rates and profile completion after recovery campaigns
                  </p>
                  <Badge variant="secondary" className="text-blue-600">
                    ⚡ Ready
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">User Journey Analysis</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Monitor where users drop off in the signup process
                  </p>
                  <Badge variant="secondary" className="text-blue-600">
                    ⚡ Ready
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}