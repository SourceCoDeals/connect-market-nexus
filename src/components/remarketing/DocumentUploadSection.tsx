import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DocumentReference } from "@/types/remarketing";
import { 
  FileText, 
  Upload, 
  X, 
  ExternalLink, 
  Loader2,
  File,
  FileSpreadsheet,
  FileImage
} from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

interface DocumentUploadSectionProps {
  universeId: string;
  documents: DocumentReference[];
  onDocumentsChange: (documents: DocumentReference[]) => void;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-500" />;
    case 'xlsx':
    case 'xls':
    case 'csv':
      return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return <FileImage className="h-4 w-4 text-blue-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const DocumentUploadSection = ({
  universeId,
  documents,
  onDocumentsChange
}: DocumentUploadSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlName, setUrlName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocuments: DocumentReference[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${universeId}/${uuidv4()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('universe-documents')
          .upload(fileName, file);

        if (uploadError) {
          // If bucket doesn't exist, show a message
          if (uploadError.message.includes('Bucket not found')) {
            toast.error('Document storage not configured. Please contact admin.');
            continue;
          }
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('universe-documents')
          .getPublicUrl(fileName);

        newDocuments.push({
          id: uuidv4(),
          name: file.name,
          url: urlData.publicUrl,
          uploaded_at: new Date().toISOString()
        });
      }

      if (newDocuments.length > 0) {
        onDocumentsChange([...documents, ...newDocuments]);
        toast.success(`${newDocuments.length} document(s) uploaded`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;

    const newDoc: DocumentReference = {
      id: uuidv4(),
      name: urlName.trim() || urlInput,
      url: urlInput.trim(),
      uploaded_at: new Date().toISOString()
    };

    onDocumentsChange([...documents, newDoc]);
    setUrlInput("");
    setUrlName("");
    toast.success('Document link added');
  };

  const handleRemoveDocument = (docId: string) => {
    onDocumentsChange(documents.filter(d => d.id !== docId));
    toast.success('Document removed');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Reference Documents
        </CardTitle>
        <CardDescription>
          Upload CIMs, deal memos, or other documents for AI context during scoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="space-y-2">
          <Label className="text-sm">Upload Files</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="flex-1"
            />
            {isUploading && (
              <Button disabled variant="outline" size="icon">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Supported: PDF, Word, Excel, CSV, Text files
          </p>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <Label className="text-sm">Or Add Link</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="Document name"
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              className="md:col-span-1"
            />
            <Input
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="md:col-span-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddUrl}
              disabled={!urlInput.trim()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Add Link
            </Button>
          </div>
        </div>

        {/* Document List */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm">Attached Documents ({documents.length})</Label>
            <div className="divide-y rounded-md border">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(doc.name)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {documents.length === 0 && (
          <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No documents attached yet</p>
            <p className="text-xs">Upload files or add links above</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
