import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import type { NonMarketplaceUser } from "@/types/non-marketplace-user";

interface SendInvitationDialogProps {
  user: NonMarketplaceUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendInvitationDialog = ({ user, open, onOpenChange }: SendInvitationDialogProps) => {
  const { toast } = useToast();
  const [customMessage, setCustomMessage] = useState("");

  const sendInvitationMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await supabase.functions.invoke('send-marketplace-invitation', {
        body: {
          to: user.email,
          name: user.name,
          customMessage: customMessage || undefined,
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: `Marketplace invitation sent to ${user?.email}`,
      });
      onOpenChange(false);
      setCustomMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Marketplace Invitation</DialogTitle>
          <DialogDescription>
            Invite {user.name} ({user.email}) to create a marketplace profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Default invitation will include:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Link to create marketplace account</li>
              <li>Brief overview of marketplace benefits</li>
              <li>Contact information for support</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Message (Optional)</label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal message to the invitation..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => sendInvitationMutation.mutate()}
            disabled={sendInvitationMutation.isPending}
          >
            {sendInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
