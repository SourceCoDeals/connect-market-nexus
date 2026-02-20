import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, FileSignature, Shield, Users } from "lucide-react";

interface BuyerAgreementsPanelProps {
  buyerId: string;
  marketplaceFirmId: string | null;
  hasFeeAgreement: boolean;
  feeAgreementSource: string | null;
}

export function BuyerAgreementsPanel({
  buyerId,
  marketplaceFirmId,
  hasFeeAgreement,
  feeAgreementSource,
}: BuyerAgreementsPanelProps) {
  // Fetch firm agreement details if linked
  const { data: firmAgreement, isLoading } = useQuery({
    queryKey: ["firm-agreement", marketplaceFirmId],
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

  // Fetch firm members if linked
  const { data: firmMembers } = useQuery({
    queryKey: ["firm-members", marketplaceFirmId],
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Agreement Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" />
            Agreement Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {/* NDA Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">NDA</span>
              </div>
              {firmAgreement?.nda_signed ? (
                <div className="space-y-1">
                  <Badge className="bg-green-600 text-xs">
                    <Check className="h-3 w-3 mr-1" /> Signed
                  </Badge>
                  {firmAgreement.nda_signed_at && (
                    <p className="text-xs text-muted-foreground">
                      Signed {new Date(firmAgreement.nda_signed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <X className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Not signed</span>
                </div>
              )}
            </div>

            {/* Fee Agreement Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Fee Agreement</span>
              </div>
              {hasFeeAgreement ? (
                <div className="space-y-1">
                  <Badge className={`text-xs ${
                    feeAgreementSource === 'pe_firm_inherited' ? 'bg-blue-600' :
                    feeAgreementSource === 'manual_override' ? 'bg-amber-600' :
                    'bg-green-600'
                  }`}>
                    <Check className="h-3 w-3 mr-1" />
                    {feeAgreementSource === 'pe_firm_inherited' ? 'Inherited from PE Firm' :
                     feeAgreementSource === 'manual_override' ? 'Manual Override' :
                     feeAgreementSource === 'marketplace_synced' ? 'Marketplace Synced' :
                     'Signed'}
                  </Badge>
                  {firmAgreement?.fee_agreement_signed_at && (
                    <p className="text-xs text-muted-foreground">
                      Signed {new Date(firmAgreement.fee_agreement_signed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <X className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Not signed</span>
                </div>
              )}
            </div>
          </div>

          {!marketplaceFirmId && (
            <p className="mt-4 text-xs text-muted-foreground">
              This buyer is not linked to a marketplace firm. Agreements are managed
              through the marketplace. When the buyer&apos;s firm signs agreements there,
              they&apos;ll sync here automatically.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Firm Members */}
      {firmMembers && firmMembers.length > 0 && (
        <Card>
          <CardHeader>
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

      {/* Marketplace Profile (if synced) */}
      {marketplaceFirmId && firmAgreement && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marketplace Firm</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Company:</span>{" "}
                <span className="font-medium">{firmAgreement.company_name || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Domain:</span>{" "}
                <span className="font-medium">{firmAgreement.website_domain || firmAgreement.email_domain || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
