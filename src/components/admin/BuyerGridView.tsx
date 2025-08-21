import { AdminConnectionRequest } from "@/types/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  User, 
  Building2, 
  Mail, 
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink
} from "lucide-react";
import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { ConnectionRequestActions } from "./ConnectionRequestActions";

interface BuyerGridViewProps {
  requests: AdminConnectionRequest[];
  listingTitle: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          className: 'bg-success/10 text-success border-success/20',
          icon: <CheckCircle className="h-3 w-3 mr-1" />
        };
      case 'rejected':
        return {
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          icon: <XCircle className="h-3 w-3 mr-1" />
        };
      case 'on_hold':
        return {
          className: 'bg-warning/10 text-warning border-warning/20',
          icon: <AlertTriangle className="h-3 w-3 mr-1" />
        };
      default:
        return {
          className: 'bg-muted/50 text-muted-foreground border-border',
          icon: <Clock className="h-3 w-3 mr-1" />
        };
    }
  };

  const config = getStatusConfig(status);
  const displayStatus = status === 'on_hold' ? 'On Hold' : 
                       status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.icon}
      {displayStatus}
    </Badge>
  );
};

export function BuyerGridView({ requests, listingTitle }: BuyerGridViewProps) {
  const updateConnectionRequestStatus = useUpdateConnectionRequestStatus();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map((request) => (
          <Card key={request.id} className="relative overflow-hidden">
            <CardContent className="p-6">
              {/* Header with Status */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {request.user?.first_name} {request.user?.last_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                <StatusBadge status={request.status} />
              </div>

              {/* Buyer Info */}
              <div className="space-y-3 mb-6">
                {request.user?.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{request.user.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{request.user?.email}</span>
                </div>
                {request.user?.phone_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{request.user.phone_number}</span>
                  </div>
                )}
                {request.user?.buyer_type && (
                  <div className="text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {request.user.buyer_type}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Message */}
              {request.user_message && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Message:</p>
                  <p className="text-sm bg-muted/30 rounded-lg p-3 border">
                    {request.user_message}
                  </p>
                </div>
              )}

              {/* Status Controls */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`approved-${request.id}`} className="text-sm font-medium text-success">
                    Approved
                  </Label>
                  <Switch
                    id={`approved-${request.id}`}
                    checked={request.status === 'approved'}
                    onCheckedChange={(checked) => {
                      const newStatus = checked ? 'approved' : 'pending';
                      updateConnectionRequestStatus.mutate({
                        requestId: request.id,
                        status: newStatus,
                        notes: `Request ${newStatus} by admin`
                      });
                    }}
                    disabled={updateConnectionRequestStatus.isPending}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`rejected-${request.id}`} className="text-sm font-medium text-destructive">
                    Rejected
                  </Label>
                  <Switch
                    id={`rejected-${request.id}`}
                    checked={request.status === 'rejected'}
                    onCheckedChange={(checked) => {
                      const newStatus = checked ? 'rejected' : 'pending';
                      updateConnectionRequestStatus.mutate({
                        requestId: request.id,
                        status: newStatus,
                        notes: `Request ${newStatus} by admin`
                      });
                    }}
                    disabled={updateConnectionRequestStatus.isPending}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`on-hold-${request.id}`} className="text-sm font-medium text-warning">
                    On Hold
                  </Label>
                  <Switch
                    id={`on-hold-${request.id}`}
                    checked={request.status === 'on_hold'}
                    onCheckedChange={(checked) => {
                      const newStatus = checked ? 'on_hold' : 'pending';
                      updateConnectionRequestStatus.mutate({
                        requestId: request.id,
                        status: newStatus,
                        notes: `Request ${newStatus} by admin`
                      });
                    }}
                    disabled={updateConnectionRequestStatus.isPending}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t">
                <ConnectionRequestActions 
                  user={request.user!}
                  listing={request.listing}
                  requestId={request.id}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {requests.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No buyers found</h3>
          <p className="text-sm text-muted-foreground">
            No buyers have requested information about {listingTitle} yet.
          </p>
        </div>
      )}
    </div>
  );
}