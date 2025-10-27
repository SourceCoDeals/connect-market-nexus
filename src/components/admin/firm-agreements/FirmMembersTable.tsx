import { useState } from "react";
import { FirmMember } from "@/hooks/admin/use-firm-agreements";
import { ChevronDown } from "lucide-react";
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
  
  const memberName = member.member_type === 'marketplace_user' 
    ? `${member.user?.first_name} ${member.user?.last_name}`
    : member.lead_name || 'Unknown';
    
  const memberEmail = member.member_type === 'marketplace_user' 
    ? member.user?.email 
    : member.lead_email;

  return (
    <div className="group">
      {/* Member Row */}
      <div 
        className={cn(
          "flex items-center gap-6 px-6 py-4 transition-all duration-150",
          "hover:bg-muted/30",
          hasActivity && "cursor-pointer",
          isExpanded && "bg-muted/30"
        )}
        onClick={() => hasActivity && setIsExpanded(!isExpanded)}
      >
        {/* Expand Indicator + Name */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {hasActivity ? (
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground/40 transition-all duration-200 flex-shrink-0",
              isExpanded && "rotate-180 text-muted-foreground"
            )} />
          ) : (
            <div className="w-4" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">
                {memberName}
              </span>
              {hasActivity && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activityCount} {activityCount === 1 ? 'inquiry' : 'inquiries'}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {memberEmail}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
            member.member_type === 'marketplace_user'
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          )}>
            {member.member_type === 'marketplace_user' ? 'Registered' : 'Lead'}
          </span>
        </div>
      </div>

      {/* Expanded Activity View */}
      {isExpanded && hasActivity && (
        <div className="px-6 pb-6 pt-2 bg-muted/10 border-t border-border/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl">
              {/* Connection Requests */}
              {data?.requests && data.requests.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    Connection Requests ({data.requests.length})
                  </div>
                  <div className="space-y-1.5">
                    {data.requests.map((request: any) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between py-2.5 px-3 rounded-md bg-card border border-transparent hover:border-border/50 transition-all duration-150"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {request.listing?.title || 'Untitled Listing'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(request.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <span className={cn(
                          "ml-3 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
                          request.status === 'approved' && "bg-success/10 text-success",
                          request.status === 'pending' && "bg-warning/10 text-warning-foreground",
                          request.status === 'rejected' && "bg-muted text-muted-foreground"
                        )}>
                          {request.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deals */}
              {data?.deals && data.deals.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    Deals ({data.deals.length})
                  </div>
                  <div className="space-y-1.5">
                    {data.deals.map((deal: any) => (
                      <div
                        key={deal.id}
                        className="flex items-center justify-between py-2.5 px-3 rounded-md bg-card border border-transparent hover:border-border/50 transition-all duration-150"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {deal.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(deal.created_at), 'MMM d, yyyy')}
                            {deal.value && <span className="ml-2">•</span>}
                            {deal.value && (
                              <span className="ml-2 font-medium">
                                ${deal.value.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {deal.stage && (
                          <span 
                            className="ml-3 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                            style={{ 
                              backgroundColor: `${deal.stage.color}15`,
                              color: deal.stage.color
                            }}
                          >
                            {deal.stage.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FirmMembersTable({ members, isLoading }: FirmMembersTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-sm text-muted-foreground">
          No members found
        </div>
      </div>
    );
  }

  const marketplaceUsers = members.filter(m => m.member_type === 'marketplace_user');
  const leadMembers = members.filter(m => m.member_type === 'lead');

  return (
    <div className="space-y-8">
      {/* Marketplace Users Section */}
      {marketplaceUsers.length > 0 && (
        <div>
          <div className="px-6 py-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Registered Members
              </h3>
              <span className="text-xs text-muted-foreground">
                {marketplaceUsers.length} {marketplaceUsers.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {marketplaceUsers.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* Lead Members Section */}
      {leadMembers.length > 0 && (
        <div>
          <div className="px-6 py-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lead Inquiries
              </h3>
              <span className="text-xs text-muted-foreground">
                {leadMembers.length} {leadMembers.length === 1 ? 'lead' : 'leads'}
              </span>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {leadMembers.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
