/**
 * DataRoomFilesTab: Uploaded diligence files for post-NDA buyers.
 *
 * Upload, release to buyer, manage access per file.
 */

import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FileText, File, FileSpreadsheet, FileImage,
  Send, Trash2, Users, Download,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDealDocumentsByType,
  useUploadDealDocument,
  useDealDataRoomAccess,
  type DealDocument,
} from '@/hooks/admin/use-document-distribution';
import { ReleaseModal } from './ReleaseModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BuyerOption {
  id?: string;
  name: string;
  email: string;
  firm?: string;
  nda_status?: string;
  fee_agreement_status?: string;
}

interface DataRoomFilesTabProps {
  dealId: string;
  projectName?: string | null;
  buyers?: BuyerOption[];
}

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (mimeType?.includes('image')) {
    return <FileImage className="h-5 w-5 text-purple-500" />;
  }
  if (mimeType?.includes('pdf')) {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataRoomFilesTab({ dealId, projectName, buyers = [] }: DataRoomFilesTabProps) {
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading } = useDealDocumentsByType(dealId, 'data_room_file');
  const { data: accessRecords = [] } = useDealDataRoomAccess(dealId);
  const uploadMutation = useUploadDealDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [releaseDoc, setReleaseDoc] = useState<DealDocument | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleUpload = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      uploadMutation.mutate({
        file,
        dealId,
        documentType: 'data_room_file',
        title: file.name.replace(/\.[^.]+$/, ''),
      });
    }
  };

  const handleDelete = async (docId: string) => {
    const { error } = await supabase
      .from('deal_documents' as any)
      .update({ status: 'deleted', updated_at: new Date().toISOString() } as any)
      .eq('id', docId);
    if (error) {
      toast.error('Failed to delete document');
    } else {
      queryClient.invalidateQueries({ queryKey: ['deal-documents', dealId] });
      toast.success('Document deleted');
    }
  };

  const handlePreview = async (filePath: string | null) => {
    if (!filePath) return;
    const { data, error } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(filePath, 60);
    if (error) {
      toast.error('Failed to generate preview URL');
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // Count buyers with access to each document
  const getBuyerAccessCount = (docId: string): number => {
    return accessRecords.filter(a =>
      a.is_active && (!a.granted_document_ids || a.granted_document_ids.includes(docId))
    ).length;
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag and drop files here, or{' '}
          <button
            className="text-primary underline"
            onClick={() => fileInputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX, XLSX, and images accepted
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => e.target.files && handleUpload(e.target.files)}
        />
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No data room documents uploaded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <Card key={doc.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.mime_type)}
                  <div>
                    <p className="font-medium text-sm">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.file_size_bytes && <span>{formatFileSize(doc.file_size_bytes)}</span>}
                      <span>·</span>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {getBuyerAccessCount(doc.id)} buyers
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(doc.file_path)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReleaseDoc(doc)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Release
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReleaseModal
        open={!!releaseDoc}
        onOpenChange={open => { if (!open) setReleaseDoc(null); }}
        document={releaseDoc}
        dealId={dealId}
        projectName={projectName}
        buyers={buyers}
      />
    </div>
  );
}
