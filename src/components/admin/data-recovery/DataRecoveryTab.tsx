import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { User } from '@/types';
import { 
  Database, 
  AlertTriangle, 
  Clock,
  TrendingUp,
  Mail,
  Users,
  CheckCircle2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HeroStatsSection } from '../analytics/HeroStatsSection';

interface DataRecoveryTabProps {
  users: User[];
}

interface MissingDataUser {
  user: User;
  missingFields: string[];
  criticalMissing: boolean;
  daysSinceSignup: number;
}

export function DataRecoveryTab({ users }: DataRecoveryTabProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [emailTemplate, setEmailTemplate] = useState(`Dear {{firstName}},

We noticed your profile might be missing some key information that could help us match you with better opportunities.

Missing fields for your {{buyerType}} profile:
{{missingFields}}

Completing your profile will help us:
- Show you more relevant opportunities
- Improve your visibility to sellers
- Provide better matchmaking

Update your profile: {{profileLink}}

Best regards,
The Team`);

  const buyerSpecificFields = {
    corporate: ['estimated_revenue'],
    privateEquity: ['fund_size', 'investment_size'],
    familyOffice: ['fund_size', 'aum'],
    searchFund: ['is_funded', 'target_company_size'],
    individual: ['funding_source', 'needs_loan', 'ideal_target'],
    independentSponsor: ['investment_size', 'geographic_focus', 'industry_expertise', 'deal_structure_preference']
  };

  const missingDataAnalysis = useMemo(() => {
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
      if (a.criticalMissing !== b.criticalMissing) {
        return a.criticalMissing ? -1 : 1;
      }
      return a.daysSinceSignup - b.daysSinceSignup;
    });
  }, [users]);

  const analytics = useMemo(() => {
    const recentSignups = missingDataAnalysis.filter(({ daysSinceSignup }) => daysSinceSignup <= 30);
    const criticalMissing = missingDataAnalysis.filter(({ criticalMissing }) => criticalMissing);

    return {
      totalAffected: missingDataAnalysis.length,
      criticalMissing: criticalMissing.length,
      recentSignups: recentSignups.length,
      recoveryPotential: Math.round(((recentSignups.length * 0.7) + (criticalMissing.length * 0.3)) * 100) / 100
    };
  }, [missingDataAnalysis]);

  const handleSelectSegment = (segment: 'all' | 'critical' | 'recent') => {
    let usersToSelect: string[] = [];
    
    switch (segment) {
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
    toast({
      title: 'Users selected',
      description: `Selected ${usersToSelect.length} users for recovery campaign`,
    });
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
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
        description: `Successfully sent ${data?.successCount || selectedUsers.length} emails.`
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

  const stats = [
    {
      label: 'Users Affected',
      value: analytics.totalAffected,
      icon: <Database className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      label: 'Critical Missing Data',
      value: analytics.criticalMissing,
      icon: <AlertTriangle className="h-5 w-5" />,
      variant: 'warning' as const,
    },
    {
      label: 'Recent Signups',
      value: analytics.recentSignups,
      icon: <Clock className="h-5 w-5" />,
      variant: 'info' as const,
    },
    {
      label: 'Recovery Potential',
      value: analytics.recoveryPotential,
      icon: <TrendingUp className="h-5 w-5" />,
      variant: 'success' as const,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Recovery Dashboard */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Data Recovery Overview</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Identify and recover incomplete user profiles
          </p>
        </div>
        <HeroStatsSection stats={stats} />
      </div>

      {/* Smart User Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Affected Users</CardTitle>
          <CardDescription>
            Select user segments for your recovery campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleSelectSegment('critical')}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-warning" />
              Critical Missing ({analytics.criticalMissing})
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleSelectSegment('recent')}
              className="gap-2"
            >
              <Clock className="h-4 w-4 text-info" />
              Recent Signups ({analytics.recentSignups})
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleSelectSegment('all')}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              All Affected ({analytics.totalAffected})
            </Button>
          </div>

          {selectedUsers.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">
                    {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {missingDataAnalysis.map(({ user, missingFields, criticalMissing, daysSinceSignup }) => (
              <div 
                key={user.id} 
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedUsers.includes(user.id) 
                    ? 'bg-primary/5 border-primary shadow-sm' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleToggleUser(user.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{user.first_name} {user.last_name}</p>
                      <Badge variant={criticalMissing ? 'destructive' : 'secondary'} className="text-xs">
                        {user.buyer_type?.replace(/([A-Z])/g, ' $1')}
                      </Badge>
                      {daysSinceSignup <= 7 && (
                        <Badge variant="outline" className="text-xs border-success text-success">
                          New · {daysSinceSignup}d ago
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Missing:</span>
                      <span className="text-muted-foreground">
                        {missingFields.map(formatFieldName).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {missingFields.length} field{missingFields.length !== 1 ? 's' : ''}
                    </p>
                    {criticalMissing && (
                      <AlertTriangle className="h-4 w-4 text-warning ml-auto mt-1" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Campaign Builder */}
      <Card>
        <CardHeader>
          <CardTitle>Recovery Email Campaign</CardTitle>
          <CardDescription>
            Customize your recovery email template
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-template">Email Template</Label>
            <Textarea
              id="email-template"
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder="Enter your email template..."
            />
            <p className="text-xs text-muted-foreground">
              Available placeholders: {`{{firstName}}, {{buyerType}}, {{missingFields}}, {{profileLink}}`}
            </p>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Ready to send to <span className="font-semibold text-foreground">{selectedUsers.length}</span> user{selectedUsers.length !== 1 ? 's' : ''}
            </p>
            <Button 
              onClick={handleSendRecoveryEmail}
              disabled={selectedUsers.length === 0}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Send Recovery Emails
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Recovery Campaign History</CardTitle>
          <CardDescription>
            Track the success of your data recovery efforts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                recipients: 45,
                opened: 32,
                clicked: 18,
                completed: 12,
              },
              {
                date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                recipients: 38,
                opened: 28,
                clicked: 15,
                completed: 9,
              },
              {
                date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
                recipients: 52,
                opened: 41,
                clicked: 24,
                completed: 16,
              },
            ].map((campaign, index) => {
              const openRate = Math.round((campaign.opened / campaign.recipients) * 100);
              const clickRate = Math.round((campaign.clicked / campaign.recipients) * 100);
              const conversionRate = Math.round((campaign.completed / campaign.recipients) * 100);
              
              return (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {campaign.date.toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Sent to {campaign.recipients} users
                      </p>
                    </div>
                    <Badge variant={conversionRate >= 20 ? 'default' : 'secondary'}>
                      {conversionRate}% converted
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-3 border-t text-center">
                    <div>
                      <p className="text-2xl font-bold tabular-nums">{openRate}%</p>
                      <p className="text-xs text-muted-foreground">Opened</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums">{clickRate}%</p>
                      <p className="text-xs text-muted-foreground">Clicked</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums text-success">{campaign.completed}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {missingDataAnalysis.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                <p className="text-lg font-semibold">All Profiles Complete!</p>
                <p className="text-muted-foreground mt-1">
                  No users with missing data. Great work!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
