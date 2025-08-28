import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { useDataIntegrityMonitor, useDataIntegritySummary } from "@/hooks/admin/use-data-integrity-monitor";

export const DataIntegrityDashboard = () => {
  const { data: issues = [], isLoading } = useDataIntegrityMonitor();
  const summary = useDataIntegritySummary();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'low':
        return <Info className="h-4 w-4 text-muted-foreground" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Integrity Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Checking data integrity...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Data Integrity Monitor
          {summary.hasIssues ? (
            <Badge variant="destructive" className="text-xs">
              {summary.totalIssues} issue{summary.totalIssues !== 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-success">
              All Clear
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{summary.highSeverity}</div>
            <div className="text-xs text-muted-foreground">High Priority</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{summary.mediumSeverity}</div>
            <div className="text-xs text-muted-foreground">Medium Priority</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{summary.lowSeverity}</div>
            <div className="text-xs text-muted-foreground">Low Priority</div>
          </div>
        </div>

        {/* Issues List */}
        {issues.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No data integrity issues detected. All systems are operating normally.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <Alert key={issue.id} className="py-2">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityColor(issue.severity) as any} className="text-xs">
                        {issue.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {issue.table}
                      </Badge>
                    </div>
                    <AlertDescription className="text-sm">
                      {issue.message}
                      {issue.recordId && (
                        <span className="text-muted-foreground ml-2">
                          (ID: {issue.recordId})
                        </span>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3">
          Last checked: {new Date().toLocaleTimeString()} • Auto-refresh every 5 minutes
        </div>
      </CardContent>
    </Card>
  );
};