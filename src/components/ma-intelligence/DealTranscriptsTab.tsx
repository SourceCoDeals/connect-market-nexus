import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  MoreVertical,
  Eye,
  Sparkles,
  Trash2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AddTranscriptDialog } from "./AddTranscriptDialog";

interface Transcript {
  id: string;
  listing_id: string;
  title: string | null;
  source: string | null;
  transcript_url: string | null;
  call_date: string | null;
  transcript_text: string;
  extracted_data: Record<string, any> | null;
  applied_to_deal: boolean | null;
  processed_at: string | null;
  created_at: string;
}

interface DealTranscriptsTabProps {
  dealId: string;
}

export function DealTranscriptsTab({ dealId }: DealTranscriptsTabProps) {
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    loadTranscripts();
  }, [dealId]);

  const loadTranscripts = async () => {
    try {
      // MIGRATION FIX: Use new unified transcripts table with entity_type filter
      // deal_transcripts uses listing_id, not deal_id
      const { data, error } = await supabase
        .from("transcripts")
        .select("*")
        .eq("listing_id", dealId)
        .in("entity_type", ["deal", "both"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTranscripts((data || []) as unknown as Transcript[]);
    } catch (error: any) {
      toast({
        title: "Error loading transcripts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessTranscript = async (transcriptId: string) => {
    try {
      // FIX #4: Remove manual processed_at update - let edge function set it AFTER successful extraction
      // This prevents marking transcripts as "processed" when extraction actually fails

      // Call edge function to extract data (use extract-deal-transcript for deal_transcripts table)
      const { error: functionError } = await supabase.functions.invoke(
        "extract-deal-transcript",
        {
          body: { transcriptId },
        }
      );

      if (functionError) throw functionError;

      toast({
        title: "Processing complete",
        description: "Transcript data has been extracted successfully",
      });

      // Reload transcripts to show updated processed_at status
      setTimeout(() => {
        loadTranscripts();
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Error processing transcript",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTranscript = async (transcriptId: string) => {
    if (!confirm("Are you sure you want to delete this transcript?")) return;

    try {
      // MIGRATION FIX: Use new unified transcripts table
      const { error } = await supabase
        .from("transcripts")
        .delete()
        .eq("id", transcriptId);

      if (error) throw error;

      toast({
        title: "Transcript deleted",
        description: "The transcript has been deleted successfully",
      });

      loadTranscripts();
    } catch (error: any) {
      toast({
        title: "Error deleting transcript",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewExtractedData = (transcript: Transcript) => {
    setSelectedTranscript(transcript);
    setIsViewDialogOpen(true);
  };

  const getStatusBadge = (transcript: Transcript) => {
    if (transcript.processed_at) {
      return <Badge variant="default">Processed</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return <Badge variant="outline">Unknown</Badge>;
    return <Badge variant="secondary">{source}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transcripts & Calls</CardTitle>
              <CardDescription>
                Manage call recordings and transcripts for this deal
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transcript
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transcripts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transcripts added yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Transcript
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Call Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transcripts.map((transcript) => (
                  <TableRow key={transcript.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transcript.title || "Untitled"}</div>
                        {transcript.transcript_url && (
                          <a
                            href={transcript.transcript_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View URL
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getSourceBadge(transcript.source)}</TableCell>
                    <TableCell>
                      {transcript.call_date
                        ? new Date(transcript.call_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(transcript)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(transcript.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {transcript.processed_at && (
                            <DropdownMenuItem
                              onClick={() => handleViewExtractedData(transcript)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Extracted Data
                            </DropdownMenuItem>
                          )}
                          {!transcript.processed_at && (
                            <DropdownMenuItem
                              onClick={() => handleProcessTranscript(transcript.id)}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Process Transcript
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteTranscript(transcript.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Transcript Dialog */}
      <AddTranscriptDialog
        dealId={dealId}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={loadTranscripts}
      />

      {/* View Extracted Data Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extracted Data</DialogTitle>
            <DialogDescription>
              Data extracted from {selectedTranscript?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedTranscript?.extracted_data ? (
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(selectedTranscript.extracted_data, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No extracted data available
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
