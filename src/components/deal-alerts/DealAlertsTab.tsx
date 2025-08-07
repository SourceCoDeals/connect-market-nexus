import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Bell, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CreateDealAlertDialog } from './CreateDealAlertDialog';
import { EditDealAlertDialog } from './EditDealAlertDialog';
import { DealAlertCard } from './DealAlertCard';
import { useDealAlerts, useDeleteDealAlert, useToggleDealAlert, DealAlert } from '@/hooks/use-deal-alerts';

export function DealAlertsTab() {
  const [selectedAlert, setSelectedAlert] = useState<DealAlert | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const { data: alerts, isLoading, error } = useDealAlerts();
  const deleteAlert = useDeleteDealAlert();
  const toggleAlert = useToggleDealAlert();

  const handleEdit = (alert: DealAlert) => {
    setSelectedAlert(alert);
    setEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      await deleteAlert.mutateAsync(id);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleAlert.mutateAsync({ id, is_active: isActive });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load deal alerts. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Deal Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between mb-6">
            <div className="max-w-2xl">
              <p className="text-muted-foreground mb-2">
                Never miss opportunities. Create alerts and get in-app notifications the moment a matching deal is published.
              </p>
              <p className="text-sm text-muted-foreground">
                Choose instant, daily, or weekly summaries based on your preference.
              </p>
            </div>
            <CreateDealAlertDialog />
          </div>

          {!alerts || alerts.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Deal Alerts Set Up</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Create your first deal alert to start receiving notifications when new opportunities match your criteria.
              </p>
              <CreateDealAlertDialog 
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Alert
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {alerts.length} alert{alerts.length !== 1 ? 's' : ''} configured
                </p>
                <div className="text-xs text-muted-foreground">
                  {alerts.filter(a => a.is_active).length} active • {alerts.filter(a => !a.is_active).length} paused
                </div>
              </div>
              
              <div className="grid gap-4">
                {alerts.map((alert) => (
                  <DealAlertCard
                    key={alert.id}
                    alert={alert}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditDealAlertDialog
        alert={selectedAlert}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setSelectedAlert(null);
        }}
      />
    </div>
  );
}