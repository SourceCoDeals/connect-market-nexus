import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  MoreHorizontal,
  Building2,
  ThumbsUp,
  ThumbsDown,
  Users,
  ExternalLink,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Sparkles,
  Upload,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Calculator,
  ArrowUpDown,
  Archive,
  XCircle,
  Star,
  Zap,
  Plus,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { format } from "date-fns";
import { getTierFromScore, DealImportDialog, EnrichmentProgressIndicator, AddDealDialog, ReMarketingChat, DealSourceBadge } from "@/components/remarketing";
import { DealEnrichmentSummaryDialog } from "@/components/remarketing";
import { BulkAssignUniverseDialog } from "@/components/remarketing/BulkAssignUniverseDialog";
import { useEnrichmentProgress } from "@/hooks/useEnrichmentProgress";
import { useGlobalGateCheck } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { FilterBar, DEAL_LISTING_FIELDS } from "@/components/filters";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { useTimeframe } from "@/hooks/use-timeframe";
import { TimeframeSelector } from "@/components/filters/TimeframeSelector";
import { useSavedViews } from "@/hooks/use-saved-views";
import type { FilterState } from "@/components/filters/filter-definitions";

interface DealListing {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  status: string | null;
  created_at: string;
  category: string | null;
  website: string | null;
  executive_summary: string | null;
  service_mix: any | null;
  internal_company_name: string | null;
  internal_deal_memo_link: string | null;
  geographic_states: string[] | null;
  enriched_at: string | null;
  full_time_employees: number | null;
  linkedin_employee_count: number | null;
  linkedin_employee_range: string | null;
  google_review_count: number | null;
  google_rating: number | null;
  is_priority_target: boolean | null;
  deal_quality_score: number | null;
  deal_total_score: number | null;
  seller_interest_score: number | null;
  manual_rank_override: number | null;
  // Structured address fields
  address_city: string | null;
  address_state: string | null;
  // Referral partner
  referral_partner_id: string | null;
  referral_partners: { id: string; name: string } | null;
  // Deal source
  deal_source: string | null;
  // Deal owner
  deal_owner_id: string | null;
  deal_owner: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

// Column width configuration
interface ColumnWidths {
  select: number;
  rank: number;
  dealName: number;
  referralSource: number;
  industry: number;
  description: number;
  location: number;
  revenue: number;
  ebitda: number;
  linkedinCount: number;
  linkedinRange: number;
  googleReviews: number;
  googleRating: number;
  quality: number;
  sellerInterest: number;
  engagement: number;
  dealOwner: number;
  added: number;
  actions: number;
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  select: 40,
  rank: 60,
  dealName: 200,
  referralSource: 120,
  industry: 120,
  description: 180,
  location: 100,
  revenue: 90,
  ebitda: 90,
  linkedinCount: 70,
  linkedinRange: 80,
  googleReviews: 70,
  googleRating: 60,
  quality: 80,
  sellerInterest: 90,
  engagement: 130,
  dealOwner: 130,
  added: 90,
  actions: 50,
};

// Resizable column header component
const ResizableHeader = ({
  children,
  width,
  onResize,
  minWidth = 50,
  className = "",
}: {
  children: React.ReactNode;
  width: number;
  onResize: (newWidth: number) => void;
  minWidth?: number;
  className?: string;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + diff);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <th
      className={cn(
        "relative h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 border-b",
        className
      )}
      style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
    >
      <div className="flex items-center h-full">{children}</div>
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
      />
    </th>
  );
};

// Inline editable rank cell — uses a popover to float above the table
const EditableRankCell = ({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> | void }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.select(), 0); }, [open]);

  const handleSave = async () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== value) {
      setSaving(true);
      await onSave(parsed);
      setSaving(false);
    } else {
      setDraft(String(value));
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { if (!v) { setDraft(String(value)); setOpen(false); } else { setOpen(true); } }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="group/rank relative font-semibold tabular-nums text-muted-foreground min-w-[28px] h-7 inline-flex items-center justify-center rounded-md border border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-150"
          title="Click to edit position"
        >
          {value}
          <span className="absolute -top-1 -right-1 opacity-0 group-hover/rank:opacity-100 transition-opacity">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-muted-foreground">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 z-50"
        align="start"
        side="bottom"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Edit Position</label>
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="number"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') { setDraft(String(value)); setOpen(false); }
              }}
              className="w-20 h-8 text-center text-sm font-semibold tabular-nums px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button size="sm" className="h-8 px-3" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Sortable table row component
