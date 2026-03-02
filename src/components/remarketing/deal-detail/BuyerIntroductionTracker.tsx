import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target,
  CheckCircle,
  Clock,
  X,
  Search,
  UserPlus,
  Calendar,
  Send,
  Briefcase,
  MapPin,
  FileCheck,
  ChevronRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BuyerIntroduction, IntroductionStatus } from '@/types/buyer-introductions';
import { AddBuyerIntroductionDialog } from './AddBuyerIntroductionDialog';
import { UpdateIntroductionStatusDialog } from './UpdateIntroductionStatusDialog';

interface BuyerIntroductionTrackerProps {
  listingId: string;
  listingTitle?: string;
}

const STATUS_CONFIG: Record<
  IntroductionStatus,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  not_introduced: {
    label: 'Not Introduced',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Target,
  },
  introduction_scheduled: {
    label: 'Scheduled',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Calendar,
  },
  introduced: {
    label: 'Awaiting Outcome',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Clock,
  },
  passed: {
    label: 'Moving Forward',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Not Interested',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: X,
  },
};

function formatDealSize(low: number | null, high: number | null): string {
  if (!low && !high) return '--';
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  if (low && high) return `${fmt(low)} - ${fmt(high)}`;
  if (low) return `${fmt(low)}+`;
  return `Up to ${fmt(high!)}`;
}

