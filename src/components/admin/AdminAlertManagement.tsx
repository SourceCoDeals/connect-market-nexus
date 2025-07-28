import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Bell, Clock, MapPin, DollarSign } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatCurrency } from '@/lib/currency-utils';

interface DealAlertWithUser {
  id: string;
  name: string;
  criteria: any;
  frequency: string;
  is_active: boolean;
  created_at: string;
  last_sent_at?: string;
  user_id: string;
  user_email: string;
  user_name: string;
}

export function AdminAlertManagement() {
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['admin', 'deal-alerts-management'],
    queryFn: async () => {
      const { data: alertData, error: alertError } = await supabase
        .from('deal_alerts')
        .select(`
          id,
          name,
          criteria,
          frequency,
          is_active,
          created_at,
          last_sent_at,
          user_id
        `)
        .order('created_at', { ascending: false });

      if (alertError) throw alertError;

      // Get user profiles separately
      const userIds = alertData?.map(alert => alert.user_id) || [];
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (profileError) throw profileError;

      // Create a map of user profiles
      const profileMap = new Map(profileData?.map(profile => [profile.id, profile]) || []);

      return alertData?.map(alert => {
        const profile = profileMap.get(alert.user_id);
        return {
          ...alert,
          user_email: profile?.email || 'Unknown',
          user_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown',
        };
      }) as DealAlertWithUser[] || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !alerts) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load deal alerts</p>
        </CardContent>
      </Card>
    );
  }

  const formatCriteria = (criteria: any) => {
    const parts = [];
    
    if (criteria.category && criteria.category !== 'all') {
      parts.push(`Category: ${criteria.category}`);
    }
    
    if (criteria.location && criteria.location !== 'all') {
      parts.push(`Location: ${criteria.location}`);
    }
    
    if (criteria.revenueMin || criteria.revenueMax) {
      const min = criteria.revenueMin ? formatCurrency(criteria.revenueMin) : '0';
      const max = criteria.revenueMax ? formatCurrency(criteria.revenueMax) : '∞';
      parts.push(`Revenue: ${min} - ${max}`);
    }
    
    if (criteria.ebitdaMin || criteria.ebitdaMax) {
      const min = criteria.ebitdaMin ? formatCurrency(criteria.ebitdaMin) : '0';
      const max = criteria.ebitdaMax ? formatCurrency(criteria.ebitdaMax) : '∞';
      parts.push(`EBITDA: ${min} - ${max}`);
    }
    
    if (criteria.search) {
      parts.push(`Keywords: "${criteria.search}"`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'No specific criteria';
  };

  const getFrequencyBadgeVariant = (frequency: string) => {
    switch (frequency) {
      case 'instant':
        return 'default' as const;
      case 'daily':
        return 'secondary' as const;
      case 'weekly':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Individual Deal Alerts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage all user deal alerts and their criteria
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Alert Name</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map(alert => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{alert.user_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {alert.user_email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{alert.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(alert.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm max-w-xs">
                      {formatCriteria(alert.criteria)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getFrequencyBadgeVariant(alert.frequency)}>
                      {alert.frequency === 'instant' ? 'Instant' : 
                       alert.frequency === 'daily' ? 'Daily' : 'Weekly'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={alert.is_active ? 'default' : 'secondary'}>
                      {alert.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {alert.last_sent_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.last_sent_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(`mailto:${alert.user_email}?subject=Regarding your deal alert: ${alert.name}`, '_blank');
                        }}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No deal alerts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}