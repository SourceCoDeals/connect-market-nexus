import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, MessageSquareText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface OwnerResponseSectionProps {
  ownerResponse: string | null;
  onSave: (response: string) => Promise<void>;
}

export const OwnerResponseSection = ({
  ownerResponse,
  onSave,
}: OwnerResponseSectionProps) => {
  const [isOpen, setIsOpen] = useState(!!ownerResponse);
  const [editedResponse, setEditedResponse] = useState(ownerResponse || "");
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = editedResponse !== (ownerResponse || "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedResponse);
      toast.success("Owner response saved");
    } catch {
      toast.error("Failed to save owner response");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" />
                Owner Response
                {ownerResponse && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({ownerResponse.length} chars)
                  </span>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Owner's response, context from conversations, interest level details..."
              value={editedResponse}
              onChange={(e) => setEditedResponse(e.target.value)}
              className="min-h-[120px] resize-y"
            />
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Response
            </Button>
            <p className="text-xs text-muted-foreground">
              The owner's response or context gathered from outreach conversations.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default OwnerResponseSection;
