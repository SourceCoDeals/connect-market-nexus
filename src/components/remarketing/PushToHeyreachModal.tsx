import { useState } from 'react';
import type { HeyReachEntityType } from '@/types/heyreach';
import { usePushToHeyReach } from '@/hooks/heyreach/use-heyreach-leads';
import { useHeyReachCampaigns } from '@/hooks/heyreach/use-heyreach-campaigns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PushToHeyreachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  contactCount: number;
  entityType?: HeyReachEntityType;
}

export function PushToHeyreachModal({
  open,
  onOpenChange,
  contactIds,
  contactCount,
  entityType = 'listings',
}: PushToHeyreachModalProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [result, setResult] = useState<{
    success: boolean;
    total_resolved: number;
    total_pushed: number;
    errors?: string[];
  } | null>(null);

  const { data: campaignsData, isLoading: campaignsLoading } = useHeyReachCampaigns();
  const pushMutation = usePushToHeyReach();

  const campaigns = campaignsData?.campaigns ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE' || c.status === 'DRAFT');

  const handlePush = () => {
    if (!selectedCampaignId) return;
    pushMutation.mutate(
      {
        campaign_id: Number(selectedCampaignId),
        entity_type: entityType,
        entity_ids: contactIds,
      },
      {
        onSuccess: (data) => {
          if (data) setResult(data);
        },
        onError: () => {
          setResult({
            success: false,
            total_resolved: 0,
            total_pushed: 0,
            errors: ['Push failed. Check HeyReach API key in settings.'],
          });
        },
      },
    );
  };

  const handleClose = () => {
    setResult(null);
    setSelectedCampaignId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Push to HeyReach
          </DialogTitle>
          <DialogDescription>
            Push {contactCount} selected contact{contactCount !== 1 ? 's' : ''} to a HeyReach
            LinkedIn campaign
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                <Badge variant="secondary" className="text-sm">
                  {contactCount} contacts
                </Badge>
                <span className="text-sm text-muted-foreground">will be added as leads</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign</label>
                {campaignsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading campaigns...
                  </div>
                ) : activeCampaigns.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    No active campaigns found. Create one in HeyReach first.
                  </div>
                ) : (
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCampaigns.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {c.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePush}
                disabled={pushMutation.isPending || !selectedCampaignId || contactCount === 0}
              >
                {pushMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Push to HeyReach
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2">
              {result.success && result.total_pushed > 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">
                    {result.total_pushed} of {result.total_resolved} contacts pushed successfully
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-medium">
                    {result.errors?.[0] || 'No contacts were pushed'}
                  </span>
                </div>
              )}

              {result.errors && result.errors.length > 0 && result.total_pushed > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">
                    {result.errors.length} error(s):
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive/80">
                        {e}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
