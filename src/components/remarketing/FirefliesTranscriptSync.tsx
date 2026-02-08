import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Link2, AlertCircle } from "lucide-react";

interface FirefliesTranscriptSyncProps {
  listingId: string;
  contactEmail: string | null;
  contactName: string | null;
  existingTranscripts: number;
  onSyncComplete?: () => void;
}

/**
 * FirefliesTranscriptSync Component
 *
 * Displays on deal page to sync Fireflies transcripts automatically.
 *
 * Features:
 * - Shows sync button if contact email is set
 * - Displays count of linked transcripts
 * - Shows last sync time
 * - Handles errors gracefully
 * - Provides feedback on sync results
 *
 * Usage:
 * <FirefliesTranscriptSync
 *   listingId={deal.id}
 *   contactEmail={deal.main_contact_email}
 *   contactName={deal.main_contact_name}
 *   existingTranscripts={transcripts.filter(t => t.source === 'fireflies').length}
 *   onSyncComplete={() => refetchTranscripts()}
 * />
 */
export const FirefliesTranscriptSync = ({
  listingId,
  contactEmail,
  contactName,
  existingTranscripts,
  onSyncComplete,
}: FirefliesTranscriptSyncProps) => {
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [linkedCount, setLinkedCount] = useState(existingTranscripts);

  const handleSync = async () => {
    if (!contactEmail) {
      toast.error("No contact email set for this deal");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`Searching Fireflies for ${contactEmail}...`);

    try {
      const { data, error } = await supabase.functions.invoke(
        'sync-fireflies-transcripts',
        {
          body: {
            listingId,
            contactEmail,
            limit: 50,
          }
        }
      );

      if (error) {
        console.error("Sync error:", error);
        throw error;
      }

      // Update UI based on results
      if (data.linked > 0) {
        toast.success(
          `Linked ${data.linked} new transcript${data.linked !== 1 ? 's' : ''} from Fireflies`,
          { id: toastId }
        );
        setLinkedCount(linkedCount + data.linked);
        onSyncComplete?.();
      } else if (data.skipped > 0 && data.linked === 0) {
        toast.info(
          `All ${data.skipped} available transcript${data.skipped !== 1 ? 's' : ''} already linked`,
          { id: toastId }
        );
      } else {
        toast.info(
          `No Fireflies calls found for ${contactEmail}`,
          { id: toastId }
        );
      }

      setLastSynced(new Date());

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `${data.errors.length} transcript${data.errors.length !== 1 ? 's' : ''} failed to link`,
          { duration: 5000 }
        );
      }

    } catch (error) {
      console.error("Sync error:", error);
      toast.error(
        error instanceof Error
          ? `Failed to sync: ${error.message}`
          : "Failed to sync Fireflies transcripts",
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  };

  // If no contact email, show prompt to add one
  if (!contactEmail) {
    return (
      <Card className="p-4 border-dashed bg-muted/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Fireflies Integration Available</p>
            <p className="text-xs text-muted-foreground">
              Add a contact email to automatically load all Fireflies call transcripts for this deal
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Fireflies Transcripts</h4>
              <Badge variant="secondary" className="text-xs">
                Auto-Sync
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                Contact: {contactName || contactEmail}
              </p>
              <p className="text-xs text-muted-foreground">
                {contactEmail}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={linkedCount > 0 ? "default" : "secondary"}>
              {linkedCount} transcript{linkedCount !== 1 ? 's' : ''}
            </Badge>
            {linkedCount > 0 && (
              <span className="text-xs text-muted-foreground">
                linked
              </span>
            )}
          </div>

          {lastSynced && (
            <span className="text-xs text-muted-foreground">
              Last synced: {lastSynced.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Info */}
        {linkedCount > 0 && (
          <div className="flex items-start gap-2 pt-2 border-t">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Transcripts are automatically fetched from Fireflies during deal enrichment.
              Full content is cached after first use.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
