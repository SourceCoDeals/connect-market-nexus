import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NonMarketplaceUser, NonMarketplaceUserFilters } from "@/types/non-marketplace-user";
import { ChevronDown, ChevronRight, Building2, Mail, Phone, AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface NonMarketplaceUsersTableProps {
  users: NonMarketplaceUser[];
  isLoading: boolean;
  filters?: NonMarketplaceUserFilters;
}

const SourceBadge = ({ source }: { source: 'connection_request' | 'inbound_lead' | 'deal' }) => {
  const config = {
    connection_request: {
      label: 'Request',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    inbound_lead: {
      label: 'Lead',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    deal: {
      label: 'Deal',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
    },
  };

  const { label, className } = config[source];

  return (
    <Badge variant="outline" className={cn("text-xs font-medium", className)}>
      {label}
    </Badge>
  );
};

const NonMarketplaceUsersTableSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 bg-muted/50 rounded-md animate-pulse"></div>
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <div key={i} className="h-16 bg-muted/30 rounded-md animate-pulse"></div>
      ))}
  </div>
);

export function NonMarketplaceUsersTable({ users, isLoading, filters }: NonMarketplaceUsersTableProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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

  if (isLoading) {
    return <NonMarketplaceUsersTableSkeleton />;
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
            <TableHead>Firm</TableHead>
            <TableHead className="text-center">Activity</TableHead>
            <TableHead className="text-center">Agreements</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => {
            const isExpanded = expandedUserId === user.id;
            const totalActivity = user.connection_requests_count + user.inbound_leads_count + user.deals_count;

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
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{user.name}</span>
                      {user.role && <span className="text-xs text-muted-foreground">{user.role}</span>}
                      {user.potential_profile_id && (
                        <Badge variant="outline" className="w-fit bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Profile Match
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        {user.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.company ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{user.company}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={user.source} />
                  </TableCell>
                  <TableCell>
                    {user.firm_name ? (
                      <Badge variant="outline" className="text-xs">
                        {user.firm_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {user.connection_requests_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {user.connection_requests_count} CR
                        </Badge>
                      )}
                      {user.inbound_leads_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {user.inbound_leads_count} IL
                        </Badge>
                      )}
                      {user.deals_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {user.deals_count} D
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      {user.nda_status === 'signed' && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          NDA
                        </Badge>
                      )}
                      {user.fee_agreement_status === 'signed' && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Fee
                        </Badge>
                      )}
                      {!user.nda_status && !user.fee_agreement_status && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/20 p-6">
                      <div className="space-y-4">
                        {/* Potential Profile Match Warning */}
                        {user.potential_profile_id && (
                          <Alert className="bg-amber-50 border-amber-200">
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                            <AlertDescription className="text-amber-800">
                              This contact's email matches an existing marketplace profile: <strong>{user.potential_profile_name}</strong>.
                              Consider merging or linking these records.
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Associated Records */}
                        <div className="grid grid-cols-3 gap-4">
                          {/* Connection Requests */}
                          {user.associated_records.connection_requests.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Connection Requests ({user.connection_requests_count})
                              </h4>
                              <div className="space-y-2">
                                {user.associated_records.connection_requests.map((cr) => (
                                  <div key={cr.id} className="text-xs bg-card rounded p-2 border">
                                    <div className="text-muted-foreground">
                                      {formatDistanceToNow(new Date(cr.created_at), { addSuffix: true })}
                                    </div>
                                    {cr.lead_nda_signed && (
                                      <Badge variant="outline" className="mt-1 text-xs bg-green-50 text-green-700 border-green-200">
                                        NDA Signed
                                      </Badge>
                                    )}
                                    {cr.lead_fee_agreement_signed && (
                                      <Badge variant="outline" className="mt-1 ml-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        Fee Agreement
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Inbound Leads */}
                          {user.associated_records.inbound_leads.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Inbound Leads ({user.inbound_leads_count})
                              </h4>
                              <div className="space-y-2">
                                {user.associated_records.inbound_leads.map((il) => (
                                  <div key={il.id} className="text-xs bg-card rounded p-2 border">
                                    <div className="font-medium">{il.source}</div>
                                    <div className="text-muted-foreground">
                                      {formatDistanceToNow(new Date(il.created_at), { addSuffix: true })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Deals */}
                          {user.associated_records.deals.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Deals ({user.deals_count})
                              </h4>
                              <div className="space-y-2">
                                {user.associated_records.deals.map((deal: any) => (
                                  <div key={deal.id} className="text-xs bg-card rounded p-2 border">
                                    <div className="font-medium">{deal.title}</div>
                                    {deal.listing && (
                                      <div className="text-muted-foreground text-xs mt-0.5">
                                        Listing: {Array.isArray(deal.listing) ? deal.listing[0]?.title : deal.listing?.title}
                                      </div>
                                    )}
                                    <div className="text-muted-foreground mt-1">
                                      {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })}
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                      {deal.nda_status && deal.nda_status !== 'not_sent' && (
                                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                          NDA: {deal.nda_status}
                                        </Badge>
                                      )}
                                      {deal.fee_agreement_status && deal.fee_agreement_status !== 'not_sent' && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                          Fee: {deal.fee_agreement_status}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button variant="outline" size="sm">
                            <Mail className="h-3 w-3 mr-2" />
                            Send Invitation
                          </Button>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-2" />
                            View All Records
                          </Button>
                          {user.potential_profile_id && (
                            <Button variant="outline" size="sm" className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                              <AlertTriangle className="h-3 w-3 mr-2" />
                              Review Match
                            </Button>
                          )}
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
    </div>
  );
}
