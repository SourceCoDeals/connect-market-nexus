import { useState } from 'react';
import { ChevronRight, Building2, Users, Globe, Check, X, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFirmAgreements, useFirmMembers, type FirmAgreement } from '@/hooks/admin/use-firm-agreements';
import { FirmAgreementToggles } from './FirmAgreementToggles';
import { FirmBulkActions } from './FirmBulkActions';
import { FirmManagementTools } from './FirmManagementTools';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'both_signed' | 'partial' | 'none';

export function FirmAgreementsTable() {
  const { data: firms, isLoading } = useFirmAgreements();
  const [expandedFirm, setExpandedFirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filteredFirms = firms?.filter(firm => {
    const matchesSearch = 
      firm.primary_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firm.website_domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firm.email_domain?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = 
      activeTab === 'all' ||
      (activeTab === 'both_signed' && firm.fee_agreement_signed && firm.nda_signed) ||
      (activeTab === 'partial' && (firm.fee_agreement_signed !== firm.nda_signed)) ||
      (activeTab === 'none' && !firm.fee_agreement_signed && !firm.nda_signed);

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
      <div className="flex items-center justify-center p-24">
        <div className="space-y-3 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading firms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview - Minimal cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Firms"
          value={stats.total}
          icon={Building2}
          variant="neutral"
        />
        <StatCard
          label="Fully Signed"
          value={stats.bothSigned}
          icon={Check}
          variant="success"
        />
        <StatCard
          label="Partially Signed"
          value={stats.partial}
          icon={Circle}
          variant="warning"
        />
        <StatCard
          label="No Agreements"
          value={stats.none}
          icon={X}
          variant="muted"
        />
      </div>

      {/* Search and Filter Tabs */}
      <div className="space-y-4">
        {/* Search and Tools Row */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search firms by name, domain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md h-9 bg-background border-input shadow-sm"
            />
          </div>
          <FirmManagementTools />
        </div>

        {/* Filter Tabs - Stripe style */}
        <div className="flex items-center gap-2 border-b border-border">
          <FilterTab
            label="All Firms"
            count={stats.total}
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
          />
          <FilterTab
            label="Fully Signed"
            count={stats.bothSigned}
            active={activeTab === 'both_signed'}
            onClick={() => setActiveTab('both_signed')}
          />
          <FilterTab
            label="Partially Signed"
            count={stats.partial}
            active={activeTab === 'partial'}
            onClick={() => setActiveTab('partial')}
          />
          <FilterTab
            label="No Agreements"
            count={stats.none}
            active={activeTab === 'none'}
            onClick={() => setActiveTab('none')}
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/40 border-b border-border">
          <div className="col-span-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Firm
          </div>
          <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Members
          </div>
          <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Fee Agreement
          </div>
          <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            NDA
          </div>
          <div className="col-span-1 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
            Actions
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border">
          {filteredFirms?.map((firm) => (
            <FirmRow
              key={firm.id}
              firm={firm}
              isExpanded={expandedFirm === firm.id}
              onToggleExpand={() => setExpandedFirm(expandedFirm === firm.id ? null : firm.id)}
            />
          ))}
          {filteredFirms?.length === 0 && (
            <div className="p-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-base font-medium text-foreground">No firms found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterTab({ 
  label, 
  count, 
  active, 
  onClick 
}: { 
  label: string; 
  count: number; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-medium transition-colors relative",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-2">
        {label}
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded-md font-medium",
          active 
            ? "bg-primary/10 text-primary" 
            : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      </span>
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      )}
    </button>
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
  variant: 'neutral' | 'success' | 'warning' | 'muted';
}) {
  const variantStyles = {
    neutral: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    muted: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="p-5 rounded-lg border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className={cn('p-2 rounded-md', variantStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
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
    <div className={cn(
      "transition-colors",
      isExpanded && "bg-muted/20"
    )}>
      {/* Main Row */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors group">
        {/* Firm Info */}
        <div className="col-span-5 flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-6 w-6 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform text-muted-foreground",
              isExpanded && "rotate-90"
            )} />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
              <h3 className="font-medium text-sm truncate">{firm.primary_company_name}</h3>
            </div>
            {firm.website_domain && (
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground/70 truncate font-mono">
                  {firm.website_domain}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Member Count */}
        <div className="col-span-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {firm.member_count}
            </span>
          </div>
        </div>

        {/* Fee Agreement Status */}
        <div className="col-span-2 flex items-center gap-2">
          {firm.fee_agreement_signed ? (
            <Badge variant="outline" className="h-6 px-2.5 border-emerald-500/30 bg-emerald-500/10">
              <Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400 mr-1" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Signed</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="h-6 px-2.5 border-border/60 bg-muted/30">
              <X className="h-3 w-3 text-muted-foreground mr-1" />
              <span className="text-xs font-medium text-muted-foreground">Unsigned</span>
            </Badge>
          )}
        </div>

        {/* NDA Status */}
        <div className="col-span-2 flex items-center gap-2">
          {firm.nda_signed ? (
            <Badge variant="outline" className="h-6 px-2.5 border-emerald-500/30 bg-emerald-500/10">
              <Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400 mr-1" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Signed</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="h-6 px-2.5 border-border/60 bg-muted/30">
              <X className="h-3 w-3 text-muted-foreground mr-1" />
              <span className="text-xs font-medium text-muted-foreground">Unsigned</span>
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex justify-end">
          <FirmAgreementToggles firm={firm} members={members || []} />
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-border/50">
          <div className="bg-muted/20 rounded-lg p-5">
            {/* Members List */}
            <div className="mb-5">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Firm Members
                <span className="text-xs font-normal text-muted-foreground">
                  ({members?.length || 0})
                </span>
              </h4>
              <div className="space-y-2">
                {members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {member.user?.first_name?.[0]}{member.user?.last_name?.[0]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {member.user?.first_name} {member.user?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate font-mono">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {member.is_primary_contact && (
                        <Badge variant="outline" className="h-6 px-2.5 text-xs font-medium border-primary/30 bg-primary/5 text-primary">
                          Primary
                        </Badge>
                      )}
                      {member.user?.buyer_type && (
                        <Badge variant="outline" className="h-6 px-2.5 text-xs">
                          {member.user.buyer_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="mb-5 pb-5 border-b border-border/40">
              <h5 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                Firm Actions
              </h5>
              <FirmBulkActions 
                firmId={firm.id} 
                firmName={firm.primary_company_name}
                memberCount={firm.member_count}
              />
            </div>

            {/* Signing History */}
            {(firm.fee_agreement_signed || firm.nda_signed) && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Signing History
                </h5>
                {firm.fee_agreement_signed && firm.fee_agreement_signed_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="p-1.5 rounded-md bg-emerald-500/10 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground font-medium">Fee Agreement signed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        By {firm.fee_agreement_signed_by_name || 'Admin'} • {formatDistanceToNow(new Date(firm.fee_agreement_signed_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )}
                {firm.nda_signed && firm.nda_signed_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="p-1.5 rounded-md bg-emerald-500/10 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground font-medium">NDA signed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        By {firm.nda_signed_by_name || 'Admin'} • {formatDistanceToNow(new Date(firm.nda_signed_at), { addSuffix: true })}
                      </p>
                    </div>
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
