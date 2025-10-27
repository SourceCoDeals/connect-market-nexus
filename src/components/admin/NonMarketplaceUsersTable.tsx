import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Mail, FileText, Briefcase, ExternalLink, Eye, Send } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { NonMarketplaceUser, NonMarketplaceUserFilters } from "@/types/non-marketplace-user";
import { AgreementToggle } from "./non-marketplace/AgreementToggle";
import { SendInvitationDialog } from "./non-marketplace/SendInvitationDialog";

interface NonMarketplaceUsersTableProps {
  users: NonMarketplaceUser[];
  isLoading: boolean;
  filters?: NonMarketplaceUserFilters;
}

// Minimal monochrome source badge (Stripe-level design)
const SourceBadge = ({ source }: { source: NonMarketplaceUser['source'] }) => {
  const getSourceConfig = (src: NonMarketplaceUser['source'] ) => {
    switch (src) {
      case 'connection_request':
        return { label: 'Request', icon: FileText };
      case 'inbound_lead':
        return { label: 'Lead', icon: Mail };
      case 'deal':
        return { label: 'Deal', icon: Briefcase };
    }
  };

  const config = getSourceConfig(source);
  const Icon = config.icon;

  return (
    <Badge variant="outline" className="text-xs font-normal gap-1 border-border/50 text-muted-foreground bg-transparent">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// Skeleton loading state
const NonMarketplaceUsersTableSkeleton = () => (
  <div className="space-y-3">
    {Array(5).fill(0).map((_, i) => (
      <div key={i} className="h-16 bg-muted/30 rounded-md animate-pulse"></div>
    ))}
  </div>
);

export const NonMarketplaceUsersTable = ({ users, isLoading, filters }: NonMarketplaceUsersTableProps) => {
  const navigate = useNavigate();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [invitationUser, setInvitationUser] = useState<NonMarketplaceUser | null>(null);

  // Filter users based on filters prop
  const filteredUsers = useMemo(() => {
    if (!filters) return users;

    return users.filter((user) => {
      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesSearch =
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.company?.toLowerCase().includes(query) ||
          user.role?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Source filter
      if (filters.sourceFilter && filters.sourceFilter !== 'all') {
        if (user.source !== filters.sourceFilter) return false;
      }

      // Firm filter
      if (filters.firmFilter && filters.firmFilter !== 'all') {
        if (user.firm_id !== filters.firmFilter) return false;
      }

      // Profile match filter
      if (filters.hasProfileMatch !== undefined) {
        if (filters.hasProfileMatch && !user.potential_profile_id) return false;
        if (!filters.hasProfileMatch && user.potential_profile_id) return false;
      }

      return true;
    });
  }, [users, filters]);

  const toggleExpanded = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleViewAllRecords = (user: NonMarketplaceUser) => {
    if (user.source === 'connection_request') {
      navigate(`/admin/connection-requests?email=${user.email}`);
    } else if (user.source === 'inbound_lead') {
      navigate(`/admin/inbound-leads?email=${user.email}`);
    } else if (user.source === 'deal') {
      navigate(`/admin/deals?contact=${user.email}`);
    }
  };

  if (isLoading) {
    return <NonMarketplaceUsersTableSkeleton />;
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No non-marketplace contacts found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-8"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-center">Agreements</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => {
            const isExpanded = expandedUserId === user.id;

            return (
              <>
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpanded(user.id)}
                >
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{user.name}</span>
                      {user.role && (
                        <span className="text-xs text-muted-foreground">{user.role}</span>
                      )}
                      {user.phone && (
                        <span className="text-xs text-muted-foreground">{user.phone}</span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-sm">{user.company || '—'}</span>
                  </TableCell>
                  
                  <TableCell>
                    <SourceBadge source={user.source} />
                  </TableCell>
                  
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-3">
                      <AgreementToggle
                        user={user}
                        type="nda"
                        checked={user.nda_status === 'signed'}
                      />
                      <AgreementToggle
                        user={user}
                        type="fee"
                        checked={user.fee_agreement_status === 'signed'}
                      />
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </span>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/10 p-6">
                      <div className="space-y-6">
                        {/* Activity Breakdown */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3 text-foreground">Associated Activity</h4>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Connection Requests */}
                            {user.associated_records.connection_requests.length > 0 && (
                              <div className="bg-card border rounded-md p-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    Connection Requests ({user.associated_records.connection_requests.length})
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {user.associated_records.connection_requests.map((cr: any) => (
                                    <div key={cr.id} className="space-y-1">
                                      {cr.listing?.title && (
                                        <div className="font-medium text-sm text-foreground">{cr.listing.title}</div>
                                      )}
                                      <div className="text-xs text-muted-foreground">
                                        {format(new Date(cr.created_at), 'MMM d, yyyy')} · {format(new Date(cr.created_at), 'h:mm a')}
                                      </div>
                                      {(cr.lead_nda_signed || cr.lead_fee_agreement_signed) && (
                                        <div className="flex gap-1 mt-1">
                                          {cr.lead_nda_signed && (
                                            <Badge variant="outline" className="text-xs">NDA Signed</Badge>
                                          )}
                                          {cr.lead_fee_agreement_signed && (
                                            <Badge variant="outline" className="text-xs">Fee Signed</Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Inbound Leads */}
                            {user.associated_records.inbound_leads.length > 0 && (
                              <div className="bg-card border rounded-md p-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    Inbound Leads ({user.associated_records.inbound_leads.length})
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {user.associated_records.inbound_leads.map((lead: any) => (
                                    <div key={lead.id} className="space-y-1">
                                      <div className="font-medium text-sm">{lead.source || 'Contact Form'}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {format(new Date(lead.created_at), 'MMM d, yyyy')} · {format(new Date(lead.created_at), 'h:mm a')}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Deals */}
                            {user.associated_records.deals.length > 0 && (
                              <div className="bg-card border rounded-md p-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    Deals ({user.associated_records.deals.length})
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {user.associated_records.deals.map((deal: any) => (
                                    <div key={deal.id} className="space-y-1">
                                      <div className="font-medium text-sm">{deal.title || 'Untitled Deal'}</div>
                                      {deal.listing?.title && (
                                        <div className="text-xs text-muted-foreground">For: {deal.listing.title}</div>
                                      )}
                                      {(deal.nda_status === 'signed' || deal.fee_agreement_status === 'signed') && (
                                        <div className="flex gap-1 mt-1">
                                          {deal.nda_status === 'signed' && (
                                            <Badge variant="outline" className="text-xs">NDA Signed</Badge>
                                          )}
                                          {deal.fee_agreement_status === 'signed' && (
                                            <Badge variant="outline" className="text-xs">Fee Signed</Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3 text-foreground">Actions</h4>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvitationUser(user);
                              }}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send Invitation
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewAllRecords(user);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View All Records
                            </Button>
                            {user.potential_profile_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/users?profile=${user.potential_profile_id}`);
                                }}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Review Match
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <SendInvitationDialog
        user={invitationUser}
        open={!!invitationUser}
        onOpenChange={(open) => !open && setInvitationUser(null)}
      />
    </div>
  );
};
