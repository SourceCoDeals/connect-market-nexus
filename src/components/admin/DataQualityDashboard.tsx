import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  TrendingDown, 
  TrendingUp,
  Database,
  UserCheck,
  Mail,
  X
} from 'lucide-react';
import { useDataQualityMonitor } from '@/hooks/use-data-quality-monitor';
import { toast } from '@/hooks/use-toast';

export function DataQualityDashboard() {
  const { metrics, alerts, isLoading, dismissAlert, triggerDataRecoveryCampaign } = useDataQualityMonitor();

  const handleTriggerRecovery = async () => {
    try {
      const result = await triggerDataRecoveryCampaign([]);
      if (result.success) {
        toast({
          title: "Recovery Campaign Launched",
          description: "Data recovery emails have been sent to users with incomplete profiles.",
        });
      } else {
        throw new Error('Campaign failed');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Campaign Failed",
        description: "Failed to launch data recovery campaign. Please try again.",
      });
    }
  };

  if (isLoading || !metrics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Database className="h-8 w-8 animate-pulse mx-auto mb-4" />
          <p>Loading data quality metrics...</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Data Quality Monitor</h2>
          <p className="text-muted-foreground">Real-time monitoring of user data completeness and quality</p>
        </div>
        <Button onClick={handleTriggerRecovery} className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Launch Recovery Campaign
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map(alert => (
            <Alert key={alert.id} className={
              alert.type === 'error' ? 'border-red-200 bg-red-50' :
              alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
              'border-blue-200 bg-blue-50'
            }>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                    alert.type === 'error' ? 'text-red-600' :
                    alert.type === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{alert.title}</h4>
                      <Badge variant={
                        alert.priority === 'high' ? 'destructive' :
                        alert.priority === 'medium' ? 'secondary' :
                        'outline'
                      }>
                        {alert.priority}
                      </Badge>
                    </div>
                    <AlertDescription>{alert.message}</AlertDescription>
                    {alert.action && (
                      <Button variant="link" size="sm" className="p-0 h-auto mt-2">
                        {alert.action}
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alert.id)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Data Completeness</p>
                <p className={`text-2xl font-bold ${getScoreColor(metrics.dataCompletenessScore)}`}>
                  {Math.round(metrics.dataCompletenessScore)}%
                </p>
              </div>
              <Database className={`h-8 w-8 ${getScoreColor(metrics.dataCompletenessScore)}`} />
            </div>
            <Progress value={metrics.dataCompletenessScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Onboarding Rate</p>
                <p className={`text-2xl font-bold ${getScoreColor(metrics.onboardingCompletionRate)}`}>
                  {Math.round(metrics.onboardingCompletionRate)}%
                </p>
              </div>
              <UserCheck className={`h-8 w-8 ${getScoreColor(metrics.onboardingCompletionRate)}`} />
            </div>
            <Progress value={metrics.onboardingCompletionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incomplete Profiles</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.incompleteProfiles}</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((metrics.incompleteProfiles / metrics.totalUsers) * 100)}% of total users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Form Drop-off Rate</p>
                <p className="text-2xl font-bold text-red-600">
                  {Math.round(metrics.formDropOffRate)}%
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Completeness Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Users</span>
                <Badge variant="outline">{metrics.totalUsers}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Complete Profiles</span>
                <div className="flex items-center gap-2">
                  <Badge variant={getScoreBadgeVariant(
                    ((metrics.totalUsers - metrics.incompleteProfiles) / metrics.totalUsers) * 100
                  )}>
                    {metrics.totalUsers - metrics.incompleteProfiles}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(((metrics.totalUsers - metrics.incompleteProfiles) / metrics.totalUsers) * 100)}%)
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Incomplete Profiles</span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{metrics.incompleteProfiles}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((metrics.incompleteProfiles / metrics.totalUsers) * 100)}%)
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Missing Critical Fields</span>
                <Badge variant="outline">{metrics.missingCriticalFields}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity & Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Recent Signups with Issues</span>
                <Badge variant={metrics.recentSignupsWithIssues > 5 ? "destructive" : "secondary"}>
                  {metrics.recentSignupsWithIssues}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Form Drop-off Rate</span>
                <div className="flex items-center gap-2">
                  <Badge variant={metrics.formDropOffRate > 30 ? "destructive" : "secondary"}>
                    {Math.round(metrics.formDropOffRate)}%
                  </Badge>
                  {metrics.formDropOffRate > 30 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Validation Error Rate</span>
                <Badge variant={metrics.validationErrorRate > 10 ? "destructive" : "default"}>
                  {Math.round(metrics.validationErrorRate)}%
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Data quality monitoring active</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}