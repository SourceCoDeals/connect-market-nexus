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
      // tracker_documents table doesn't exist yet - stub implementation
      // When the table is created, uncomment and use the actual query
      setDocuments([]);
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

    setIsUploading(true);
    try {
      // tracker_documents table doesn't exist yet - stub implementation
      toast({
        title: "Feature coming soon",
        description: "Document upload will be available once the tracker_documents table is created.",
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleProcessDocument = async (documentId: string) => {
    // Stub - table doesn't exist yet
    toast({
      title: "Feature coming soon",
      description: "Document processing will be available once the tracker_documents table is created.",
      variant: "destructive",
    });
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    // Stub - table doesn't exist yet
    toast({
      title: "Feature coming soon",
      description: "Document deletion will be available once the tracker_documents table is created.",
      variant: "destructive",
    });
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
