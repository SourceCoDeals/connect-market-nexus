/**
 * MarketingDocumentsTab: Anonymous Teaser documents.
 *
 * Warning if project_name not set.
 * "Release to Buyer" and "Download as PDF" buttons open the Release Modal.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Send, Download, FileText, Upload, Loader2 } from 'lucide-react';
import { useDealDocumentsByType, useUploadDealDocument, type DealDocument } from '@/hooks/admin/use-document-distribution';
import { ReleaseModal } from './ReleaseModal';
import { format } from 'date-fns';

interface BuyerOption {
  id?: string;
  name: string;
  email: string;
  firm?: string;
  nda_status?: string;
  fee_agreement_status?: string;
}

interface MarketingDocumentsTabProps {
  dealId: string;
  projectName?: string | null;
  buyers?: BuyerOption[];
}

export function MarketingDocumentsTab({ dealId, projectName, buyers = [] }: MarketingDocumentsTabProps) {
  const { data: documents = [], isLoading } = useDealDocumentsByType(dealId, 'anonymous_teaser');
  const uploadMutation = useUploadDealDocument();
  const [releaseDoc, setReleaseDoc] = useState<DealDocument | null>(null);
  const [releaseMethod, setReleaseMethod] = useState<'tracked_link' | 'pdf_download'>('tracked_link');

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.doc';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadMutation.mutate({
          file,
          dealId,
          documentType: 'anonymous_teaser',
          title: file.name.replace(/\.[^.]+$/, ''),
        });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Warning if no project name */}
      {!projectName && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            Set a Project Name before distributing this document
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">Anonymous Teasers</h3>
        <Button variant="outline" size="sm" onClick={handleUpload} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1" />
          )}
          Upload Teaser
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No Anonymous Teaser generated yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleUpload}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload Teaser
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <Card key={doc.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Version {doc.version}</span>
                      <span>·</span>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                      {doc.is_current && (
                        <Badge variant="outline" className="text-xs bg-blue-50">Current</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReleaseDoc(doc);
                      setReleaseMethod('tracked_link');
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Release to Buyer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReleaseDoc(doc);
                      setReleaseMethod('pdf_download');
                    }}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download as PDF
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
        defaultMethod={releaseMethod}
      />
    </div>
  );
}
