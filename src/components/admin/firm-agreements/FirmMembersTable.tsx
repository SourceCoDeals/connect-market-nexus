import { useState } from "react";
import { FirmMember } from "@/hooks/admin/use-firm-agreements";
import { ChevronDown } from "lucide-react";
import { useMemberRequestsDeals } from "@/hooks/admin/use-member-requests-deals";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <div className="px-8 pb-8 pt-6 bg-gradient-to-b from-muted/5 to-transparent border-t border-border/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            </div>
          ) : (
            <div className="max-w-5xl">
              <Tabs defaultValue="requests" className="w-full">
                <TabsList className="grid w-full max-w-[420px] grid-cols-2 mb-6 h-10 bg-muted/30 p-1">
                  <TabsTrigger 
                    value="requests" 
                    className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    Requests
                    <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-semibold text-muted-foreground data-[state=active]:text-foreground/70 bg-background/50 data-[state=active]:bg-muted/50 rounded transition-colors">
                      {data?.requests?.length || 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="deals" 
                    className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    Deals
                    <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-semibold text-muted-foreground data-[state=active]:text-foreground/70 bg-background/50 data-[state=active]:bg-muted/50 rounded transition-colors">
                      {data?.deals?.length || 0}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="mt-0">
                  {data?.requests && data.requests.length > 0 ? (
                    <div className="max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/15 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/25">
                      <div className="space-y-2.5">
                        {data.requests.map((request: any, index: number) => (
                          <div
                            key={request.id}
                            className="group relative flex items-center justify-between gap-6 py-4 px-5 rounded-xl bg-card/50 border border-border/30 hover:border-border/60 hover:bg-card hover:shadow-sm transition-all duration-200"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            {/* Left content */}
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] font-medium text-foreground mb-1.5 truncate leading-snug">
                                {request.listing?.title || 'Untitled Listing'}
                              </div>
                              <div className="text-[13px] text-muted-foreground/80">
                                {format(new Date(request.created_at), 'MMM d, yyyy')}
                              </div>
                            </div>
                            
                            {/* Status badge */}
                            <span className={cn(
                              "inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border shadow-sm transition-all duration-200",
                              request.status === 'approved' && "bg-success/10 text-success border-success/30 shadow-success/5",
                              request.status === 'pending' && "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/30 shadow-amber-500/5",
                              request.status === 'rejected' && "bg-muted/60 text-muted-foreground/90 border-muted-foreground/20"
                            )}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                        <ChevronDown className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                      <div className="text-sm font-medium text-foreground/60 mb-1">No connection requests</div>
                      <div className="text-xs text-muted-foreground/50">This member hasn't made any requests yet</div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="deals" className="mt-0">
                  {data?.deals && data.deals.length > 0 ? (
                    <div className="max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/15 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/25">
                      <div className="space-y-2.5">
                        {data.deals.map((deal: any, index: number) => (
                          <div
                            key={deal.id}
                            className="group relative flex items-center justify-between gap-6 py-4 px-5 rounded-xl bg-card/50 border border-border/30 hover:border-border/60 hover:bg-card hover:shadow-sm transition-all duration-200"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            {/* Left content */}
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] font-medium text-foreground mb-2 truncate leading-snug">
                                {deal.title}
                              </div>
                              <div className="flex items-center gap-3 text-[13px]">
                                <span className="text-muted-foreground/80">
                                  {format(new Date(deal.created_at), 'MMM d, yyyy')}
                                </span>
                                {deal.value && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-border/60" />
                                    <span className="font-semibold text-foreground/90 tracking-tight">
                                      ${deal.value.toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Stage badge */}
                            {deal.stage && (
                              <span 
                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border shadow-sm transition-all duration-200"
                                style={{ 
                                  backgroundColor: `${deal.stage.color}0A`,
                                  borderColor: `${deal.stage.color}30`,
                                  color: deal.stage.color,
                                  boxShadow: `0 1px 2px ${deal.stage.color}08`
                                }}
                              >
                                {deal.stage.name}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                        <ChevronDown className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                      <div className="text-sm font-medium text-foreground/60 mb-1">No deals</div>
                      <div className="text-xs text-muted-foreground/50">No deals have been created yet</div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
