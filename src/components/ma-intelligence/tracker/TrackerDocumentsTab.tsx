import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Trash2, Loader2, FileCheck, AlertCircle, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TrackerDocument } from "@/lib/ma-intelligence/types";

interface TrackerDocumentsTabProps {
  trackerId: string;
}

interface Document {
  id: string;
  name: string;
  file_type: string;
  file_url: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export function TrackerDocumentsTab({ trackerId }: TrackerDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, [trackerId]);

  const loadDocuments = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tracker_documents")
        .select("*")
        .eq("tracker_id", trackerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading documents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, TXT, or DOC files only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload files smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${trackerId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tracker-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tracker-documents')
        .getPublicUrl(filePath);

      // Create document record
      const { error: insertError } = await supabase
        .from("tracker_documents")
        .insert({
          tracker_id: trackerId,
          name: file.name,
          file_type: file.type,
          file_url: publicUrl,
          status: 'ready',
        });

      if (insertError) throw insertError;

      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully",
      });

      loadDocuments();

      // Reset file input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcessDocument = async (documentId: string) => {
    setIsProcessing(documentId);
    try {
      const { error } = await supabase.functions.invoke("process-tracker-document", {
        body: {
          document_id: documentId,
          tracker_id: trackerId,
        },
      });

      if (error) throw error;

      toast({
        title: "Processing started",
        description: "Extracting criteria from document. This may take a few moments...",
      });

      // Update document status
      await supabase
        .from("tracker_documents")
        .update({ status: 'processing' })
        .eq("id", documentId);

      // Poll for completion
      setTimeout(() => {
        loadDocuments();
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const filePath = urlParts.slice(-2).join('/');

      // Delete from storage
      await supabase.storage
        .from('tracker-documents')
        .remove([filePath]);

      // Delete record
      const { error } = await supabase
        .from("tracker_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: "The document has been removed",
      });

      loadDocuments();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'uploading':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Uploading</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Brain className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'ready':
        return <Badge variant="default"><FileCheck className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return null;
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload M&A guides, CIMs, presentations, or other documents to extract buyer fit criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {isUploading ? "Uploading..." : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF, TXT, DOC up to 10MB
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                After uploading, click "Process Document" to extract fit criteria using AI.
                The extracted criteria will be added to your tracker's Fit Criteria tab.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {doc.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {doc.file_type.split('/').pop()?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.status === 'ready' && !doc.processed_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessDocument(doc.id)}
                            disabled={isProcessing === doc.id}
                          >
                            {isProcessing === doc.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Brain className="w-3 h-3 mr-1" />
                                Process
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {documents.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4" />
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload your first document to get started</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
