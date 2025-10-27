import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FirmMember } from "@/hooks/admin/use-firm-agreements";
import { Users, Mail, Building2, User } from "lucide-react";

interface FirmMembersTableProps {
  members: FirmMember[];
  isLoading?: boolean;
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketplaceUsers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user?.first_name} {member.user?.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.user?.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.user?.company_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {member.user?.buyer_type || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                      <User className="h-3 w-3 mr-1" />
                      Registered
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {leadMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-orange-600" />
            <h4 className="font-medium">Lead Members ({leadMembers.length})</h4>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.lead_name || 'N/A'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.lead_email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.lead_company || 'N/A'}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
                      <Mail className="h-3 w-3 mr-1" />
                      Lead Only
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
