/**
 * BuyerDataRoom: Premium buyer-facing view of documents shared with them
 *
 * Shown on a deal's listing detail page when the buyer has data room access.
 * Only shows documents matching their enabled categories.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileText,
  File,
  FileSpreadsheet,
  FileImage,
  Download,
  Eye,
  Loader2,
  Lock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeHtml } from '@/lib/sanitize';

interface BuyerDataRoomProps {
  dealId: string;
  connectionApproved?: boolean;
}

interface BuyerDocument {
  id: string;
  folder_name: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  document_category: string;
  allow_download: boolean;
  created_at: string;
}

export function BuyerDataRoom({ dealId, connectionApproved }: BuyerDataRoomProps) {
  const { user } = useAuth();
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

  // Check if buyer has any access
  const { data: access } = useQuery({
    queryKey: ['buyer-data-room-access', dealId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_room_access')
        .select('can_view_teaser, can_view_full_memo, can_view_data_room')
        .eq('deal_id', dealId)
        .eq('marketplace_user_id', user?.id ?? '')
        .is('revoked_at', null)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;

      // Dual-ID fallback: check if access exists on the source deal
      const { data: listingRow } = await supabase
        .from('listings')
        .select('source_deal_id')
        .eq('id', dealId)
        .maybeSingle();

      if (listingRow?.source_deal_id) {
        const { data: sourceAccess, error: sourceErr } = await supabase
          .from('data_room_access')
          .select('can_view_teaser, can_view_full_memo, can_view_data_room')
          .eq('deal_id', listingRow.source_deal_id)
          .eq('marketplace_user_id', user?.id ?? '')
          .is('revoked_at', null)
          .maybeSingle();

        if (sourceErr) throw sourceErr;
        return sourceAccess;
      }

      return null;
    },
    enabled: !!dealId && !!user?.id,
  });

  // Build allowed categories from access toggles
  const allowedCategories = new Set<string>();
  if (access?.can_view_teaser) allowedCategories.add('anonymous_teaser');
  if (access?.can_view_full_memo) allowedCategories.add('full_memo');
  if (access?.can_view_data_room) allowedCategories.add('data_room');

  // Fetch documents filtered by status, then client-filter by category
  const { data: documents = [] } = useQuery({
    queryKey: ['buyer-data-room-documents', dealId, Array.from(allowedCategories).sort().join(',')],
    queryFn: async () => {
      const selectCols =
        'id, folder_name, file_name, file_type, file_size_bytes, document_category, allow_download, created_at';

      const { data: primaryDocs, error } = await supabase
        .from('data_room_documents')
        .select(selectCols)
        .eq('deal_id', dealId)
        .eq('status', 'active')
        .order('folder_name')
        .order('created_at', { ascending: false });

      if (error) throw error;

      let allDocs = (primaryDocs || []) as BuyerDocument[];

      // Fallback: check source_deal_id documents
      if (allDocs.length === 0) {
        const { data: listingRow } = await supabase
          .from('listings')
          .select('source_deal_id')
          .eq('id', dealId)
          .maybeSingle();

        if (listingRow?.source_deal_id) {
          const { data: sourceDocs } = await supabase
            .from('data_room_documents')
            .select(selectCols)
            .eq('deal_id', listingRow.source_deal_id)
            .eq('status', 'active')
            .order('folder_name')
            .order('created_at', { ascending: false });

          if (sourceDocs) {
            allDocs = sourceDocs as BuyerDocument[];
          }
        }
      }

      return allDocs.filter((doc) => allowedCategories.has(doc.document_category));
    },
    enabled: !!dealId && !!access && allowedCategories.size > 0,
  });

  // Fetch published memos
  const { data: memos = [] } = useQuery({
    queryKey: ['buyer-published-memos', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_memos')
        .select('id, memo_type, content, html_content, branding, published_at')
        .eq('deal_id', dealId)
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!dealId && !!access,
  });

  if (
    !access ||
    (!access.can_view_teaser && !access.can_view_full_memo && !access.can_view_data_room)
  ) {
    if (connectionApproved) {
      return (
        <div className="space-y-6 py-2">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Data Room</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Your access is being set up. Please check back shortly.
          </p>
        </div>
      );
    }
    return null;
  }

  const handleViewDocument = async (docId: string) => {
    setLoadingDoc(docId);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-room-download?document_id=${docId}&action=view`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );

      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      }
    } finally {
      setLoadingDoc(null);
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    setLoadingDoc(docId);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-room-download?document_id=${docId}&action=download`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );

      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      }
    } finally {
      setLoadingDoc(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    const baseClass = 'h-4 w-4';
    if (!fileType) return <File className={`${baseClass} text-muted-foreground/60`} />;
    if (fileType.includes('pdf')) return <FileText className={`${baseClass} text-red-500/80`} />;
    if (fileType.includes('spreadsheet') || fileType.includes('csv'))
      return <FileSpreadsheet className={`${baseClass} text-emerald-600/80`} />;
    if (fileType.includes('image')) return <FileImage className={`${baseClass} text-blue-500/80`} />;
    return <File className={`${baseClass} text-muted-foreground/60`} />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group documents by folder
  const documentsByFolder = documents.reduce(
    (acc, doc) => {
      if (!acc[doc.folder_name]) acc[doc.folder_name] = [];
      acc[doc.folder_name].push(doc);
      return acc;
    },
    {} as Record<string, BuyerDocument[]>,
  );

  const totalCount = documents.length + memos.length;

  return (
    <div className="space-y-6 py-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Data Room
          </h3>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalCount} document{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Published Memos */}
      {memos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground/70">
            Lead Memos
          </p>
          <div className="border-t border-border/40" />
          {memos.map((memo) => (
            <div key={memo.id} className="py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-foreground">
                  {memo.memo_type === 'anonymous_teaser' ? 'Teaser' : 'Full Memo'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {memo.published_at && new Date(memo.published_at).toLocaleDateString()}
                </span>
              </div>
              {memo.html_content ? (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(memo.html_content) }}
                />
              ) : (
                <div className="space-y-3">
                  {(
                    (
                      memo.content as {
                        sections?: Array<{ title: string; content: string }>;
                      } | null
                    )?.sections || []
                  ).map((section: { title: string; content: string }) => (
                    <div key={section.title}>
                      <h4 className="text-sm font-medium mb-1">{section.title}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-b border-border/40 mt-3" />
            </div>
          ))}
        </div>
      )}

      {/* Documents by Folder */}
      {Object.keys(documentsByFolder).length > 0 &&
        Object.entries(documentsByFolder)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([folder, docs]) => (
            <div key={folder} className="space-y-1">
              <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground/70 mb-2">
                {folder}
              </p>
              <div className="border-t border-border/40" />
              {docs.map((doc, i) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 py-3 ${i < docs.length - 1 ? 'border-b border-border/20' : ''}`}
                >
                  {getFileIcon(doc.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatFileSize(doc.file_size_bytes)}
                      {doc.file_size_bytes ? ' · ' : ''}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDocument(doc.id)}
                      disabled={loadingDoc === doc.id}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {loadingDoc === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {doc.allow_download && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadDocument(doc.id)}
                        disabled={loadingDoc === doc.id}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

      {/* Empty state */}
      {documents.length === 0 && memos.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No documents available yet.
        </p>
      )}
    </div>
  );
}
