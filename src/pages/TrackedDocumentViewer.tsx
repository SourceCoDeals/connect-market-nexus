/**
 * TrackedDocumentViewer: Public buyer-facing page for tracked document links.
 *
 * Route: /view/:linkToken
 * No SourceCo login required — token-gated access only.
 * Calls record-link-open to track the open and get a signed download URL.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Download, FileText, Loader2, ShieldAlert, Lock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LinkOpenResult {
  redirect_url: string;
  document_title: string | null;
  first_open: boolean;
}

export default function TrackedDocumentViewer() {
  const { linkToken } = useParams<{ linkToken: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LinkOpenResult | null>(null);

  useEffect(() => {
    const openLink = async () => {
      if (!linkToken) {
        setError('Invalid document link.');
        setLoading(false);
        return;
      }

      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke(
          'record-link-open',
          {
            body: { link_token: linkToken },
          }
        );

        if (fetchError || result?.error) {
          setError(result?.error || 'This link is no longer valid.');
        } else {
          setData(result);
        }
      } catch {
        setError('Unable to load document. Please try again later.');
      }

      setLoading(false);
    };

    openLink();
  }, [linkToken]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading document...</p>
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

  // Document ready
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
            Tracked Document
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-xl font-bold mb-2">
              {data?.document_title || 'Investment Document'}
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              This document has been shared with you by the SourceCo Deal Team.
            </p>
            <Button
              size="lg"
              onClick={() => {
                if (data?.redirect_url) {
                  window.open(data.redirect_url, '_blank');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              View Document
            </Button>
            <p className="text-xs text-gray-400 mt-6">
              This is a private, tracked link. Document access is logged.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400">
            Powered by SourceCo. This document is confidential and intended solely for the named recipient.
          </p>
        </div>
      </footer>
    </div>
  );
}
