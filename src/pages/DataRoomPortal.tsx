/**
 * DataRoomPortal: Public buyer-facing data room page.
 *
 * Route: /dataroom/:accessToken
 * No SourceCo login required — token-gated access only.
 * Shows: project name (not real company name), document list, download buttons.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Loader2, ShieldAlert, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getFileIcon, formatFileSize } from '@/lib/file-utils';

interface DataRoomDocument {
  id: string;
  title: string;
  file_size_bytes: number | null;
  created_at: string;
  mime_type?: string;
}

interface DataRoomData {
  project_name: string;
  documents: DataRoomDocument[];
}

export default function DataRoomPortal() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataRoomData | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataRoom = async () => {
      if (!accessToken) {
        setError('Invalid access link.');
        setLoading(false);
        return;
      }

      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke(
          'record-data-room-view',
          {
            body: { access_token: accessToken },
          },
        );

        if (fetchError || result?.error) {
          setError(result?.error || 'Access not found or has been revoked.');
        } else {
          setData(result);
        }
      } catch {
        setError('Unable to load data room. Please try again later.');
      }

      setLoading(false);
    };

    fetchDataRoom();
  }, [accessToken]);

  const handleDownload = async (documentId: string) => {
    if (!accessToken) return;

    setDownloading(documentId);
    try {
      const { data: result, error: downloadError } = await supabase.functions.invoke(
        'record-data-room-view',
        {
          body: { access_token: accessToken, document_id: documentId },
        },
      );

      if (downloadError || result?.error) {
        alert(result?.error || 'Download failed.');
      } else if (result?.download_url) {
        window.open(result.download_url, '_blank');
      }
    } catch {
      alert('Download failed. Please try again.');
    }
    setDownloading(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading data room...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
            <p className="text-gray-500">{error}</p>
            <p className="text-sm text-gray-400 mt-4">
              Please contact your SourceCo advisor if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Data room view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-lg">SourceCo</span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Lock className="h-3 w-3 mr-1" />
            Secure Access
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">
            Project {data?.project_name || 'Confidential'} — Due Diligence Documents
          </h1>
          <p className="text-sm text-gray-500">
            The following documents have been shared with you for review.
          </p>
        </div>

        {/* Document table */}
        {data?.documents && data.documents.length > 0 ? (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">
                    Document Name
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">
                    Date Added
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">
                    File Size
                  </th>
                  <th className="text-right text-sm font-medium text-gray-500 px-6 py-3">
                    Download
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.mime_type)}
                        <span className="font-medium text-sm">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc.id)}
                        disabled={downloading === doc.id}
                      >
                        {downloading === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No documents available at this time.</p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400">
            Powered by SourceCo. By accessing these materials, you confirm you have executed the
            required confidentiality agreements.
          </p>
        </div>
      </footer>
    </div>
  );
}