export function BuyerIntroductionTracker({
  listingId,
  listingTitle,
}: BuyerIntroductionTrackerProps) {
  const { introductions, notIntroduced, introducedAndPassed, isLoading } =
    useBuyerIntroductions(listingId);

  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerIntroduction | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const filteredNotIntroduced = useMemo(() => {
    if (!searchQuery) return notIntroduced;
    const q = searchQuery.toLowerCase();
    return notIntroduced.filter(
      (b) => b.buyer_name.toLowerCase().includes(q) || b.buyer_firm_name.toLowerCase().includes(q),
    );
  }, [notIntroduced, searchQuery]);

  const filteredIntroducedPassed = useMemo(() => {
    if (!searchQuery) return introducedAndPassed;
    const q = searchQuery.toLowerCase();
    return introducedAndPassed.filter(
      (b) => b.buyer_name.toLowerCase().includes(q) || b.buyer_firm_name.toLowerCase().includes(q),
    );
  }, [introducedAndPassed, searchQuery]);

  // Stats
  const stats = {
    total: introductions.length,
    notIntroduced: notIntroduced.length,
    introduced: introductions.filter((i) => i.introduction_status === 'introduced').length,
    passed: introductions.filter((i) => i.introduction_status === 'passed').length,
    rejected: introductions.filter((i) => i.introduction_status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* ─── Section 1: Buyers to Introduce to Deal ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Buyers to Introduce to Deal
              {filteredNotIntroduced.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {filteredNotIntroduced.length}
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Buyers queued for introduction — click a buyer to update their status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-48 text-xs"
              />
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Add Buyer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {filteredNotIntroduced.length === 0 ? (
            <div className="py-8 text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'No buyers matching your search'
                  : 'No buyers in the introduction pipeline yet'}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Add First Buyer
                </Button>
              )}
            </div>
          ) : (
            filteredNotIntroduced.map((buyer) => (
              <IntroductionBuyerRow
                key={buyer.id}
                buyer={buyer}
                onSelect={(b) => {
                  setSelectedBuyer(b);
                  setUpdateDialogOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Buyers Introduced — Passed or Interested ─── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Buyers Introduced — Passed or Interested
              {filteredIntroducedPassed.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {filteredIntroducedPassed.length}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Buyers that have been introduced to this deal</span>
              {stats.introduced > 0 && (
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                  {stats.introduced} Awaiting Outcome
                </Badge>
              )}
              {stats.passed > 0 && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  {stats.passed} Moving Forward
                </Badge>
              )}
              {stats.rejected > 0 && (
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                  {stats.rejected} Not Interested
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {filteredIntroducedPassed.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'No introduced buyers matching your search'
                  : 'No buyers have been introduced yet'}
              </p>
            </div>
          ) : (
            filteredIntroducedPassed.map((buyer) => (
              <IntroducedBuyerRow
                key={buyer.id}
                buyer={buyer}
                onSelect={(b) => {
                  setSelectedBuyer(b);
                  setUpdateDialogOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddBuyerIntroductionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        listingId={listingId}
        listingTitle={listingTitle || 'This Deal'}
      />

      {selectedBuyer && (
        <UpdateIntroductionStatusDialog
          open={updateDialogOpen}
          onOpenChange={(open) => {
            setUpdateDialogOpen(open);
            if (!open) setSelectedBuyer(null);
          }}
          buyer={selectedBuyer}
          listingId={listingId}
        />
      )}
    </>
  );
}

// ─── Introduction Buyer Row (matches RecommendedBuyersPanel BuyerCard style) ───
function IntroductionBuyerRow({
  buyer,
  onSelect,
}: {
  buyer: BuyerIntroduction;
  onSelect: (b: BuyerIntroduction) => void;
}) {
  const config = STATUS_CONFIG[buyer.introduction_status];
  const StatusIcon = config.icon;

  const nameContent = (
    <span className="font-semibold text-[13.5px] hover:underline truncate">
      {buyer.buyer_name}
    </span>
  );

  return (
    <div className="border rounded-lg px-3.5 py-3 hover:shadow-md transition-shadow shadow-sm">
      {/* Top row — matches BuyerCard layout */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Name + firm */}
        <div className="shrink-0 min-w-[160px]">
          <div className="flex items-center gap-1.5">
            {buyer.contact_id ? (
              <Link to={`/admin/buyers/${buyer.contact_id}`}>{nameContent}</Link>
            ) : (
              nameContent
            )}
            {buyer.buyer_firm_name && buyer.buyer_firm_name !== buyer.buyer_name && (
              <>
                <span className="text-muted-foreground text-xs">/</span>
                <span className="text-xs text-muted-foreground truncate">
                  {buyer.buyer_firm_name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground mt-0.5">
            {buyer.internal_champion && (
              <>
                <MapPin className="h-2.5 w-2.5" />
                {buyer.internal_champion}
              </>
            )}
            {buyer.expected_deal_size_low || buyer.expected_deal_size_high ? (
              <span className="flex items-center gap-0.5 ml-1">
                <FileCheck className="h-2.5 w-2.5" />
                {formatDealSize(buyer.expected_deal_size_low, buyer.expected_deal_size_high)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Targeting reason tags */}
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {buyer.targeting_reason && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium whitespace-nowrap truncate max-w-[200px]">
              {buyer.targeting_reason.split(' - ')[0]}
            </span>
          )}
        </div>

        {/* Status badge + action */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn('text-[11px] gap-0.5', config.color)}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>

          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {format(new Date(buyer.created_at), 'MMM d')}
          </span>

          <div className="w-px h-5 bg-border mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(buyer);
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Update
          </Button>
        </div>
      </div>

      {/* Fit reason line */}
      {buyer.targeting_reason && buyer.targeting_reason.includes(' - ') && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-2.5 pt-2.5 border-t pl-11">
          {buyer.targeting_reason.split(' - ').slice(1).join(' - ')}
        </p>
      )}
    </div>
  );
}

// ─── Introduced & Passed Buyer Row (same style) ───
function IntroducedBuyerRow({
  buyer,
  onSelect,
}: {
  buyer: BuyerIntroduction;
  onSelect: (b: BuyerIntroduction) => void;
}) {
  const config = STATUS_CONFIG[buyer.introduction_status];
  const StatusIcon = config.icon;

  const daysSinceIntroduction = buyer.introduction_date
    ? Math.floor((Date.now() - new Date(buyer.introduction_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const nameContent = (
    <span className="font-semibold text-[13.5px] hover:underline truncate">
      {buyer.buyer_name}
    </span>
  );

  return (
    <div className="border rounded-lg px-3.5 py-3 hover:shadow-md transition-shadow shadow-sm">
      {/* Top row */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Name + firm */}
        <div className="shrink-0 min-w-[160px]">
          <div className="flex items-center gap-1.5">
            {buyer.contact_id ? (
              <Link to={`/admin/buyers/${buyer.contact_id}`}>{nameContent}</Link>
            ) : (
              nameContent
            )}
            {buyer.buyer_firm_name && buyer.buyer_firm_name !== buyer.buyer_name && (
              <>
                <span className="text-muted-foreground text-xs">/</span>
                <span className="text-xs text-muted-foreground truncate">
                  {buyer.buyer_firm_name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground mt-0.5">
            {buyer.introduced_by && (
              <>
                <MapPin className="h-2.5 w-2.5" />
                Intro by {buyer.introduced_by}
              </>
            )}
            {daysSinceIntroduction !== null && (
              <span className="ml-1">{daysSinceIntroduction}d in pipeline</span>
            )}
          </div>
        </div>

        {/* Tags area */}
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {buyer.next_step && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium whitespace-nowrap truncate max-w-[200px]">
              Next: {buyer.next_step}
            </span>
          )}
          {buyer.expected_next_step_date && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium whitespace-nowrap">
              <Calendar className="h-2.5 w-2.5 inline mr-0.5" />
              {format(new Date(buyer.expected_next_step_date), 'MMM d')}
            </span>
          )}
        </div>

        {/* Status badge + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn('text-[11px] gap-0.5', config.color)}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>

          {buyer.introduction_date && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {format(new Date(buyer.introduction_date), 'MMM d')}
            </span>
          )}

          <div className="w-px h-5 bg-border mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(buyer);
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Update
          </Button>
        </div>
      </div>

      {/* Feedback line */}
      {buyer.buyer_feedback && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-2.5 pt-2.5 border-t pl-11 italic">
          &ldquo;{buyer.buyer_feedback}&rdquo;
        </p>
      )}
    </div>
  );
}
