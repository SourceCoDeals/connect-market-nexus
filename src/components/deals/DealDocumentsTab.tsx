import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import {
  FileText,
  File,
  FileSpreadsheet,
  FileImage,
  Download,
  Eye,
  Loader2,
  FolderOpen,
  Lock,
  Shield,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface DealDocumentsTabProps {
  requestId: string;
  requestStatus: "pending" | "approved" | "rejected" | "on_hold";
  dealId: string;
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

export function DealDocumentsTab({ requestId: _requestId, requestStatus, dealId }: DealDocumentsTabProps) {
  const { user } = useAuth();
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

  const isPending = requestStatus === "pending";
  const isRejected = requestStatus === "rejected";

  // Check buyer's data room access
  const { data: access } = useQuery({
    queryKey: ["buyer-data-room-access", dealId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_room_access")
        .select("can_view_teaser, can_view_full_memo, can_view_data_room, fee_agreement_override")
        .eq("deal_id", dealId)
        .eq("marketplace_user_id", user?.id ?? '')
        .is("revoked_at", null)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!dealId && !!user?.id && !isPending,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["buyer-data-room-documents", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_room_documents")
        .select("id, folder_name, file_name, file_type, file_size_bytes, document_category, allow_download, created_at")
        .eq("deal_id", dealId)
        .eq("status", "active")
        .order("folder_name")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BuyerDocument[];
    },
    enabled: !!dealId && !!access,
  });

  // Fetch published memos
  const { data: memos = [] } = useQuery({
    queryKey: ["buyer-published-memos", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_memos")
        .select("id, memo_type, html_content, content, branding, published_at")
        .eq("deal_id", dealId)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!dealId && !!access,
  });

  // Check NDA status
  const { data: ndaStatus } = useQuery({
    queryKey: ["buyer-nda-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-buyer-nda-embed");
      if (error) return { ndaSigned: false };
      return data as { ndaSigned: boolean; embedSrc?: string };
    },
    enabled: !!user?.id && !isPending,
    staleTime: 60000,
  });

  // Pending state
  if (isPending) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="rounded-full bg-slate-100 p-3 mb-3">
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Documents will be available soon</p>
          <p className="text-xs text-slate-500 text-center max-w-xs">
            Once your request is accepted, you'll be able to access deal documents including teasers, memos, and data room files.
          </p>
        </div>
      </div>
    );
  }

  const handleViewDocument = async (docId: string) => {
    setLoadingDoc(docId);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-room-download?document_id=${docId}&action=view`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        window.open(data.url, "_blank");
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
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        window.open(data.url, "_blank");
      }
    } finally {
      setLoadingDoc(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-4 w-4 text-slate-400" />;
    if (fileType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes("spreadsheet") || fileType.includes("csv")) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    if (fileType.includes("image")) return <FileImage className="h-4 w-4 text-blue-500" />;
    return <File className="h-4 w-4 text-slate-400" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter memos by access
  const visibleMemos = memos.filter((memo) => {
    if (memo.memo_type === "anonymous_teaser" && access?.can_view_teaser) return true;
    if (memo.memo_type === "full_memo" && access?.can_view_full_memo) return true;
    return false;
  });

  // Filter documents by category access
  const visibleDocs = documents.filter((doc) => {
    if (doc.document_category === "anonymous_teaser" && access?.can_view_teaser) return true;
    if (doc.document_category === "full_memo" && access?.can_view_full_memo) return true;
    if (doc.document_category === "data_room" && access?.can_view_data_room) return true;
    return false;
  });

  // Group data room docs by folder
  const dataRoomDocs = visibleDocs.filter(d => d.document_category === "data_room");
  const docsByFolder = dataRoomDocs.reduce((acc, doc) => {
    if (!acc[doc.folder_name]) acc[doc.folder_name] = [];
    acc[doc.folder_name].push(doc);
    return acc;
  }, {} as Record<string, BuyerDocument[]>);

  const hasAnyContent = visibleMemos.length > 0 || visibleDocs.length > 0;

  return (
    <div className="space-y-4">
      {/* Rejected banner */}
      {isRejected && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
          <p className="text-xs text-slate-500">
            This deal is no longer active. Previously shared documents remain accessible below.
          </p>
        </div>
      )}

      {/* Agreements Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Agreements</h3>
        </div>
        <div className="px-5 py-3 space-y-2.5">
          {/* NDA */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-700">Non-Disclosure Agreement</span>
            </div>
            {ndaStatus?.ndaSigned ? (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
          </div>

          {/* Fee Agreement */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-700">Fee Agreement</span>
            </div>
            {access?.fee_agreement_override ? (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-50 text-slate-500 border-slate-200 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Not yet
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Teasers & Memos */}
      {visibleMemos.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Teasers & Memos</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleMemos.map((memo) => (
              <div key={memo.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {memo.memo_type === "anonymous_teaser" ? "Teaser" : "Full Memo"}
                  </Badge>
                  <span className="text-[10px] text-slate-400">
                    {memo.published_at && new Date(memo.published_at).toLocaleDateString()}
                  </span>
                </div>
                {memo.html_content ? (
                  <RichTextDisplay
                    content={memo.html_content}
                    className="prose-sm text-slate-700"
                    compact
                  />
                ) : (
                  <div className="space-y-2">
                    {((memo.content as { sections?: Array<{ title: string; content: string }> } | null)?.sections || []).map((section: { title: string; content: string }) => (
                      <div key={section.title}>
                        <h4 className="font-medium text-xs text-slate-900 mb-0.5">{section.title}</h4>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{section.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Room Files */}
      {Object.keys(docsByFolder).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Data Room</h3>
          </div>
          {Object.entries(docsByFolder)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([folder, docs]) => (
              <div key={folder}>
                <div className="px-5 py-2 bg-slate-50/50 border-b border-slate-100">
                  <span className="text-xs font-medium text-slate-600">{folder}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {docs.map((doc) => {
                    const isNew = (Date.now() - new Date(doc.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000; // 3 days
                    return (
                    <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50/50">
                      {getFileIcon(doc.file_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-slate-700 truncate">{doc.file_name}</p>
                          {isNew && (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0 h-4">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {formatFileSize(doc.file_size_bytes)}
                          {doc.file_size_bytes ? " · " : ""}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument(doc.id)}
                          disabled={loadingDoc === doc.id}
                          className="h-7 px-2 text-xs"
                        >
                          {loadingDoc === doc.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3 mr-1" />
                          )}
                          View
                        </Button>
                        {doc.allow_download && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc.id)}
                            disabled={loadingDoc === doc.id}
                            className="h-7 px-2 text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Non-data-room document files (teasers/memos as uploaded files) */}
      {visibleDocs.filter(d => d.document_category !== "data_room").length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Document Files</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleDocs
              .filter(d => d.document_category !== "data_room")
              .map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5">
                  {getFileIcon(doc.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{doc.file_name}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(doc.file_size_bytes)}
                      {doc.file_size_bytes ? " · " : ""}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDocument(doc.id)}
                      disabled={loadingDoc === doc.id}
                      className="h-7 px-2 text-xs"
                    >
                      {loadingDoc === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Eye className="h-3 w-3 mr-1" />
                      )}
                      View
                    </Button>
                    {doc.allow_download && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadDocument(doc.id)}
                        disabled={loadingDoc === doc.id}
                        className="h-7 px-2 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty state when no access or no content */}
      {!hasAnyContent && !isPending && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="rounded-full bg-slate-100 p-3 mb-3">
              <FolderOpen className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">No documents available yet</p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              The SourceCo team will share documents with you as the deal progresses.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
