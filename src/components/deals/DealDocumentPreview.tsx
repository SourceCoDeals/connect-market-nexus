import { FolderOpen, ArrowRight, Lock, FileText, Shield, CheckCircle2, Clock } from "lucide-react";
// Note: NDA status shown in full Documents tab (requires edge function call); preview only shows fee agreement
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface DealDocumentPreviewProps {
  requestId: string;
  requestStatus: "pending" | "approved" | "rejected" | "on_hold";
  dealId: string;
  onViewAll: () => void;
}

export function DealDocumentPreview({ requestId: _requestId, requestStatus, dealId, onViewAll }: DealDocumentPreviewProps) {
  const { user } = useAuth();

  const isPending = requestStatus === "pending";

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

  // Get recent documents count
  const { data: docCount = 0 } = useQuery({
    queryKey: ["buyer-data-room-doc-count", dealId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("data_room_documents")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId)
        .eq("status", "active");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!dealId && !!access,
  });

  // Get published memos count
  const { data: memoCount = 0 } = useQuery({
    queryKey: ["buyer-published-memo-count", dealId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lead_memos")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId)
        .eq("status", "published");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!dealId && !!access,
  });

  // Pending state
  if (isPending) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
        </div>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="rounded-full bg-slate-100 p-2 shrink-0">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500">
            Documents will be available once your request is accepted.
          </p>
        </div>
      </div>
    );
  }

  const hasAccess = access && (access.can_view_teaser || access.can_view_full_memo || access.can_view_data_room);
  const totalDocs = docCount + memoCount;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
          {totalDocs > 0 && (
            <span className="text-xs text-slate-400">{totalDocs}</span>
          )}
        </div>
        {hasAccess && (
          <button
            onClick={onViewAll}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Quick status summary */}
      <div className="px-5 py-3 space-y-2">
        {/* Agreement status row */}
        <div className="flex items-center gap-3">
          <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-600">Fee Agreement:</span>
            {access?.fee_agreement_override ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                Signed
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-slate-50 text-slate-500 border-slate-200">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                Pending
              </Badge>
            )}
          </div>
        </div>

        {/* Document count row */}
        {hasAccess && (
          <div className="flex items-center gap-3">
            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-600">
              {totalDocs > 0
                ? `${totalDocs} document${totalDocs !== 1 ? "s" : ""} available`
                : "No documents shared yet"}
            </span>
          </div>
        )}

        {!hasAccess && (
          <div className="flex items-center gap-3">
            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">
              Documents will be shared as the deal progresses.
            </span>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {hasAccess && totalDocs > 0 && (
        <div className="px-5 py-2.5 border-t border-slate-100">
          <button
            onClick={onViewAll}
            className="w-full text-xs text-slate-500 hover:text-slate-700 font-medium py-1 transition-colors"
          >
            Open documents
          </button>
        </div>
      )}
    </div>
  );
}
