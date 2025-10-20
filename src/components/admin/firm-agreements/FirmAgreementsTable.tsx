import { useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Users, Mail, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFirmAgreements, useFirmMembers, type FirmAgreement } from '@/hooks/admin/use-firm-agreements';
import { FirmAgreementToggles } from './FirmAgreementToggles';
import { FirmBulkActions } from './FirmBulkActions';
import { FirmManagementTools } from './FirmManagementTools';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function FirmAgreementsTable() {
  const { data: firms, isLoading } = useFirmAgreements();
  const [expandedFirm, setExpandedFirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'both_signed' | 'partial' | 'none'>('all');

  const filteredFirms = firms?.filter(firm => {
    const matchesSearch = 
      firm.primary_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firm.website_domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firm.email_domain?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'both_signed' && firm.fee_agreement_signed && firm.nda_signed) ||
      (filterStatus === 'partial' && (firm.fee_agreement_signed !== firm.nda_signed)) ||
      (filterStatus === 'none' && !firm.fee_agreement_signed && !firm.nda_signed);

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: firms?.length || 0,
    bothSigned: firms?.filter(f => f.fee_agreement_signed && f.nda_signed).length || 0,
    partial: firms?.filter(f => f.fee_agreement_signed !== f.nda_signed).length || 0,
    none: firms?.filter(f => !f.fee_agreement_signed && !f.nda_signed).length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="space-y-3 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading firms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Firms"
          value={stats.total}
          icon={Building2}
          variant="default"
        />
        <StatCard
          label="Fully Signed"
          value={stats.bothSigned}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Partially Signed"
          value={stats.partial}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="No Agreements"
          value={stats.none}
          icon={XCircle}
          variant="muted"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border/50">
        <div className="flex-1">
          <Input
            placeholder="Search firms by name, domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 bg-background border-border/60"
          />
        </div>
        
        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-[180px] h-9 bg-background border-border/60">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Firms</SelectItem>
            <SelectItem value="both_signed">Both Signed</SelectItem>
            <SelectItem value="partial">Partially Signed</SelectItem>
            <SelectItem value="none">No Agreements</SelectItem>
          </SelectContent>
        </Select>

        <FirmManagementTools />
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/30 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="col-span-5">Firm</div>
          <div className="col-span-2">Members</div>
          <div className="col-span-2">Fee Agreement</div>
          <div className="col-span-2">NDA</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border/40">
          {filteredFirms?.map((firm) => (
            <FirmRow
              key={firm.id}
              firm={firm}
              isExpanded={expandedFirm === firm.id}
              onToggleExpand={() => setExpandedFirm(expandedFirm === firm.id ? null : firm.id)}
            />
          ))}
          {filteredFirms?.length === 0 && (
            <div className="p-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No firms found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon: Icon,
  variant 
}: { 
  label: string; 
  value: number; 
  icon: any;
  variant: 'default' | 'success' | 'warning' | 'muted';
}) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20',
    muted: 'bg-muted/50 text-muted-foreground border-border/50',
  };

  return (
    <div className="p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</p>
        <div className={cn('p-1.5 rounded-md border', variantStyles[variant])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
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

  const getStatusBadge = (signed: boolean, label: string) => {
    if (signed) {
      return (
        <Badge variant="signed" className="h-6 px-2.5 text-[10px] font-semibold tracking-wide">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Signed
        </Badge>
      );
    }
    return (
      <Badge variant="notSent" className="h-6 px-2.5 text-[10px] font-semibold tracking-wide">
        <XCircle className="h-3 w-3 mr-1" />
        Unsigned
      </Badge>
    );
  };

  return (
    <div className={cn(
      "transition-colors",
      isExpanded && "bg-muted/20"
    )}>
      {/* Main Row */}
      <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-muted/30 transition-colors">
        {/* Firm Info */}
        <div className="col-span-5 flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-7 w-7 p-0 flex-shrink-0"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-sm truncate">{firm.primary_company_name}</h3>
            </div>
            {firm.website_domain && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate font-mono">
                {firm.website_domain}
              </p>
            )}
          </div>
        </div>

        {/* Member Count */}
        <div className="col-span-2">
          <Badge variant="outline" className="h-6 px-2.5 text-[10px] font-medium">
            <Users className="h-3 w-3 mr-1" />
            {firm.member_count} {firm.member_count === 1 ? 'member' : 'members'}
          </Badge>
        </div>

        {/* Fee Agreement Status */}
        <div className="col-span-2">
          {getStatusBadge(firm.fee_agreement_signed, 'Fee Agreement')}
        </div>

        {/* NDA Status */}
        <div className="col-span-2">
          {getStatusBadge(firm.nda_signed, 'NDA')}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex justify-end">
          <FirmAgreementToggles firm={firm} members={members || []} />
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2">
          <div className="bg-background rounded-xl border border-border/50 p-4">
            {/* Members List */}
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Firm Members ({members?.length || 0})
              </h4>
              <div className="space-y-2">
                {members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">
                          {member.user?.first_name} {member.user?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate font-mono">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {member.is_primary_contact && (
                        <Badge variant="default" className="h-5 px-2 text-[9px] font-semibold tracking-wide">
                          Primary
                        </Badge>
                      )}
                      {member.user?.buyer_type && (
                        <Badge variant="secondary" className="h-5 px-2 text-[9px]">
                          {member.user.buyer_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="mb-4 pb-4 border-b border-border/40">
              <h5 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Firm Actions
              </h5>
              <FirmBulkActions 
                firmId={firm.id} 
                firmName={firm.primary_company_name}
                memberCount={firm.member_count}
              />
            </div>

            {/* Signing Info */}
            {(firm.fee_agreement_signed || firm.nda_signed) && (
              <div className="space-y-2 text-xs">
                {firm.fee_agreement_signed && firm.fee_agreement_signed_at && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p>
                      <span className="font-medium text-foreground">Fee Agreement</span> signed by{' '}
                      <strong className="text-foreground">{firm.fee_agreement_signed_by_name || 'Admin'}</strong>{' '}
                      {formatDistanceToNow(new Date(firm.fee_agreement_signed_at), { addSuffix: true })}
                    </p>
                  </div>
                )}
                {firm.nda_signed && firm.nda_signed_at && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p>
                      <span className="font-medium text-foreground">NDA</span> signed by{' '}
                      <strong className="text-foreground">{firm.nda_signed_by_name || 'Admin'}</strong>{' '}
                      {firm.nda_signed_at && formatDistanceToNow(new Date(firm.nda_signed_at), { addSuffix: true })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
