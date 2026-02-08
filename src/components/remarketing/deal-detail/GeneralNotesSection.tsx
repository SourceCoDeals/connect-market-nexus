import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, FileText, Sparkles, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface GeneralNotesSectionProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
  onAnalyze?: (notes: string) => Promise<void>;
  isAnalyzing?: boolean;
}

export const GeneralNotesSection = ({ 
  notes, 
  onSave, 
  onAnalyze,
  isAnalyzing = false 
}: GeneralNotesSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [enrichStage, setEnrichStage] = useState("");
  const hasChanges = editedNotes !== (notes || "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedNotes);
      toast.success("Notes saved successfully");
    } catch (error) {
      toast.error("Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (onAnalyze && editedNotes.trim()) {
      setEnrichProgress(10);
      setEnrichStage("Parsing notes...");

      const timer = setInterval(() => {
        setEnrichProgress(prev => {
          if (prev >= 85) { clearInterval(timer); return 85; }
          if (prev < 30) { setEnrichStage("Parsing notes..."); return prev + 3; }
          if (prev < 55) { setEnrichStage("Extracting deal intelligence..."); return prev + 2; }
          if (prev < 75) { setEnrichStage("Processing fields..."); return prev + 1.5; }
          setEnrichStage("Saving enriched data...");
          return prev + 1;
        });
      }, 400);

      try {
        await onAnalyze(editedNotes);
        clearInterval(timer);
        setEnrichProgress(100);
        setEnrichStage("Complete!");
        setTimeout(() => { setEnrichProgress(0); setEnrichStage(""); }, 1500);
      } catch (error) {
        clearInterval(timer);
        setEnrichProgress(0);
        setEnrichStage("");
        toast.error("Failed to enrich notes");
      }
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                General Notes
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
              placeholder="Paste general notes here... Call transcripts, owner conversations, business details, etc."
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              className="min-h-[150px] resize-y"
            />
            <div className="flex items-center gap-2">
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
                Save Notes
              </Button>
              {onAnalyze && (
                <Button 
                  variant="secondary"
                  onClick={handleAnalyze}
                  disabled={!editedNotes.trim() || isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Enrich Notes
                </Button>
              )}
            </div>
            {(isAnalyzing || enrichProgress > 0) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {enrichStage}
                  </span>
                  <span className="text-muted-foreground font-medium">{Math.round(enrichProgress)}%</span>
                </div>
                <Progress value={enrichProgress} className="h-2" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Use "Enrich Notes" to automatically extract deal information from pasted notes.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default GeneralNotesSection;
