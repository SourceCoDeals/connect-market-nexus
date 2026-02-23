import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DialerEntityType } from "@/hooks/use-push-to-dialer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface PushToDialerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  contactCount: number;
  entityType?: DialerEntityType;
}

interface PushResult {
  success: boolean;
  contacts_added: number;
  contacts_failed: number;
  contacts_excluded: number;
  exclusions?: { name: string; reason: string }[];
  errors?: string[];
  error?: string;
}

export function PushToDialerModal({
  open,
  onOpenChange,
  contactIds,
  contactCount,
  entityType = "buyer_contacts",
}: PushToDialerModalProps) {
  const [sessionName, setSessionName] = useState(
    `Buyer Outreach - ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
  );
  const [skipRecentDays] = useState(7);
  const [skipRecent, setSkipRecent] = useState(true);
  const [result, setResult] = useState<PushResult | null>(null);

  const pushMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("phoneburner-push-contacts", {
        body: {
          entity_type: entityType,
          entity_ids: contactIds,
          session_name: sessionName,
          skip_recent_days: skipRecent ? skipRecentDays : 0,
        },
      });
      if (error) throw error;
      return data as PushResult;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.success && data.contacts_added > 0) {
        toast.success(`${data.contacts_added} contacts pushed to PhoneBurner`);
      } else if (data.error) {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("PB_NOT_CONNECTED")) {
        toast.error("PhoneBurner not connected. Connect your account in Settings first.");
      } else {
        toast.error(`Push failed: ${msg}`);
      }
    },
  });

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Push to PhoneBurner
          </DialogTitle>
          <DialogDescription>
            Push {contactCount} selected contact{contactCount !== 1 ? "s" : ""} to a PhoneBurner dial session
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-2">
              {/* Summary */}
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                <Badge variant="secondary" className="text-sm">
                  {contactCount} contacts
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ~{Math.round(contactCount * 2.5)} min estimated dial time
                </span>
              </div>

              {/* Session Name */}
              <div className="space-y-2">
                <Label htmlFor="session-name">Session Name</Label>
                <Input
                  id="session-name"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., PE Buyers - Feb 2026"
                />
              </div>

              {/* Skip Recent */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="skip-recent"
                  checked={skipRecent}
                  onCheckedChange={(v) => setSkipRecent(v === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="skip-recent" className="cursor-pointer">
                    Skip recently contacted
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Exclude contacts called within the last {skipRecentDays} days
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => pushMutation.mutate()}
                disabled={pushMutation.isPending || !sessionName.trim()}
              >
                {pushMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Push to Dialer
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Result View */}
            <div className="space-y-3 py-2">
              {result.success && result.contacts_added > 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">
                    {result.contacts_added} contacts pushed successfully
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-medium">
                    {result.error || "No contacts were pushed"}
                  </span>
                </div>
              )}

              {result.contacts_excluded > 0 && result.exclusions && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {result.contacts_excluded} excluded:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {result.exclusions.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        • {e.name} — {e.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {result.contacts_failed > 0 && result.errors && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">
                    {result.contacts_failed} failed:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive/80">
                        • {e}
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
