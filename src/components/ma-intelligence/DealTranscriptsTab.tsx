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
  deal_id: string;
  title: string;
  type: "Link" | "Upload" | "Call";
  url: string | null;
  call_date: string | null;
  processed_status: "Pending" | "Processing" | "Ready";
  extracted_data: Record<string, any> | null;
  notes: string | null;
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
      const { data, error } = await supabase
        .from("deal_transcripts")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTranscripts((data as Transcript[]) || []);
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
      // Update status to Processing
      const { error: updateError } = await supabase
        .from("deal_transcripts")
        .update({ processed_status: "Processing" })
        .eq("id", transcriptId);

      if (updateError) throw updateError;

      // Call edge function to extract data
      const { error: functionError } = await supabase.functions.invoke(
        "extract-transcript",
        {
          body: { transcriptId },
        }
      );

      if (functionError) throw functionError;

      toast({
        title: "Processing started",
        description: "Transcript processing is running in the background",
      });

      // Reload transcripts after a delay
      setTimeout(() => {
        loadTranscripts();
      }, 2000);
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
      const { error } = await supabase
        .from("deal_transcripts")
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ready":
        return <Badge variant="default">Ready</Badge>;
      case "Processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Link":
        return <Badge variant="secondary">Link</Badge>;
      case "Upload":
        return <Badge variant="secondary">Upload</Badge>;
      case "Call":
        return <Badge variant="secondary">Call</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
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
                  <TableHead>Type</TableHead>
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
                        <div className="font-medium">{transcript.title}</div>
                        {transcript.url && (
                          <a
                            href={transcript.url}
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
                    <TableCell>{getTypeBadge(transcript.type)}</TableCell>
                    <TableCell>
                      {transcript.call_date
                        ? new Date(transcript.call_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(transcript.processed_status)}</TableCell>
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
                          {transcript.processed_status === "Ready" && (
                            <DropdownMenuItem
                              onClick={() => handleViewExtractedData(transcript)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Extracted Data
                            </DropdownMenuItem>
                          )}
                          {transcript.processed_status === "Pending" && (
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
