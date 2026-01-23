import { useState } from "react";
import { FileText, Plus, Sparkles, Link2, Trash2, ChevronDown, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Transcript {
  id: string;
  transcript_text: string;
  source?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  processed_at?: string | null;
  extracted_data?: Record<string, unknown> | null;
  created_at: string;
}

interface TranscriptsListCardProps {
  transcripts: Transcript[];
  onAddTranscript: (text: string, source: string, fileName?: string) => void;
  onExtract: (transcriptId: string) => void;
  onExtractAll: () => void;
  onDelete: (transcriptId: string) => void;
  isAdding?: boolean;
  isExtracting?: boolean;
}

const SOURCE_OPTIONS = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "notes", label: "Notes" },
  { value: "other", label: "Other" },
];

export const TranscriptsListCard = ({
  transcripts,
  onAddTranscript,
  onExtract,
  onExtractAll,
  onDelete,
  isAdding = false,
  isExtracting = false,
}: TranscriptsListCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [newSource, setNewSource] = useState("call");
  const [newFileName, setNewFileName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingCount = transcripts.filter(t => !t.processed_at).length;

  const handleSubmit = () => {
    if (newText.trim()) {
      onAddTranscript(newText, newSource, newFileName || undefined);
      setNewText("");
      setNewSource("call");
      setNewFileName("");
      setIsDialogOpen(false);
    }
  };

  const getDisplayName = (transcript: Transcript): string => {
    if (transcript.file_name) return transcript.file_name;
    const source = transcript.source || "transcript";
    const date = new Date(transcript.created_at).toLocaleDateString();
    return `${source.charAt(0).toUpperCase() + source.slice(1)} - ${date}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4" />
            Transcripts & Call Intelligence
          </CardTitle>
          <div className="flex items-center gap-2">
            {transcripts.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onExtractAll}
                disabled={isExtracting || pendingCount === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Re-extract All ({pendingCount})
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Transcript
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            No transcripts linked yet.
          </p>
        ) : (
          <div className="space-y-2">
            {transcripts.map((transcript) => (
              <Collapsible 
                key={transcript.id}
                open={expandedId === transcript.id}
                onOpenChange={(open) => setExpandedId(open ? transcript.id : null)}
              >
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {getDisplayName(transcript)}
                    </span>
                    {transcript.processed_at && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="mr-1 h-3 w-3" />
                        Extracted
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {transcript.file_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a href={transcript.file_url} target="_blank" rel="noopener noreferrer">
                          <Link2 className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {!transcript.processed_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onExtract(transcript.id)}
                        disabled={isExtracting}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(transcript.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === transcript.id ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg border bg-background">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Transcript Preview
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                      {transcript.transcript_text}
                    </p>
                    {transcript.extracted_data && Object.keys(transcript.extracted_data).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Extracted Data
                        </p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(transcript.extracted_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Transcript Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Transcript</DialogTitle>
            <DialogDescription>
              Paste a call transcript or meeting notes to extract buyer intelligence.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source Type</Label>
                <Select value={newSource} onValueChange={setNewSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fileName">File Name (optional)</Label>
                <Input
                  id="fileName"
                  placeholder="e.g., Q1-Call-Notes.pdf"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript Text</Label>
              <Textarea
                id="transcript"
                placeholder="Paste your call transcript, meeting notes, or email content here..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!newText.trim() || isAdding}
            >
              {isAdding ? "Adding..." : "Add Transcript"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
