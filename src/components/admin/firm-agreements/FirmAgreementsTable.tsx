import { useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Users, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFirmAgreements, useFirmMembers, type FirmAgreement } from '@/hooks/admin/use-firm-agreements';
import { FirmSignerSelector } from './FirmSignerSelector';
import { FirmAgreementToggles } from './FirmAgreementToggles';
import { formatDistanceToNow } from 'date-fns';

export function FirmAgreementsTable() {
  const { data: firms, isLoading } = useFirmAgreements();
  const [expandedFirm, setExpandedFirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'signed' | 'unsigned'>('all');

  const filteredFirms = firms?.filter(firm => {
    const matchesSearch = 
      firm.primary_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firm.website_domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firm.email_domain?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'signed' && firm.fee_agreement_signed) ||
      (filterStatus === 'unsigned' && !firm.fee_agreement_signed);

    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading firms...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by firm name, domain..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            size="sm"
          >
            All Firms
          </Button>
          <Button
            variant={filterStatus === 'signed' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('signed')}
            size="sm"
          >
            Signed
          </Button>
          <Button
            variant={filterStatus === 'unsigned' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('unsigned')}
            size="sm"
          >
            Unsigned
          </Button>
        </div>
      </div>

      {/* Firms List */}
      <div className="border rounded-lg divide-y">
        {filteredFirms?.map((firm) => (
          <FirmRow
            key={firm.id}
            firm={firm}
            isExpanded={expandedFirm === firm.id}
            onToggleExpand={() => setExpandedFirm(expandedFirm === firm.id ? null : firm.id)}
          />
        ))}
        {filteredFirms?.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No firms found
          </div>
        )}
      </div>
    </div>
  );
}

function FirmRow({ 
  firm, 
  isExpanded, 
  onToggleExpand 
}: { 
  firm: FirmAgreement; 
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { data: members } = useFirmMembers(isExpanded ? firm.id : null);

  return (
    <div>
      {/* Main Row */}
      <div className="p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-4">
          {/* Expand Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>

          {/* Firm Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold truncate">{firm.primary_company_name}</h3>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {firm.member_count} {firm.member_count === 1 ? 'member' : 'members'}
              </Badge>
            </div>
            {firm.website_domain && (
              <p className="text-sm text-muted-foreground mt-1">{firm.website_domain}</p>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex gap-2">
            <Badge variant={firm.fee_agreement_signed ? 'default' : 'secondary'}>
              Fee: {firm.fee_agreement_signed ? 'Signed' : 'Unsigned'}
            </Badge>
            <Badge variant={firm.nda_signed ? 'default' : 'secondary'}>
              NDA: {firm.nda_signed ? 'Signed' : 'Unsigned'}
            </Badge>
          </div>

          {/* Agreement Toggles */}
          <FirmAgreementToggles firm={firm} members={members || []} />
        </div>
      </div>

      {/* Expanded Section - Members List */}
      {isExpanded && (
        <div className="bg-muted/30 p-4 border-t">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Firm Members ({members?.length || 0})
          </h4>
          <div className="space-y-2">
            {members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {member.user?.first_name} {member.user?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {member.is_primary_contact && (
                    <Badge variant="outline">Primary Contact</Badge>
                  )}
                  {member.user?.buyer_type && (
                    <Badge variant="secondary">{member.user.buyer_type}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Signing Info */}
          {(firm.fee_agreement_signed || firm.nda_signed) && (
            <div className="mt-4 pt-4 border-t space-y-2 text-sm text-muted-foreground">
              {firm.fee_agreement_signed && (
                <p>
                  Fee Agreement signed by <strong>{firm.fee_agreement_signed_by_name || 'Admin'}</strong>{' '}
                  {firm.fee_agreement_signed_at && formatDistanceToNow(new Date(firm.fee_agreement_signed_at), { addSuffix: true })}
                </p>
              )}
              {firm.nda_signed && (
                <p>
                  NDA signed by <strong>{firm.nda_signed_by_name || 'Admin'}</strong>{' '}
                  {firm.nda_signed_at && formatDistanceToNow(new Date(firm.nda_signed_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
