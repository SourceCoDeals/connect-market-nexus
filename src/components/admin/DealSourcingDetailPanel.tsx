import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DealSourcingRequest, useUpdateDealSourcingRequest } from '@/hooks/admin/use-deal-sourcing-requests';
import { useAdminUsers } from '@/hooks/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { X, Mail, User, Building2, Calendar, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DealSourcingDetailPanelProps {
  request: DealSourcingRequest;
  onClose: () => void;
}

export function DealSourcingDetailPanel({ request, onClose }: DealSourcingDetailPanelProps) {
  const [status, setStatus] = useState(request.status);
  const [assignedTo, setAssignedTo] = useState(request.assigned_to || '');
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const adminUsers = useAdminUsers();
  const admins = adminUsers.useUsers().data;
  const updateRequest = useUpdateDealSourcingRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateRequest(request.id, {
        status,
        assigned_to: assignedTo || null,
        admin_notes: adminNotes || null,
      });

      queryClient.invalidateQueries({ queryKey: ['deal-sourcing-requests'] });
      
      toast({
        title: 'Success',
        description: 'Request updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update request',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkFollowedUp = async () => {
    try {
      await updateRequest(request.id, {
        followed_up_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ['deal-sourcing-requests'] });
      
      toast({
        title: 'Success',
        description: 'Marked as followed up',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deal Sourcing Request</h2>
          <p className="text-sm text-muted-foreground">
            Submitted {format(new Date(request.created_at), 'PPP')}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="user">User Profile</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          {/* User Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{request.user_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {request.user_email}
            </div>
            {request.user_company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {request.user_company}
              </div>
            )}
          </div>

          <Separator />

          {/* Request Details */}
          <div className="space-y-4">
            {request.buyer_type && (
              <div>
                <Label className="text-muted-foreground">Buyer Type</Label>
                <Badge variant="outline" className="mt-1">{request.buyer_type}</Badge>
              </div>
            )}

            {request.business_categories && request.business_categories.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Business Categories</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {request.business_categories.map((cat) => (
                    <Badge key={cat} variant="secondary">{cat}</Badge>
                  ))}
                </div>
              </div>
            )}

            {request.target_locations && request.target_locations.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Target Locations</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {request.target_locations.map((loc) => (
                    <Badge key={loc} variant="secondary">{loc}</Badge>
                  ))}
                </div>
              </div>
            )}

            {(request.revenue_min || request.revenue_max) && (
              <div>
                <Label className="text-muted-foreground">Revenue Range</Label>
                <p className="mt-1">
                  {request.revenue_min && `$${request.revenue_min}`}
                  {request.revenue_min && request.revenue_max && ' - '}
                  {request.revenue_max && `$${request.revenue_max}`}
                </p>
              </div>
            )}

            {request.investment_thesis && (
              <div>
                <Label className="text-muted-foreground">Investment Thesis</Label>
                <p className="mt-1 text-sm">{request.investment_thesis}</p>
              </div>
            )}

            {request.additional_notes && (
              <div>
                <Label className="text-muted-foreground">Additional Notes</Label>
                <p className="mt-1 text-sm">{request.additional_notes}</p>
              </div>
            )}

            {request.custom_message && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <Label className="flex items-center gap-2 text-primary">
                  <Mail className="h-4 w-4" />
                  Custom Message
                </Label>
                <p className="mt-2 text-sm">{request.custom_message}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="user" className="space-y-4">
          <div className="text-sm text-muted-foreground">
            User profile information and history will be displayed here
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="scheduled_call">Scheduled Call</SelectItem>
                  <SelectItem value="converted_to_deal">Converted to Deal</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {admins?.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Admin Notes (Internal)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this request..."
                className="mt-2 min-h-[100px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleMarkFollowedUp}
                disabled={!!request.followed_up_at}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {request.followed_up_at ? 'Already Followed Up' : 'Mark as Followed Up'}
              </Button>

              {request.followed_up_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Followed up {format(new Date(request.followed_up_at), 'PPP')}
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
