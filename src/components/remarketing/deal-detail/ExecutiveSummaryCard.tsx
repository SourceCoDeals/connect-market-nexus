import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface ExecutiveSummaryCardProps {
  summary: string | null;
  onSave: (summary: string) => Promise<void>;
  onGenerate?: () => Promise<string | null>;
}

export const ExecutiveSummaryCard = ({ 
  summary, 
  onSave,
  onGenerate 
}: ExecutiveSummaryCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedSummary, setEditedSummary] = useState(summary || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedSummary);
      setIsEditOpen(false);
      toast.success("Executive summary updated");
    } catch (error) {
      toast.error("Failed to save summary");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;
    setIsGenerating(true);
    try {
      const generated = await onGenerate();
      if (generated) {
        setEditedSummary(generated);
        toast.success("Summary generated - review and save");
      }
    } catch (error) {
      toast.error("Failed to generate summary");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Executive Summary
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => {
                setEditedSummary(summary || "");
                setIsEditOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {summary ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {summary}
            </p>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No executive summary yet</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setIsEditOpen(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Add Summary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Executive Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter a brief executive summary of this deal..."
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              className="min-h-[200px]"
            />
            {onGenerate && (
              <Button 
                variant="secondary" 
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate from Deal Data
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExecutiveSummaryCard;
