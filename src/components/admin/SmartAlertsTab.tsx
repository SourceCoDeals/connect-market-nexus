import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Users, Clock, Target, CheckCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSmartAlerts } from "@/hooks/use-smart-alerts";

export function SmartAlertsTab() {
  const { data: alerts = [], isLoading, refetch } = useSmartAlerts();

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'performance': return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case 'opportunity': return <Target className="h-5 w-5 text-green-500" />;
      case 'churn_risk': return <Users className="h-5 w-5 text-red-500" />;
      case 'market_trend': return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'urgent_action': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const alertsByPriority = {
    high: alerts.filter(a => a.priority === 'high'),
    medium: alerts.filter(a => a.priority === 'medium'),
    low: alerts.filter(a => a.priority === 'low')
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Smart Alerts</h2>
          <p className="text-muted-foreground">AI-powered notifications and actionable insights</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          Refresh Alerts
        </Button>
      </div>

      {/* Alert Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{alertsByPriority.high.length}</div>
            <p className="text-xs text-muted-foreground">Needs immediate attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium Priority</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{alertsByPriority.medium.length}</div>
            <p className="text-xs text-muted-foreground">Review when possible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {alerts.filter(a => a.type === 'opportunity').length}
            </div>
            <p className="text-xs text-muted-foreground">Revenue opportunities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">Active alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* High Priority Alerts */}
      {alertsByPriority.high.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              High Priority Alerts
            </CardTitle>
            <CardDescription>These require immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertsByPriority.high.map((alert) => (
                <div key={alert.id} className="p-3 bg-white border border-red-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <h4 className="font-medium text-sm">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityColor(alert.priority) as any}>
                        {alert.priority}
                      </Badge>
                      <Badge variant="outline">
                        {getTypeLabel(alert.type)}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                  
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    <strong>Action Required:</strong> {alert.action_required}
                  </div>

                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {alert.metadata.listing_id && (
                        <span className="mr-3">Listing ID: {alert.metadata.listing_id}</span>
                      )}
                      {alert.metadata.user_id && (
                        <span className="mr-3">User ID: {alert.metadata.user_id}</span>
                      )}
                      {alert.metadata.metrics && Object.entries(alert.metadata.metrics).map(([key, value]) => (
                        <span key={key} className="mr-3">{key}: {value}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Other Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>All Alerts</CardTitle>
          <CardDescription>Complete list of system-generated insights and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <h4 className="font-medium text-sm">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityColor(alert.priority) as any}>
                        {alert.priority}
                      </Badge>
                      <Badge variant="outline">
                        {getTypeLabel(alert.type)}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                  
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    <strong>Action Required:</strong> {alert.action_required}
                  </div>

                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {alert.metadata.listing_id && (
                        <span className="mr-3">Listing ID: {alert.metadata.listing_id.slice(0, 8)}...</span>
                      )}
                      {alert.metadata.user_id && (
                        <span className="mr-3">User ID: {alert.metadata.user_id.slice(0, 8)}...</span>
                      )}
                      {alert.metadata.metrics && Object.entries(alert.metadata.metrics).map(([key, value]) => (
                        <span key={key} className="mr-3 capitalize">{key.replace('_', ' ')}: {value}</span>
                      ))}
                    </div>
                  )}

                  {alert.auto_dismiss_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-dismisses {formatDistanceToNow(new Date(alert.auto_dismiss_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-muted-foreground">No active alerts - everything looks good!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Types Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-sm"><strong>Performance:</strong> Underperforming listings needing optimization</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-sm"><strong>Opportunity:</strong> Revenue opportunities and follow-up chances</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-red-500" />
              <span className="text-sm"><strong>Churn Risk:</strong> High-value users showing declining engagement</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm"><strong>Market Trend:</strong> Market gaps and trending demand patterns</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm"><strong>Urgent Action:</strong> Time-sensitive admin tasks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}