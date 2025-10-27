import { useState } from "react";
import { FirmMember } from "@/hooks/admin/use-firm-agreements";
import { ChevronDown, Check, Clock, X } from "lucide-react";
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
        <div className="px-6 pb-5 pt-4 bg-slate-50/40 border-t border-slate-200/40">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
            </div>
          ) : (
            <div className="max-w-4xl">
              <Tabs defaultValue="requests" className="w-full">
                <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-50 border border-slate-200/60 shadow-sm p-1 mb-5">
                  <TabsTrigger 
                    value="requests" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                  >
                    Requests
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">
                      {data?.requests?.length || 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="deals" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                  >
                    Deals
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">
                      {data?.deals?.length || 0}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="mt-0">
                  {data?.requests && data.requests.length > 0 ? (
                    <div className="max-h-[360px] overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-200/60 scrollbar-track-transparent hover:scrollbar-thumb-slate-300/60">
                      {data.requests.map((request: any) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-slate-50/30 border border-slate-200/50 hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {request.listing?.title || 'Untitled Listing'}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {format(new Date(request.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)] text-[11px] font-medium text-slate-700 tracking-[0.02em] whitespace-nowrap">
                            {request.status === 'approved' && <Check className="h-3 w-3 text-emerald-600" />}
                            {request.status === 'pending' && <Clock className="h-3 w-3 text-amber-600" />}
                            {request.status === 'rejected' && <X className="h-3 w-3 text-slate-500" />}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-600">
                      No connection requests
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="deals" className="mt-0">
                  {data?.deals && data.deals.length > 0 ? (
                    <div className="max-h-[360px] overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-200/60 scrollbar-track-transparent hover:scrollbar-thumb-slate-300/60">
                      {data.deals.map((deal: any) => (
                        <div
                          key={deal.id}
                          className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-slate-50/30 border border-slate-200/50 hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {deal.title}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                              <span>{format(new Date(deal.created_at), 'MMM d, yyyy')}</span>
                              {deal.value && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-900">
                                    ${deal.value.toLocaleString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {deal.stage && (
                            <span 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)] text-[11px] font-medium tracking-[0.02em] whitespace-nowrap"
                              style={{ color: deal.stage.color }}
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: deal.stage.color }}
                              />
                              {deal.stage.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-600">
                      No deals
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
