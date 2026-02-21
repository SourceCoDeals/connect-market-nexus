/**
 * InternalDocumentsTab: Full Detail Memo tab (INTERNAL ONLY).
 *
 * Red banner: never distributed to buyers.
 * Preview and personal-use download only — no release log entries.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye, Download, FileText } from 'lucide-react';
import { useDealDocumentsByType } from '@/hooks/admin/use-document-distribution';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface InternalDocumentsTabProps {
  dealId: string;
}

export function InternalDocumentsTab({ dealId }: InternalDocumentsTabProps) {
  const { data: documents = [], isLoading } = useDealDocumentsByType(dealId, 'full_detail_memo');

  const handlePreview = async (filePath: string | null) => {
    if (!filePath) {
      toast.error('No file available for preview');
      return;
    }
    const { data } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(filePath, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const handleDownload = async (filePath: string | null, title: string) => {
    if (!filePath) {
      toast.error('No file available for download');
      return;
    }
    const { data } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(filePath, 60);
    if (data?.signedUrl) {
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = title;
      link.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Red warning banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          INTERNAL ONLY — This document must never be sent to buyers
        </span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No Full Detail Memo generated yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <Card key={doc.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Version {doc.version}</span>
                      <span>·</span>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                      {doc.is_current && (
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(doc.file_path)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc.file_path, doc.title)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Personal Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
