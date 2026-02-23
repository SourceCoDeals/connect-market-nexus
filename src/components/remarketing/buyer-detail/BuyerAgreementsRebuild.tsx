import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, FileSignature, Shield, Users, Download, Clock, Send } from "lucide-react";
import { useCreateDocuSealSubmission } from "@/hooks/admin/use-docuseal";
import { toast } from "sonner";

interface BuyerAgreementsRebuildProps {
  marketplaceFirmId: string | null;
  hasFeeAgreement: boolean;
  feeAgreementSource: string | null;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
}

function getDocuSealStatusBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
    sent: { label: "Sent", className: "bg-blue-100 text-blue-800" },
    viewed: { label: "Viewed", className: "bg-purple-100 text-purple-800" },
    completed: { label: "Completed", className: "bg-green-100 text-green-800" },
    signed: { label: "Signed", className: "bg-green-100 text-green-800" },
    declined: { label: "Declined", className: "bg-red-100 text-red-800" },
  };
  const config = map[status] || { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function BuyerAgreementsRebuild({
  marketplaceFirmId,
  hasFeeAgreement,
  feeAgreementSource,
  primaryContactEmail,
  primaryContactName,
}: BuyerAgreementsRebuildProps) {
  const createSubmission = useCreateDocuSealSubmission();

  const { data: firmAgreement, isLoading } = useQuery({
    queryKey: ["firm-agreement-detail", marketplaceFirmId],
    queryFn: async () => {
      if (!marketplaceFirmId) return null;
      const { data, error } = await supabase
        .from("firm_agreements")
        .select("*")
        .eq("id", marketplaceFirmId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!marketplaceFirmId,
  });

  const { data: firmMembers = [] } = useQuery({
    queryKey: ["firm-members-agreements", marketplaceFirmId],
    queryFn: async () => {
      if (!marketplaceFirmId) return [];
      const { data, error } = await supabase
        .from("firm_members")
        .select("*, profile:profiles(first_name, last_name, email)")
        .eq("firm_id", marketplaceFirmId);
      if (error) return [];
      return data || [];
    },
    enabled: !!marketplaceFirmId,
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ["agreement-audit-log", marketplaceFirmId],
    queryFn: async () => {
      if (!marketplaceFirmId) return [];
      const { data, error } = await supabase
        .from("agreement_audit_log")
        .select("*")
        .eq("firm_id", marketplaceFirmId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data || [];
    },
    enabled: !!marketplaceFirmId,
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  }

  const handleSendAgreement = (type: 'nda' | 'fee_agreement') => {
    if (!marketplaceFirmId || !primaryContactEmail || !primaryContactName) {
      toast.error('No primary contact with email found. Add a contact with email first.');
      return;
    }
    createSubmission.mutate({
      firmId: marketplaceFirmId,
      documentType: type,
      buyerEmail: primaryContactEmail,
      buyerName: primaryContactName,
      sendEmail: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* NDA Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            NDA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              {firmAgreement?.nda_signed ? (
                <Badge className="bg-green-600 text-xs"><Check className="h-3 w-3 mr-1" />Signed</Badge>
              ) : (
                <Badge variant="outline" className="text-xs"><X className="h-3 w-3 mr-1" />Not Signed</Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">DocuSeal Status</p>
              {getDocuSealStatusBadge(firmAgreement?.nda_docuseal_status ?? null) || <span className="text-sm text-muted-foreground">—</span>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Signed Date</p>
              <p className="text-sm">
                {firmAgreement?.nda_signed_at
                  ? new Date(firmAgreement.nda_signed_at).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Expiration</p>
              <p className="text-sm">
                {firmAgreement?.nda_expires_at
                  ? new Date(firmAgreement.nda_expires_at).toLocaleDateString()
                  : '—'}
              </p>
            </div>
          </div>
          {firmAgreement?.nda_document_url && (
            <div className="mt-3">
              <a
                href={firmAgreement.nda_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Download className="h-3 w-3" />
                Download Signed NDA
              </a>
            </div>
          )}
          {!firmAgreement?.nda_signed && marketplaceFirmId && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendAgreement('nda')}
                disabled={createSubmission.isPending}
              >
                <Send className="mr-2 h-3 w-3" />
                Send NDA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee Agreement Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" />
            Fee Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              {hasFeeAgreement ? (
                <Badge className={`text-xs ${
                  feeAgreementSource === 'pe_firm_inherited' ? 'bg-blue-600' :
                  feeAgreementSource === 'manual_override' ? 'bg-amber-600' :
                  'bg-green-600'
                }`}>
                  <Check className="h-3 w-3 mr-1" />
                  {feeAgreementSource === 'pe_firm_inherited' ? 'Inherited' :
                   feeAgreementSource === 'manual_override' ? 'Manual' :
                   'Signed'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs"><X className="h-3 w-3 mr-1" />Not Signed</Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">DocuSeal Status</p>
              {getDocuSealStatusBadge(firmAgreement?.fee_agreement_status ?? null) || <span className="text-sm text-muted-foreground">—</span>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Signed Date</p>
              <p className="text-sm">
                {firmAgreement?.fee_agreement_signed_at
                  ? new Date(firmAgreement.fee_agreement_signed_at).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Source</p>
              <p className="text-sm capitalize">{feeAgreementSource?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          {firmAgreement?.fee_agreement_document_url && (
            <div className="mt-3">
              <a
                href={firmAgreement.fee_agreement_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Download className="h-3 w-3" />
                Download Signed Fee Agreement
              </a>
            </div>
          )}
          {!hasFeeAgreement && marketplaceFirmId && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendAgreement('fee_agreement')}
                disabled={createSubmission.isPending}
              >
                <Send className="mr-2 h-3 w-3" />
                Send Fee Agreement
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Firm Members */}
      {firmMembers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Firm Members ({firmMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {firmMembers.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {member.profile?.first_name} {member.profile?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.profile?.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{member.role || 'Member'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      {auditLog.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Agreement History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLog.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {entry.agreement_type?.replace(/_/g, ' ')}
                  </Badge>
                  <span>
                    {entry.old_status && <span className="text-muted-foreground">{entry.old_status} → </span>}
                    <span className="font-medium">{entry.new_status}</span>
                  </span>
                  {entry.notes && <span className="text-muted-foreground text-xs">· {entry.notes}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!marketplaceFirmId && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            <p>This buyer is not linked to a marketplace firm.</p>
            <p className="text-xs mt-1">
              When the buyer's firm signs agreements on the marketplace, they'll sync here automatically.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
