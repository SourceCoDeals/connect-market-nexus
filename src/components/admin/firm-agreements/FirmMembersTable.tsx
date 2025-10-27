import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FirmMember } from "@/hooks/admin/use-firm-agreements";
import { Users, Mail, Building2, User, ChevronDown, FileText, TrendingUp } from "lucide-react";
import { useMemberRequestsDeals } from "@/hooks/admin/use-member-requests-deals";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface FirmMembersTableProps {
  members: FirmMember[];
  isLoading?: boolean;
}

function MemberRow({ member }: { member: FirmMember }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading } = useMemberRequestsDeals(
    member.user_id,
    member.lead_email
  );

  const hasActivity = (data?.requests.length || 0) > 0 || (data?.deals.length || 0) > 0;
  const activityCount = (data?.requests.length || 0) + (data?.deals.length || 0);

  return (
    <>
      <TableRow className="group hover:bg-muted/5 transition-all duration-200">
        <TableCell>
          <div className="flex items-center gap-2">
            {hasActivity && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-5 w-5 p-0 -ml-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {member.member_type === 'marketplace_user' 
                  ? `${member.user?.first_name} ${member.user?.last_name}`
                  : member.lead_name || 'N/A'
                }
              </span>
              {hasActivity && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground border-muted">
                  {activityCount} {activityCount === 1 ? 'activity' : 'activities'}
                </Badge>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {member.member_type === 'marketplace_user' ? member.user?.email : member.lead_email}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {member.member_type === 'marketplace_user' ? member.user?.company_name : member.lead_company || 'N/A'}
        </TableCell>
        <TableCell>
          {member.member_type === 'marketplace_user' ? (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              {member.user?.buyer_type || 'N/A'}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {member.inbound_lead_id ? (
                <>
                  <Mail className="h-3 w-3 mr-1" />
                  Inbound Lead
                </>
              ) : member.connection_request_id ? (
                <>
                  <Building2 className="h-3 w-3 mr-1" />
                  Connection Request
                </>
              ) : (
                'Manual'
              )}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              member.member_type === 'marketplace_user'
                ? "bg-green-500/10 text-green-700 border-green-500/20"
                : "bg-orange-500/10 text-orange-700 border-orange-500/20"
            )}
          >
            {member.member_type === 'marketplace_user' ? (
              <>
                <User className="h-3 w-3 mr-1" />
                Registered
              </>
            ) : (
              <>
                <Mail className="h-3 w-3 mr-1" />
                Lead Only
              </>
            )}
          </Badge>
        </TableCell>
      </TableRow>
      
      {isExpanded && hasActivity && (
        <TableRow>
          <TableCell colSpan={5} className="p-0">
            <div className="border-l-2 border-primary/10 pl-6 pr-6 py-4 space-y-4 bg-gradient-to-r from-muted/5 to-transparent animate-fade-in">
              {isLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground/60">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs font-medium">Loading activity...</span>
                  </div>
                </div>
              )}

              {data?.requests && data.requests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-primary/70" />
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Connection Requests ({data.requests.length})
                    </h5>
                  </div>
                  <div className="space-y-2">
                    {data.requests.map((request: any) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:border-border hover:shadow-sm transition-all duration-150 hover:-translate-y-0.5 cursor-default"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {request.listing?.title || 'Untitled Listing'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(request.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-2 py-0.5 font-medium ml-3"
                        >
                          {request.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data?.deals && data.deals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Deals ({data.deals.length})
                    </h5>
                  </div>
                  <div className="space-y-2">
                    {data.deals.map((deal: any) => (
                      <div
                        key={deal.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:border-border hover:shadow-sm transition-all duration-150 hover:-translate-y-0.5 cursor-default"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {deal.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(deal.created_at), 'MMM d, yyyy')}
                            {deal.value && ` • $${deal.value.toLocaleString()}`}
                          </p>
                        </div>
                        {deal.stage && (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-2 py-0.5 font-medium ml-3"
                            style={{ 
                              borderColor: `${deal.stage.color}30`,
                              backgroundColor: `${deal.stage.color}08`,
                              color: deal.stage.color
                            }}
                          >
                            {deal.stage.name}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function FirmMembersTable({ members, isLoading }: FirmMembersTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Users className="h-5 w-5 animate-pulse mr-2" />
        Loading members...
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mb-3 opacity-20" />
        <p>No members found</p>
      </div>
    );
  }

  const marketplaceUsers = members.filter(m => m.member_type === 'marketplace_user');
  const leadMembers = members.filter(m => m.member_type === 'lead');

  return (
    <div className="space-y-6">
      {marketplaceUsers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Marketplace Users ({marketplaceUsers.length})</h4>
          </div>
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Company</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketplaceUsers.map((member) => (
                  <MemberRow key={member.id} member={member} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {leadMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-orange-600" />
            <h4 className="font-medium">Lead Members ({leadMembers.length})</h4>
          </div>
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Company</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Source</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadMembers.map((member) => (
                  <MemberRow key={member.id} member={member} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
