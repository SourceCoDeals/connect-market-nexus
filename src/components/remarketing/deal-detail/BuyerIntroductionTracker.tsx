import { useState, useMemo } from 'react';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Target,
  CheckCircle,
  Clock,
  X,
  Search,
  UserPlus,
  Calendar,
  Mail,
  Phone,
  ChevronRight,
  Linkedin,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
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
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-5">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Tracked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.notIntroduced}</div>
            <div className="text-xs text-muted-foreground">Not Introduced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.introduced}</div>
            <div className="text-xs text-muted-foreground">Awaiting</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.passed}</div>
            <div className="text-xs text-muted-foreground">Moving Forward</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-slate-500">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">Not Interested</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Add Button */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search buyer or firm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add Buyer
        </Button>
      </div>

      {/* Two Pipeline Tabs */}
      <Tabs defaultValue="not_introduced">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="not_introduced" className="text-sm">
            <Target className="mr-1.5 h-3.5 w-3.5" />
            Not Yet Introduced ({filteredNotIntroduced.length})
          </TabsTrigger>
          <TabsTrigger value="introduced_passed" className="text-sm">
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            Introduced & Passed ({filteredIntroducedPassed.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Not Yet Introduced ─── */}
        <TabsContent value="not_introduced" className="space-y-3 mt-4">
          {filteredNotIntroduced.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No buyers matching your search'
                    : 'No buyers in the not-yet-introduced pipeline'}
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
              </CardContent>
            </Card>
          ) : (
            filteredNotIntroduced.map((buyer) => (
              <NotIntroducedCard
                key={buyer.id}
                buyer={buyer}
                onSelect={(b) => {
                  setSelectedBuyer(b);
                  setUpdateDialogOpen(true);
                }}
              />
            ))
          )}
        </TabsContent>

        {/* ─── Introduced & Passed ─── */}
        <TabsContent value="introduced_passed" className="space-y-3 mt-4">
          {filteredIntroducedPassed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No introduced buyers matching your search'
                    : 'No buyers have been introduced yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredIntroducedPassed.map((buyer) => (
              <IntroducedCard
                key={buyer.id}
                buyer={buyer}
                onSelect={(b) => {
                  setSelectedBuyer(b);
                  setUpdateDialogOpen(true);
                }}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

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
    </div>
  );
}

// ─── Not Introduced Buyer Card ───
function NotIntroducedCard({
  buyer,
  onSelect,
}: {
  buyer: BuyerIntroduction;
  onSelect: (b: BuyerIntroduction) => void;
}) {
  const config = STATUS_CONFIG[buyer.introduction_status];
  const StatusIcon = config.icon;

  return (
    <div
      onClick={() => onSelect(buyer)}
      className="p-4 rounded-lg border border-border/40 hover:border-border/60 hover:bg-muted/30 transition-colors cursor-pointer space-y-3"
    >
      {/* Row 1: Name + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{buyer.buyer_name}</span>
            <span className="text-xs text-muted-foreground">{buyer.buyer_firm_name}</span>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${config.color}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      {/* Row 2: Key Details */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground mb-0.5">Target Size</div>
          <div className="font-medium">
            {formatDealSize(buyer.expected_deal_size_low, buyer.expected_deal_size_high)}
          </div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground mb-0.5">Reason</div>
          <div className="font-medium truncate">
            {buyer.targeting_reason?.split(' - ')[0] || '--'}
          </div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground mb-0.5">Champion</div>
          <div className="font-medium">{buyer.internal_champion || '--'}</div>
        </div>
      </div>

      {/* Row 3: Contact info + timestamps */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {buyer.buyer_email && (
          <a
            href={`mailto:${buyer.buyer_email}`}
            className="flex items-center gap-1 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{buyer.buyer_email}</span>
          </a>
        )}
        {buyer.buyer_phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {buyer.buyer_phone}
          </span>
        )}
        {buyer.buyer_linkedin_url && (
          <a
            href={
              buyer.buyer_linkedin_url.startsWith('http')
                ? buyer.buyer_linkedin_url
                : `https://${buyer.buyer_linkedin_url}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <Linkedin className="h-3 w-3" />
            LinkedIn
          </a>
        )}
        <span className="ml-auto">Added {format(new Date(buyer.created_at), 'MMM d, yyyy')}</span>
      </div>
    </div>
  );
}

// ─── Introduced & Passed Buyer Card ───
function IntroducedCard({
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

  return (
    <div
      onClick={() => onSelect(buyer)}
      className="p-4 rounded-lg border border-border/40 hover:border-border/60 hover:bg-muted/30 transition-colors cursor-pointer space-y-3"
    >
      {/* Row 1: Name + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{buyer.buyer_name}</span>
            <span className="text-xs text-muted-foreground">{buyer.buyer_firm_name}</span>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${config.color}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      {/* Row 2: Timeline Info */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground mb-0.5">Introduced</div>
          <div className="font-medium">
            {buyer.introduction_date
              ? format(new Date(buyer.introduction_date), 'MMM d, yyyy')
              : '--'}
          </div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground mb-0.5">By</div>
          <div className="font-medium">{buyer.introduced_by || '--'}</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground mb-0.5">In Pipeline</div>
          <div className="font-medium">
            {daysSinceIntroduction !== null ? `${daysSinceIntroduction}d` : '--'}
          </div>
        </div>
      </div>

      {/* Row 3: Feedback & Next Step */}
      {buyer.buyer_feedback && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
          &ldquo;{buyer.buyer_feedback}&rdquo;
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {buyer.next_step && (
          <span className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            Next: {buyer.next_step}
          </span>
        )}
        {buyer.expected_next_step_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(buyer.expected_next_step_date), 'MMM d, yyyy')}
          </span>
        )}
        {buyer.passed_date && (
          <span className="ml-auto">
            Passed {formatDistanceToNow(new Date(buyer.passed_date), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}