const SortableTableRow = ({
  listing,
  index,
  stats,
  navigate,
  formatCurrency,
  formatWebsiteDomain,
  getEffectiveWebsite,
  formatGeographyBadges,
  getScoreTrendIcon,
  columnWidths,
  isSelected,
  onToggleSelect,
  onArchive,
  onDelete,
  onTogglePriority,
  onUpdateRank,
  adminProfiles,
  onAssignOwner,
}: {
  listing: DealListing;
  index: number;
  stats: any;
  navigate: (path: string) => void;
  formatCurrency: (value: number | null) => string;
  formatWebsiteDomain: (url: string | null) => string | null;
  getEffectiveWebsite: (listing: any) => string | null;
  formatGeographyBadges: (states: string[] | null) => string | null;
  getScoreTrendIcon: (score: number) => JSX.Element;
  columnWidths: ColumnWidths;
  isSelected: boolean;
  onToggleSelect: (dealId: string) => void;
  onArchive: (dealId: string, dealName: string) => void;
  onDelete: (dealId: string, dealName: string) => void;
  onTogglePriority: (dealId: string, currentStatus: boolean) => void;
  onUpdateRank: (dealId: string, newRank: number) => Promise<void> | void;
  adminProfiles?: Record<string, { id: string; email: string; first_name: string; last_name: string; displayName: string }>;
  onAssignOwner: (dealId: string, ownerId: string | null) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const effectiveWebsite = getEffectiveWebsite(listing);
  const domain = formatWebsiteDomain(effectiveWebsite);
  const isEnriched = !!listing.enriched_at;
  const displayName = listing.internal_company_name || listing.title;
  
  // City, State display only - normalize state to abbreviation
  const normalizeState = (state: string | null): string | null => {
    if (!state) return null;
    const cleaned = state.trim().toUpperCase();
    // Extract just the state if it contains extra info
    const stateMatch = cleaned.match(/^([A-Z]{2})\b/);
    if (stateMatch) return stateMatch[1];
    // State name to abbreviation map (common ones)
    const stateMap: Record<string, string> = {
      'MARYLAND': 'MD', 'CALIFORNIA': 'CA', 'TEXAS': 'TX', 'NEW YORK': 'NY',
      'FLORIDA': 'FL', 'ILLINOIS': 'IL', 'PENNSYLVANIA': 'PA', 'OHIO': 'OH',
      'GEORGIA': 'GA', 'MICHIGAN': 'MI', 'NORTH CAROLINA': 'NC', 'NEW JERSEY': 'NJ',
      'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'ARIZONA': 'AZ', 'MASSACHUSETTS': 'MA',
      'TENNESSEE': 'TN', 'INDIANA': 'IN', 'MISSOURI': 'MO', 'WISCONSIN': 'WI',
      'COLORADO': 'CO', 'MINNESOTA': 'MN', 'SOUTH CAROLINA': 'SC', 'ALABAMA': 'AL',
      'LOUISIANA': 'LA', 'KENTUCKY': 'KY', 'OREGON': 'OR', 'OKLAHOMA': 'OK',
      'CONNECTICUT': 'CT', 'UTAH': 'UT', 'IOWA': 'IA', 'NEVADA': 'NV',
      'ARKANSAS': 'AR', 'KANSAS': 'KS', 'MISSISSIPPI': 'MS', 'NEW MEXICO': 'NM',
      'NEBRASKA': 'NE', 'IDAHO': 'ID', 'WEST VIRGINIA': 'WV', 'HAWAII': 'HI',
      'NEW HAMPSHIRE': 'NH', 'MAINE': 'ME', 'MONTANA': 'MT', 'RHODE ISLAND': 'RI',
      'DELAWARE': 'DE', 'SOUTH DAKOTA': 'SD', 'NORTH DAKOTA': 'ND', 'ALASKA': 'AK',
      'VERMONT': 'VT', 'WYOMING': 'WY'
    };
    return stateMap[cleaned] || null;
  };

  // Get city, state display - only show if we have valid city AND state
  const getLocationDisplay = (): string | null => {
    // First try address_city + address_state
    if (listing.address_city && listing.address_state) {
      const city = listing.address_city.trim();
      const state = normalizeState(listing.address_state);
      if (city && state) {
        return `${city}, ${state}`;
      }
    }
    // Fallback: if we have geographic_states with a single state abbreviation
    if (listing.geographic_states && listing.geographic_states.length === 1) {
      const state = listing.geographic_states[0];
      if (state && state.length === 2) {
        return state; // Just show the state abbreviation
      }
    }
    return null;
  };
  
  const geographyDisplay = getLocationDisplay();
  
  // Use deal_total_score (0-100 comprehensive score from edge function)
  const qualityScore = listing.deal_total_score ?? null;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer hover:bg-muted/50",
        isDragging && "bg-muted/80 opacity-80 shadow-lg z-50",
        listing.is_priority_target && "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
      )}
      onClick={() => navigate(`/admin/remarketing/deals/${listing.id}`)}
    >
      {/* Checkbox */}
      <TableCell 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: columnWidths.select, minWidth: 40 }}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(listing.id)}
        />
      </TableCell>

      {/* Drag Handle + Rank */}
      <TableCell style={{ width: columnWidths.rank, minWidth: 50 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <EditableRankCell
            value={listing.manual_rank_override ?? (index + 1)}
            onSave={(newRank) => onUpdateRank(listing.id, newRank)}
          />
        </div>
      </TableCell>

      {/* Deal Name */}
      <TableCell style={{ width: columnWidths.dealName, minWidth: 100 }}>
        <div>
          <p className="font-medium text-foreground flex items-center gap-1.5">
            {displayName}
            {isEnriched && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enriched on {format(new Date(listing.enriched_at!), 'dd/MM/yyyy')}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <DealSourceBadge source={listing.deal_source} />
          </p>
          {domain && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {domain}
            </p>
          )}
        </div>
      </TableCell>

      {/* Referral Source */}
      <TableCell style={{ width: columnWidths.referralSource, minWidth: 60 }}>
        {listing.referral_partners?.name ? (
          <span
            className="text-sm text-blue-600 hover:underline cursor-pointer truncate block"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/remarketing/referral-partners/${listing.referral_partners!.id}`);
            }}
          >
            {listing.referral_partners.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Industry */}
      <TableCell style={{ width: columnWidths.industry, minWidth: 60 }}>
        {listing.category ? (
          <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
            {listing.category.length > 18 ? listing.category.substring(0, 18) + '...' : listing.category}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Description */}
      <TableCell style={{ width: columnWidths.description, minWidth: 120 }}>
        {listing.description ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground leading-tight line-clamp-3 cursor-default" style={{ maxWidth: columnWidths.description - 16 }}>
                {listing.description}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{listing.description}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Location - City, State only */}
      <TableCell style={{ width: columnWidths.location, minWidth: 60 }}>
        {geographyDisplay ? (
          <span className="text-sm">{geographyDisplay}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Revenue */}
      <TableCell className="text-right font-medium" style={{ width: columnWidths.revenue, minWidth: 60 }}>
        {formatCurrency(listing.revenue)}
      </TableCell>

      {/* EBITDA */}
      <TableCell className="text-right font-medium" style={{ width: columnWidths.ebitda, minWidth: 60 }}>
        {formatCurrency(listing.ebitda)}
      </TableCell>

      {/* LinkedIn Employee Count */}
      <TableCell className="text-right" style={{ width: columnWidths.linkedinCount, minWidth: 50 }}>
        {listing.linkedin_employee_count ? (
          <div className="text-sm flex items-center justify-end gap-1">
            <span>{listing.linkedin_employee_count.toLocaleString()}</span>
            <span className="text-xs text-blue-500 font-medium">LI</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* LinkedIn Employee Range */}
      <TableCell className="text-right" style={{ width: columnWidths.linkedinRange, minWidth: 50 }}>
        {listing.linkedin_employee_range ? (
          <span className="text-sm text-muted-foreground">{listing.linkedin_employee_range}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Google Reviews */}
      <TableCell className="text-right" style={{ width: columnWidths.googleReviews, minWidth: 50 }}>
        {listing.google_review_count != null ? (
          <span className="text-sm tabular-nums">{listing.google_review_count.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Google Rating */}
      <TableCell className="text-right" style={{ width: columnWidths.googleRating, minWidth: 50 }}>
        {listing.google_rating != null ? (
          <span className="text-sm tabular-nums">⭐ {listing.google_rating}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Deal Quality Score */}
      <TableCell className="text-center" style={{ width: columnWidths.quality, minWidth: 50 }}>
        {qualityScore !== null ? (
          <div className="flex items-center justify-center gap-1.5">
            <span className={cn(
              "text-sm font-medium px-2 py-0.5 rounded",
              qualityScore >= 80 ? "bg-green-100 text-green-700" :
              qualityScore >= 60 ? "bg-blue-100 text-blue-700" :
              qualityScore >= 40 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            )}>
              {Math.round(qualityScore)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      {/* Seller Interest Score (0-100, from transcript/notes analysis) */}
      <TableCell className="text-center" style={{ width: columnWidths.sellerInterest, minWidth: 60 }}>
        {listing.seller_interest_score !== null ? (
          <span className={cn(
            "text-sm font-medium px-2 py-0.5 rounded",
            listing.seller_interest_score >= 80 ? "bg-green-100 text-green-700" :
            listing.seller_interest_score >= 60 ? "bg-blue-100 text-blue-700" :
            listing.seller_interest_score >= 40 ? "bg-yellow-100 text-yellow-700" :
            "bg-gray-100 text-gray-600"
          )}>
            {listing.seller_interest_score}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Engagement */}
      <TableCell style={{ width: columnWidths.engagement, minWidth: 80 }}>
        <div className="flex items-center justify-center gap-3 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{stats?.totalMatches || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>{stats?.approved || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-red-500">
            <ThumbsDown className="h-3.5 w-3.5" />
            <span>{stats?.passed || 0}</span>
          </div>
        </div>
      </TableCell>

      {/* Deal Owner */}
      <TableCell style={{ width: columnWidths.dealOwner, minWidth: 80 }} onClick={(e) => e.stopPropagation()}>
        <Select
          value={listing.deal_owner_id || "__none"}
          onValueChange={(val) => onAssignOwner(listing.id, val === "__none" ? null : val)}
        >
          <SelectTrigger className="h-7 text-xs border-dashed w-full">
            <SelectValue placeholder="Assign...">
              {listing.deal_owner?.first_name
                ? `${listing.deal_owner.first_name} ${listing.deal_owner.last_name || ''}`.trim()
                : listing.deal_owner_id && adminProfiles?.[listing.deal_owner_id]
                  ? adminProfiles[listing.deal_owner_id].displayName
                  : <span className="text-muted-foreground">Assign...</span>
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">
              <span className="text-muted-foreground">Unassigned</span>
            </SelectItem>
            {adminProfiles && Object.values(adminProfiles).map((admin) => (
              <SelectItem key={admin.id} value={admin.id}>
                {admin.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Added date */}
      <TableCell className="text-muted-foreground text-sm" style={{ width: columnWidths.added, minWidth: 60 }}>
        {format(new Date(listing.created_at), 'MM/dd/yyyy')}
      </TableCell>

      {/* Actions */}
      <TableCell style={{ width: columnWidths.actions, minWidth: 40 }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/remarketing/deals/${listing.id}`);
              }}
            >
              <Building2 className="h-4 w-4 mr-2" />
              View Deal
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/remarketing/matching/${listing.id}`);
              }}
            >
              <Target className="h-4 w-4 mr-2" />
              Match Buyers
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/listing/${listing.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Listing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onTogglePriority(listing.id, listing.is_priority_target || false);
              }}
              className={listing.is_priority_target ? "text-amber-600" : ""}
            >
              <Star className={cn("h-4 w-4 mr-2", listing.is_priority_target && "fill-amber-500")} />
              {listing.is_priority_target ? "Remove Priority" : "Mark as Priority"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onArchive(listing.id, displayName || 'Unknown Deal');
              }}
              className="text-amber-600 focus:text-amber-600"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive Deal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(listing.id, displayName || 'Unknown Deal');
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Deal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

const ReMarketingDeals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  // Unified filter system
  const { timeframe, setTimeframe, isInRange } = useTimeframe('all_time');
  const { views: savedViews, addView, removeView } = useSavedViews('remarketing-deals');

  // Admin profiles for deal owner assignment
  const { data: adminProfiles } = useAdminProfiles();

  // State for import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDealDialog, setShowAddDealDialog] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  
  // Enrichment progress tracking
  const { progress: enrichmentProgress, summary: enrichmentSummary, showSummary: showEnrichmentSummary, dismissSummary, pauseEnrichment, resumeEnrichment, cancelEnrichment } = useEnrichmentProgress();
  
  // Multi-select and archive/delete state
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUniverseDialog, setShowUniverseDialog] = useState(false);
  
  // Local order state for optimistic UI updates during drag-and-drop
  const [localOrder, setLocalOrder] = useState<DealListing[]>([]);
  
  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  
  // Ref to always have access to current listings (prevents stale closure bug)
  const sortedListingsRef = useRef<DealListing[]>([]);
  
  // Handle column resize
  const handleColumnResize = useCallback((column: keyof ColumnWidths, newWidth: number) => {
    setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
  }, []);

  // Track which deals have been queued in this session (cleared on component mount)
  // The database upsert handles true duplicate prevention
  const enrichingDealsRef = useRef<Set<string>>(new Set());

  // Clear the ref when listings change significantly (e.g., page change, filter change)
  useEffect(() => {
    enrichingDealsRef.current.clear();
  }, [sortColumn, sortDirection]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Fetch all listings (deals)
  const { data: listings, isLoading: listingsLoading, refetch: refetchListings } = useQuery({
    queryKey: ['remarketing', 'deals'],
    refetchOnMount: 'always',
    staleTime: 30_000, // 30s — ensures fresh data on navigation
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          description,
          location,
          revenue,
          ebitda,
          status,
          created_at,
          category,
          website,
          executive_summary,
          service_mix,
          internal_company_name,
          internal_deal_memo_link,
          geographic_states,
          enriched_at,
          full_time_employees,
          linkedin_employee_count,
          linkedin_employee_range,
          google_review_count,
          google_rating,
          is_priority_target,
          deal_quality_score,
          deal_total_score,
          seller_interest_score,
          manual_rank_override,
          address_city,
          address_state,
          referral_partner_id,
          referral_partners(id, name),
          deal_source,
          deal_owner_id,
          deal_owner:profiles!listings_deal_owner_id_fkey(id, first_name, last_name, email)
        `)
        .eq('status', 'active')
        .order('manual_rank_override', { ascending: true, nullsFirst: false })
        .order('deal_total_score', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DealListing[];
    }
  });

  // Queue specific deals for enrichment (used by CSV import)
  const queueDealsForEnrichment = useCallback(async (dealIds: string[]) => {
    if (dealIds.length === 0) return;

    const nowIso = new Date().toISOString();

    try {
      // Gate check: register as major operation
      const { queued } = await startOrQueueMajorOp({
        operationType: 'deal_enrichment',
        totalItems: dealIds.length,
        description: `Enrich ${dealIds.length} imported deals`,
        userId: user?.id || 'unknown',
      });
      if (queued) return; // Queued for later auto-start

      // Add deals to enrichment queue (upsert to avoid duplicates)
      const queueEntries = dealIds.map(id => ({
        listing_id: id,
        status: 'pending',
        attempts: 0,
        queued_at: nowIso,
      }));

      const { error } = await supabase
        .from('enrichment_queue')
        .upsert(queueEntries, { onConflict: 'listing_id' });

      if (error) {
        console.error('Failed to queue deals for enrichment:', error);
        return;
      }

      toast({
        title: "Deals queued for enrichment",
        description: `${dealIds.length} deal${dealIds.length !== 1 ? 's' : ''} added to enrichment queue`
      });
      
      // Trigger the worker immediately
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'csv_import' } })
        .catch((e) => console.warn('Failed to trigger enrichment worker:', e));
        
    } catch (err) {
      console.error('Failed to queue deals:', err);
    }
  }, [toast, startOrQueueMajorOp, user?.id]);
  
  // Handle import completion with smart enrichment (only new deals)
  const handleImportCompleteWithIds = useCallback((importedIds: string[]) => {
    if (importedIds.length > 0) {
      queueDealsForEnrichment(importedIds);
    }
  }, [queueDealsForEnrichment]);
  
  // Handle retry failed enrichments
  const handleRetryFailedEnrichment = useCallback(async () => {
    dismissSummary();
    
    if (!enrichmentSummary?.errors.length) return;
    
    const failedIds = enrichmentSummary.errors.map(e => e.listingId);
    const nowIso = new Date().toISOString();
    
    // Reset failed items in queue
    await supabase
      .from('enrichment_queue')
      .update({
        status: 'pending',
        attempts: 0,
        last_error: null,
        queued_at: nowIso,
      })
      .in('listing_id', failedIds);
    
    toast({
      title: "Retrying failed deals",
      description: `${failedIds.length} deal${failedIds.length !== 1 ? 's' : ''} queued for retry`
    });
    
    // Trigger worker
    void supabase.functions
      .invoke('process-enrichment-queue', { body: { source: 'retry_failed' } })
      .catch(console.warn);
  }, [dismissSummary, enrichmentSummary, toast]);

  // Fetch universes for the filter
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Fetch score stats for engagement metrics
  const { data: scoreStats } = useQuery({
    queryKey: ['remarketing', 'deal-score-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('listing_id, composite_score, status, universe_id');

      if (error) throw error;

      const stats: Record<string, {
        totalMatches: number;
        approved: number;
        passed: number;
        avgScore: number;
        universeIds: Set<string>;
      }> = {};

      data?.forEach(score => {
        if (!stats[score.listing_id]) {
          stats[score.listing_id] = {
            totalMatches: 0,
            approved: 0,
            passed: 0,
            avgScore: 0,
            universeIds: new Set(),
          };
        }
        stats[score.listing_id].totalMatches++;
        if (score.status === 'approved') stats[score.listing_id].approved++;
        if (score.status === 'passed') stats[score.listing_id].passed++;
        stats[score.listing_id].avgScore += score.composite_score || 0;
        if (score.universe_id) stats[score.listing_id].universeIds.add(score.universe_id);
      });

      Object.keys(stats).forEach(key => {
        if (stats[key].totalMatches > 0) {
          stats[key].avgScore = stats[key].avgScore / stats[key].totalMatches;
        }
      });

      return stats;
    }
  });

  // Get universe count
  const universeCount = universes?.length || 0;

  // KPI Stats
  const kpiStats = useMemo(() => {
    const totalDeals = listings?.length || 0;

    const priorityDeals = listings?.filter(listing =>
      listing.is_priority_target === true
    ).length || 0;

    let totalScore = 0;
    let scoredDeals = 0;
    listings?.forEach(listing => {
      if (listing.deal_total_score !== null) {
        totalScore += listing.deal_total_score;
        scoredDeals++;
      }
    });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;

    const needsScoring = listings?.filter(listing =>
      listing.deal_total_score === null
    ).length || 0;

    return { totalDeals, priorityDeals, avgScore, needsScoring };
  }, [listings]);

  // Helper functions
  const extractWebsiteFromMemo = (memoLink: string | null): string | null => {
    if (!memoLink) return null;
    if (memoLink.includes('sharepoint.com') || memoLink.includes('onedrive')) return null;
    const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
    if (websiteMatch) return websiteMatch[1];
    if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/) && !memoLink.includes('sharepoint')) return memoLink;
    if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) return `https://${memoLink}`;
    return null;
  };

  const getEffectiveWebsite = (listing: any): string | null => {
    if (listing.website) return listing.website;
    return extractWebsiteFromMemo(listing.internal_deal_memo_link);
  };

  const formatGeographyBadges = (states: string[] | null): string | null => {
    if (!states || states.length === 0) return null;
    if (states.length <= 3) return states.join(', ');
    return `${states.slice(0, 2).join(', ')} +${states.length - 2}`;
  };

  // Unified filter engine
  const {
    filteredItems: filteredByEngine,
    filterState,
    setFilterState,
    activeFilterCount,
    totalCount,
    filteredCount,
    dynamicOptions,
  } = useFilterEngine(listings ?? [], DEAL_LISTING_FIELDS);

  // Apply timeframe on top of engine results (timeframe filters created_at)
  const filteredListings = useMemo(() => {
    return filteredByEngine.filter(listing => isInRange(listing.created_at));
  }, [filteredByEngine, isInRange]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatWebsiteDomain = (website: string | null) => {
    if (!website) return null;
    return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  };

  const getScoreTrendIcon = (score: number) => {
    if (score >= 75) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (score >= 55) return <Minus className="h-3.5 w-3.5 text-yellow-500" />;
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  };

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "rank" ? "asc" : "desc");
    }
  };

  // Sort listings
  const sortedListings = useMemo(() => {
    if (!filteredListings) return [];

    return [...filteredListings].sort((a, b) => {
      const stats_a = scoreStats?.[a.id];
      const stats_b = scoreStats?.[b.id];
      let aVal: any, bVal: any;

      switch (sortColumn) {
        case "rank":
          aVal = a.manual_rank_override ?? 9999;
          bVal = b.manual_rank_override ?? 9999;
          break;
        case "deal_name":
          aVal = (a.internal_company_name || a.title || "").toLowerCase();
          bVal = (b.internal_company_name || b.title || "").toLowerCase();
          break;
        case "referral_source":
          aVal = (a.referral_partners?.name || "").toLowerCase();
          bVal = (b.referral_partners?.name || "").toLowerCase();
          break;
        case "industry":
          aVal = (a.category || "").toLowerCase();
          bVal = (b.category || "").toLowerCase();
          break;
        case "revenue":
          aVal = a.revenue || 0;
          bVal = b.revenue || 0;
          break;
        case "ebitda":
          aVal = a.ebitda || 0;
          bVal = b.ebitda || 0;
          break;
        case "linkedinCount":
          aVal = a.linkedin_employee_count || 0;
          bVal = b.linkedin_employee_count || 0;
          break;
        case "linkedinRange":
          const parseRangeA = (r: string | null) => {
            if (!r) return 0;
            const match = r.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };
          aVal = parseRangeA(a.linkedin_employee_range);
          bVal = parseRangeA(b.linkedin_employee_range);
          break;
        case "googleReviews":
          aVal = a.google_review_count || 0;
          bVal = b.google_review_count || 0;
          break;
        case "googleRating":
          aVal = a.google_rating || 0;
          bVal = b.google_rating || 0;
          break;
        case "score":
          aVal = a.deal_total_score ?? 0;
          bVal = b.deal_total_score ?? 0;
          break;
        case "sellerInterest":
          aVal = a.seller_interest_score ?? 0;
          bVal = b.seller_interest_score ?? 0;
          break;
        case "engagement":
          aVal = (stats_a?.totalMatches || 0);
          bVal = (stats_b?.totalMatches || 0);
          break;
        case "added":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          aVal = a.manual_rank_override ?? 9999;
          bVal = b.manual_rank_override ?? 9999;
      }

      if (typeof aVal === "string") {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredListings, sortColumn, sortDirection, scoreStats]);

  // Keep ref and local order in sync with sortedListings
  useEffect(() => {
    sortedListingsRef.current = sortedListings;
    setLocalOrder(sortedListings);
  }, [sortedListings]);

  // Shared helper: reorder deals, optimistically update UI, persist only changed ranks
  const persistRankChanges = useCallback(async (reordered: DealListing[], description: string) => {
    // Compute new ranks and find which actually changed
    const updatedListings = reordered.map((listing, idx) => ({
      ...listing,
      manual_rank_override: idx + 1,
    }));

    // Only persist deals whose rank actually changed
    const changedDeals = updatedListings.filter((deal, idx) => {
      const original = localOrder.find(d => d.id === deal.id);
      return !original || original.manual_rank_override !== idx + 1;
    });

    // Optimistic update
    setLocalOrder(updatedListings);
    sortedListingsRef.current = updatedListings;

    try {
      // Parallel DB updates — only changed deals (throwOnError so failures are caught)
      if (changedDeals.length > 0) {
        await Promise.all(
          changedDeals.map((deal) =>
            supabase
              .from('listings')
              .update({ manual_rank_override: deal.manual_rank_override })
              .eq('id', deal.id)
              .throwOnError()
          )
        );
      }

      // Invalidate AFTER all writes complete to avoid stale refetch race
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast({ title: "Position updated", description });
    } catch (error) {
      console.error('Failed to update rank:', error);
      // Revert on error — refetch fresh data
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast({ title: "Failed to update rank", variant: "destructive" });
    }
  }, [localOrder, queryClient, toast]);

  // Handle drag end - update ranks with proper sequential numbering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('[DnD] dragEnd fired', { activeId: active.id, overId: over?.id });
    
    if (!over || active.id === over.id) {
      console.log('[DnD] no-op: same item or no target');
      return;
    }

    const currentListings = [...localOrder];
    const oldIndex = currentListings.findIndex((l) => l.id === active.id);
    const newIndex = currentListings.findIndex((l) => l.id === over.id);

    console.log('[DnD] indices', { oldIndex, newIndex, listLength: currentListings.length });

    if (oldIndex === -1 || newIndex === -1) {
      console.log('[DnD] item not found in localOrder');
      return;
    }

    const reordered = arrayMove(currentListings, oldIndex, newIndex);
    await persistRankChanges(reordered, `Deal moved to position ${newIndex + 1}`);
  }, [localOrder, persistRankChanges]);

  // Multi-select handlers
  const handleToggleSelect = useCallback((dealId: string) => {
    setSelectedDeals(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(dealId)) {
        newSelected.delete(dealId);
      } else {
        newSelected.add(dealId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedDeals.size === localOrder.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(localOrder.map(d => d.id)));
    }
  }, [selectedDeals.size, localOrder]);

  const handleClearSelection = useCallback(() => {
    setSelectedDeals(new Set());
  }, []);

  // Archive handlers
  const handleArchiveDeal = useCallback(async (dealId: string, dealName: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'archived' })
      .eq('id', dealId);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    
    toast({ title: "Deal archived", description: `${dealName} has been archived` });
    refetchListings();
  }, [toast, refetchListings]);

  // Single deal delete state
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteDeal = useCallback((dealId: string, dealName: string) => {
    setSingleDeleteTarget({ id: dealId, name: dealName });
  }, []);

  const handleConfirmSingleDelete = useCallback(async () => {
    if (!singleDeleteTarget) return;
    const { id: dealId, name: dealName } = singleDeleteTarget;
    try {
      await supabase.from('alert_delivery_logs').delete().eq('listing_id', dealId);
      await supabase.from('buyer_approve_decisions').delete().eq('listing_id', dealId);
      await supabase.from('buyer_learning_history').delete().eq('listing_id', dealId);
      await supabase.from('buyer_pass_decisions').delete().eq('listing_id', dealId);
      await supabase.from('chat_conversations').delete().eq('listing_id', dealId);
      await supabase.from('collection_items').delete().eq('listing_id', dealId);
      await supabase.from('connection_requests').delete().eq('listing_id', dealId);
      await supabase.from('deal_ranking_history').delete().eq('listing_id', dealId);
      await supabase.from('deal_referrals').delete().eq('listing_id', dealId);
      await supabase.from('deals').delete().eq('listing_id', dealId);
      await supabase.from('deal_scoring_adjustments').delete().eq('listing_id', dealId);
      await supabase.from('deal_transcripts').delete().eq('listing_id', dealId);
      await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
      await supabase.from('listing_analytics').delete().eq('listing_id', dealId);
      await supabase.from('listing_conversations').delete().eq('listing_id', dealId);
      await supabase.from('outreach_records').delete().eq('listing_id', dealId);
      await supabase.from('owner_intro_notifications').delete().eq('listing_id', dealId);
      await supabase.from('remarketing_outreach').delete().eq('listing_id', dealId);
      await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
      await supabase.from('remarketing_universe_deals').delete().eq('listing_id', dealId);
      await supabase.from('saved_listings').delete().eq('listing_id', dealId);
      await supabase.from('similar_deal_alerts').delete().eq('source_listing_id', dealId);
      const { error } = await supabase.from('listings').delete().eq('id', dealId);
      if (error) throw error;
      toast({ title: "Deal deleted", description: `${dealName} has been permanently deleted` });
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSingleDeleteTarget(null);
    }
  }, [singleDeleteTarget, toast, refetchListings]);

  const handleTogglePriority = useCallback(async (dealId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    // Optimistic update
    setLocalOrder(prev => prev.map(deal => 
      deal.id === dealId ? { ...deal, is_priority_target: newStatus } : deal
    ));
    
    const { error } = await supabase
      .from('listings')
      .update({ is_priority_target: newStatus })
      .eq('id', dealId);
    
    if (error) {
      // Revert on error
      setLocalOrder(prev => prev.map(deal => 
        deal.id === dealId ? { ...deal, is_priority_target: currentStatus } : deal
      ));
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    
    toast({ 
      title: newStatus ? "Priority target set" : "Priority removed", 
      description: newStatus ? "Deal marked as priority target" : "Deal is no longer a priority target" 
    });
  }, [toast]);

  const handleAssignOwner = useCallback(async (dealId: string, ownerId: string | null) => {
    // Optimistic update
    const ownerProfile = ownerId && adminProfiles ? adminProfiles[ownerId] : null;
    setLocalOrder(prev => prev.map(deal =>
      deal.id === dealId ? {
        ...deal,
        deal_owner_id: ownerId,
        deal_owner: ownerProfile ? { id: ownerProfile.id, first_name: ownerProfile.first_name, last_name: ownerProfile.last_name, email: ownerProfile.email } : null,
      } : deal
    ));

    const { error } = await supabase
      .from('listings')
      .update({ deal_owner_id: ownerId })
      .eq('id', dealId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      return;
    }

    toast({ title: "Deal owner updated", description: ownerId ? "Owner has been assigned" : "Owner has been removed" });
  }, [adminProfiles, toast, queryClient]);

  const handleBulkArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      const dealIds = Array.from(selectedDeals);
      const { error } = await supabase
        .from('listings')
        .update({ status: 'archived' })
        .in('id', dealIds);
      
      if (error) throw error;
      
      toast({ 
        title: "Deals archived", 
        description: `${dealIds.length} deal(s) have been archived` 
      });
      setSelectedDeals(new Set());
      setShowArchiveDialog(false);
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  }, [selectedDeals, toast, refetchListings]);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const dealIds = Array.from(selectedDeals);
      
      for (const dealId of dealIds) {
        // Delete all FK references first
        await supabase.from('alert_delivery_logs').delete().eq('listing_id', dealId);
        await supabase.from('buyer_approve_decisions').delete().eq('listing_id', dealId);
        await supabase.from('buyer_learning_history').delete().eq('listing_id', dealId);
        await supabase.from('buyer_pass_decisions').delete().eq('listing_id', dealId);
        await supabase.from('chat_conversations').delete().eq('listing_id', dealId);
        await supabase.from('collection_items').delete().eq('listing_id', dealId);
        await supabase.from('connection_requests').delete().eq('listing_id', dealId);
        await supabase.from('deal_ranking_history').delete().eq('listing_id', dealId);
        await supabase.from('deal_referrals').delete().eq('listing_id', dealId);
        await supabase.from('deals').delete().eq('listing_id', dealId);
        await supabase.from('deal_scoring_adjustments').delete().eq('listing_id', dealId);
        await supabase.from('deal_transcripts').delete().eq('listing_id', dealId);
        await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
        await supabase.from('listing_analytics').delete().eq('listing_id', dealId);
        await supabase.from('listing_conversations').delete().eq('listing_id', dealId);
        await supabase.from('outreach_records').delete().eq('listing_id', dealId);
        await supabase.from('owner_intro_notifications').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_outreach').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_universe_deals').delete().eq('listing_id', dealId);
        await supabase.from('saved_listings').delete().eq('listing_id', dealId);
        await supabase.from('similar_deal_alerts').delete().eq('source_listing_id', dealId);
        
        // Delete the listing itself
        const { error } = await supabase.from('listings').delete().eq('id', dealId);
        if (error) throw error;
      }
      
      toast({ 
        title: "Deals permanently deleted", 
        description: `${dealIds.length} deal(s) have been permanently deleted` 
      });
      setSelectedDeals(new Set());
      setShowDeleteDialog(false);
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDeals, toast, refetchListings]);

  // Calculate scores dialog state
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  
  // Enrich dialog state
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);

  // Handle calculate scores - calls edge function for comprehensive scoring
  const handleCalculateScores = async (mode: 'all' | 'unscored') => {
    setShowCalculateDialog(false);
    setIsCalculating(true);
    try {
      // Call edge function to calculate scores
      // mode 'all' = forceRecalculate (re-enrich and rescore everything)
      // mode 'unscored' = calculateAll (only score unscored, enrich those without enrichment)
      const { data, error } = await supabase.functions.invoke('calculate-deal-quality', {
        body: mode === 'all' 
          ? { forceRecalculate: true, triggerEnrichment: true }
          : { calculateAll: true }
      });

      if (error) {
        throw new Error(error.message || 'Failed to calculate scores');
      }

      if (data?.scored === 0 && !data?.enrichmentQueued) {
        toast({ title: "All deals scored", description: "All deals already have quality scores calculated" });
      } else {
        const enrichmentMsg = data?.enrichmentQueued > 0 
          ? `. Queued ${data.enrichmentQueued} deals for enrichment.`
          : '';
        toast({
          title: "Scoring complete",
          description: `Calculated quality scores for ${data?.scored || 0} deals${data?.errors > 0 ? ` (${data.errors} errors)` : ''}${enrichmentMsg}`
        });
      }

      refetchListings();
    } catch (error: any) {
      console.error('Calculate scores error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle enrich all deals - queues deals for enrichment
  const handleEnrichDeals = async (mode: 'all' | 'unenriched') => {
    setShowEnrichDialog(false);

    if (!listings || listings.length === 0) {
      toast({ title: "No deals", description: "No deals available to enrich", variant: "destructive" });
      return;
    }

    setIsEnrichingAll(true);
    try {
      // Filter based on mode
      const dealsToEnrich = mode === 'all'
        ? listings
        : listings.filter(l => !l.enriched_at);

      if (dealsToEnrich.length === 0) {
        toast({ title: "All deals enriched", description: "All deals have already been enriched" });
        setIsEnrichingAll(false);
        return;
      }

      const dealIds = dealsToEnrich.map(l => l.id);

      // Gate check: register as major operation (blocks other majors / gets queued)
      const { queued } = await startOrQueueMajorOp({
        operationType: 'deal_enrichment',
        totalItems: dealIds.length,
        description: `Enrich ${dealIds.length} deals (${mode})`,
        userId: user?.id || 'unknown',
      });
      if (queued) {
        // Another major op is running — ours was queued and will auto-start later
        setIsEnrichingAll(false);
        return;
      }

      // Reset enriched_at for selected deals to force re-enrichment
      const { error: resetError } = await supabase
        .from('listings')
        .update({ enriched_at: null })
        .in('id', dealIds);

      if (resetError) {
        console.warn('Failed to reset enriched_at:', resetError);
      }

      const nowIso = new Date().toISOString();

      // Reset existing queue rows to a clean pending state
      const { error: resetQueueError } = await supabase
        .from('enrichment_queue')
        .update({
          status: 'pending',
          attempts: 0,
          started_at: null,
          completed_at: null,
          last_error: null,
          queued_at: nowIso,
          updated_at: nowIso,
        })
        .in('listing_id', dealIds);

      if (resetQueueError) throw resetQueueError;

      // Insert any missing queue rows
      const { error: insertMissingError } = await supabase
        .from('enrichment_queue')
        .upsert(
          dealIds.map(id => ({
            listing_id: id,
            status: 'pending',
            attempts: 0,
            queued_at: nowIso,
          })),
          { onConflict: 'listing_id', ignoreDuplicates: true }
        );

      if (insertMissingError) throw insertMissingError;

      toast({
        title: "Enrichment queued",
        description: `${dealIds.length} deal${dealIds.length > 1 ? 's' : ''} queued for enrichment. Starting processing now...`,
      });

      // Mirror the "Calculate Scores" experience by kicking the worker immediately
      // (cron is best-effort and can be misconfigured / paused).
      // Fire-and-forget: the worker is intentionally small-batch to avoid timeouts.
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'ui_enrich_deals' } })
        .then(({ error }) => {
          if (error) {
            console.warn('Failed to trigger enrichment worker:', error);
          }
        })
        .catch((e) => {
          console.warn('Failed to trigger enrichment worker:', e);
        });

      refetchListings();
    } catch (error: any) {
      console.error('Enrich deals error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsEnrichingAll(false);
    }
  };

  // Sortable header component
  const SortableHeader = ({ column, label, className = "" }: { column: string; label: string; className?: string }) => (
    <button 
      onClick={() => handleSort(column)} 
      className={cn("flex items-center gap-1 hover:text-foreground transition-colors", className)}
    >
      {label}
      {sortColumn === column ? (
        sortDirection === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Deals</h1>
          <p className="text-muted-foreground">
            {listings?.length || 0} deals across {universeCount} buyer universes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowAddDealDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button 
            onClick={() => setShowEnrichDialog(true)} 
            disabled={isEnrichingAll}
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isEnrichingAll ? "Queueing..." : "Enrich Deals"}
          </Button>
          <Button 
            onClick={() => setShowCalculateDialog(true)} 
            disabled={isCalculating}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculating ? "Scoring..." : "Score Deals"}
          </Button>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} compact />
        </div>
      </div>


      {/* KPI Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{kpiStats.totalDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priority Deals</p>
                <p className="text-2xl font-bold text-amber-600">{kpiStats.priorityDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Quality Score</p>
                <p className="text-2xl font-bold">{kpiStats.avgScore}<span className="text-base font-normal text-muted-foreground">/100</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calculator className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needs Scoring</p>
                <p className="text-2xl font-bold text-orange-600">{kpiStats.needsScoring}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Progress Indicator */}
      {(enrichmentProgress.isEnriching || enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={enrichmentProgress.completedCount}
          totalCount={enrichmentProgress.totalCount}
          progress={enrichmentProgress.progress}
          estimatedTimeRemaining={enrichmentProgress.estimatedTimeRemaining}
          processingRate={enrichmentProgress.processingRate}
          successfulCount={enrichmentProgress.successfulCount}
          failedCount={enrichmentProgress.failedCount}
          isPaused={enrichmentProgress.isPaused}
          onPause={pauseEnrichment}
          onResume={resumeEnrichment}
          onCancel={cancelEnrichment}
        />
      )}

      {/* Unified Filter Bar */}
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={DEAL_LISTING_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={totalCount}
        filteredCount={filteredListings.length}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        savedViews={savedViews}
        onSaveView={(name, filters) => addView({ name, filters })}
        onDeleteView={removeView}
        onSelectView={(view) => setFilterState(view.filters)}
      />

      {/* Bulk Actions Toolbar */}
      {selectedDeals.size > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm font-medium">
                {selectedDeals.size} selected
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <XCircle className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUniverseDialog(true)}
              >
                <FolderPlus className="h-4 w-4 mr-1" />
                Send to Universe
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => setShowArchiveDialog(true)}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Dialog */}
      <DealImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => refetchListings()}
        onImportCompleteWithIds={handleImportCompleteWithIds}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedDeals.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected deals to the archive. They will no longer 
              appear in the active deals list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkArchive}
              disabled={isArchiving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {selectedDeals.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected deals and all related data 
              (transcripts, scores, outreach records, etc.). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assign to Universe Dialog */}
      <BulkAssignUniverseDialog
        open={showUniverseDialog}
        onOpenChange={setShowUniverseDialog}
        dealIds={Array.from(selectedDeals)}
        onComplete={() => setSelectedDeals(new Set())}
      />

      <AlertDialog open={!!singleDeleteTarget} onOpenChange={(open) => !open && setSingleDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete "{singleDeleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this deal and all related data 
              (transcripts, scores, outreach records, etc.). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSingleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-0">
          <TooltipProvider>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleDragEnd}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
              <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th 
                      className="h-10 px-3 text-left align-middle font-medium text-muted-foreground border-b" 
                      style={{ width: columnWidths.select, minWidth: 40 }}
                    >
                      <Checkbox
                        checked={localOrder.length > 0 && selectedDeals.size === localOrder.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <ResizableHeader width={columnWidths.rank} onResize={(w) => handleColumnResize('rank', w)} minWidth={50}>
                      <SortableHeader column="rank" label="#" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.dealName} onResize={(w) => handleColumnResize('dealName', w)} minWidth={100}>
                      <SortableHeader column="deal_name" label="Deal Name" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.referralSource} onResize={(w) => handleColumnResize('referralSource', w)} minWidth={60}>
                      <SortableHeader column="referral_source" label="Referral Source" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.industry} onResize={(w) => handleColumnResize('industry', w)} minWidth={60}>
                      <SortableHeader column="industry" label="Industry" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.description} onResize={(w) => handleColumnResize('description', w)} minWidth={100}>
                      <span className="text-muted-foreground font-medium">Description</span>
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.location} onResize={(w) => handleColumnResize('location', w)} minWidth={60}>
                      <span className="text-muted-foreground font-medium">Location</span>
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.revenue} onResize={(w) => handleColumnResize('revenue', w)} minWidth={60} className="text-right">
                      <SortableHeader column="revenue" label="Revenue" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.ebitda} onResize={(w) => handleColumnResize('ebitda', w)} minWidth={60} className="text-right">
                      <SortableHeader column="ebitda" label="EBITDA" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.linkedinCount} onResize={(w) => handleColumnResize('linkedinCount', w)} minWidth={50} className="text-right">
                      <SortableHeader column="linkedinCount" label="LI Count" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.linkedinRange} onResize={(w) => handleColumnResize('linkedinRange', w)} minWidth={50} className="text-right">
                      <SortableHeader column="linkedinRange" label="LI Range" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.googleReviews} onResize={(w) => handleColumnResize('googleReviews', w)} minWidth={50} className="text-right">
                      <SortableHeader column="googleReviews" label="Reviews" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.googleRating} onResize={(w) => handleColumnResize('googleRating', w)} minWidth={50} className="text-right">
                      <SortableHeader column="googleRating" label="Rating" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.quality} onResize={(w) => handleColumnResize('quality', w)} minWidth={50} className="text-center">
                      <SortableHeader column="score" label="Quality" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.sellerInterest} onResize={(w) => handleColumnResize('sellerInterest', w)} minWidth={60} className="text-center">
                      <SortableHeader column="sellerInterest" label="Seller Interest" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.engagement} onResize={(w) => handleColumnResize('engagement', w)} minWidth={80} className="text-center">
                      <SortableHeader column="engagement" label="Engagement" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.dealOwner} onResize={(w) => handleColumnResize('dealOwner', w)} minWidth={80}>
                      <span className="text-muted-foreground font-medium">Deal Owner</span>
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.added} onResize={(w) => handleColumnResize('added', w)} minWidth={60}>
                      <SortableHeader column="added" label="Added" />
                    </ResizableHeader>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: columnWidths.actions, minWidth: 40 }}></th>
                  </tr>
                </thead>
                <TableBody>
                  {listingsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : localOrder.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No deals found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext
                      items={localOrder.map(l => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {localOrder.map((listing, index) => (
                        <SortableTableRow
                          key={listing.id}
                          listing={listing}
                          index={index}
                          stats={scoreStats?.[listing.id]}
                          navigate={navigate}
                          formatCurrency={formatCurrency}
                          formatWebsiteDomain={formatWebsiteDomain}
                          getEffectiveWebsite={getEffectiveWebsite}
                          formatGeographyBadges={formatGeographyBadges}
                          getScoreTrendIcon={getScoreTrendIcon}
                          columnWidths={columnWidths}
                          isSelected={selectedDeals.has(listing.id)}
                          onToggleSelect={handleToggleSelect}
                          onArchive={handleArchiveDeal}
                          onDelete={handleDeleteDeal}
                          onTogglePriority={handleTogglePriority}
                          adminProfiles={adminProfiles}
                          onAssignOwner={handleAssignOwner}
                          onUpdateRank={async (dealId, newRank) => {
                            // Work on rank-sorted copy so position logic is correct
                            // regardless of current table sort column
                            const rankSorted = [...localOrder].sort((a, b) =>
                              (a.manual_rank_override ?? 9999) - (b.manual_rank_override ?? 9999)
                            );
                            const movedIndex = rankSorted.findIndex(l => l.id === dealId);
                            if (movedIndex === -1) return;

                            const targetPos = Math.max(1, Math.min(newRank, rankSorted.length));
                            const [movedDeal] = rankSorted.splice(movedIndex, 1);
                            rankSorted.splice(targetPos - 1, 0, movedDeal);

                            // Build a map of id → new rank from the rank-sorted list
                            const newRanks = new Map(rankSorted.map((l, idx) => [l.id, idx + 1]));

                            // Apply new ranks to localOrder (preserving current display sort)
                            const updatedLocal = localOrder.map(l => ({
                              ...l,
                              manual_rank_override: newRanks.get(l.id) ?? l.manual_rank_override,
                            }));

                            // Only persist deals whose rank actually changed
                            const changedDeals = updatedLocal.filter(deal => {
                              const original = localOrder.find(d => d.id === deal.id);
                              return !original || original.manual_rank_override !== deal.manual_rank_override;
                            });

                            // Optimistic UI update
                            setLocalOrder(updatedLocal);
                            sortedListingsRef.current = updatedLocal;

                            try {
                              if (changedDeals.length > 0) {
                                await Promise.all(
                                  changedDeals.map((deal) =>
                                    supabase
                                      .from('listings')
                                      .update({ manual_rank_override: deal.manual_rank_override })
                                      .eq('id', deal.id)
                                      .throwOnError()
                                  )
                                );
                              }
                              await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
                              toast({ title: 'Position updated', description: `Deal moved to position ${targetPos}` });
                            } catch (err: any) {
                              console.error('Failed to update rank:', err);
                              await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
                              toast({ title: 'Failed to update rank', variant: 'destructive' });
                            }
                          }}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </table>
              </div>
            </DndContext>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Calculate Scores Dialog */}
      <Dialog open={showCalculateDialog} onOpenChange={setShowCalculateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate Deal Scores
            </DialogTitle>
            <DialogDescription>
              Choose how you want to calculate quality scores. Both options will trigger website enrichment for accurate data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="default"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleCalculateScores('all')}
              disabled={isCalculating}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">Calculate All</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Re-enrich all websites and recalculate all scores
                </span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleCalculateScores('unscored')}
              disabled={isCalculating}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">Just Those Without a Score</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Only enrich and score deals that don't have a score yet
                </span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCalculateDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrich Deals Dialog */}
      <Dialog open={showEnrichDialog} onOpenChange={setShowEnrichDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Enrich Deals
            </DialogTitle>
            <DialogDescription>
              Enrichment scrapes websites, extracts company data, and fetches LinkedIn & Google info.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="default"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleEnrichDeals('all')}
              disabled={isEnrichingAll}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">Enrich All</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Re-enrich all {listings?.length || 0} deals (resets existing data)
                </span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleEnrichDeals('unenriched')}
              disabled={isEnrichingAll}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">Only Unenriched</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Only enrich {listings?.filter(l => !l.enriched_at).length || 0} deals that haven't been enriched yet
                </span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEnrichDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deal Dialog */}
      <AddDealDialog
        open={showAddDealDialog}
        onOpenChange={setShowAddDealDialog}
        onDealCreated={() => refetchListings()}
      />

      {/* AI Chat */}
      <ReMarketingChat
        context={{ type: "deals", totalDeals: listings?.length }}
      />

      {/* Deal Enrichment Summary Dialog */}
      <DealEnrichmentSummaryDialog
        open={showEnrichmentSummary}
        onOpenChange={(open) => !open && dismissSummary()}
        summary={enrichmentSummary}
        onRetryFailed={handleRetryFailedEnrichment}
      />
    </div>
  );
};

export default ReMarketingDeals;
