import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ThumbsUp,
  ThumbsDown,
  Users,
  ExternalLink,
  Target,
  Globe,
  Sparkles,
  GripVertical,
  MoreHorizontal,
  Archive,
  Star,
  Trash2,
  PhoneCall,
} from "lucide-react";
import { format } from "date-fns";
import { DealSourceBadge } from "@/components/remarketing";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { DealListing, ColumnWidths } from "../types";
import { EditableRankCell } from "./EditableRankCell";

export const DealTableRow = ({
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
    const stateMatch = cleaned.match(/^([A-Z]{2})\b/);
    if (stateMatch) return stateMatch[1];
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

  const getLocationDisplay = (): string | null => {
    if (listing.address_city && listing.address_state) {
      const city = listing.address_city.trim();
      const state = normalizeState(listing.address_state);
      if (city && state) {
        return `${city}, ${state}`;
      }
    }
    if (listing.geographic_states && listing.geographic_states.length === 1) {
      const state = listing.geographic_states[0];
      if (state && state.length === 2) {
        return state;
      }
    }
    return null;
  };

  const geographyDisplay = getLocationDisplay();
  const qualityScore = listing.deal_total_score ?? null;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer hover:bg-muted/50",
        isDragging && "bg-muted/80 opacity-80 shadow-lg z-50",
        listing.needs_owner_contact && "bg-red-50 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50",
        !listing.needs_owner_contact && listing.is_priority_target && "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
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
            {listing.needs_owner_contact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center">
                    <PhoneCall className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-red-600 font-semibold">🚨 Owner needs to be contacted — buyer is ready!</p>
                </TooltipContent>
              </Tooltip>
            )}
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
        {(() => {
          const industryVal = listing.industry || listing.category;
          return industryVal ? (
            <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
              {industryVal.length > 18 ? industryVal.substring(0, 18) + '...' : industryVal}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        })()}
      </TableCell>

      {/* Description */}
      <TableCell style={{ width: columnWidths.description, minWidth: 120 }}>
        {(() => {
          const descText = listing.description || listing.executive_summary;
          return descText ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground leading-tight line-clamp-3 cursor-default" style={{ maxWidth: columnWidths.description - 16 }}>
                  {descText}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{descText}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        })()}
      </TableCell>

      {/* Location */}
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

      {/* Seller Interest Score */}
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

      {/* Priority */}
      <TableCell className="text-center" style={{ width: columnWidths.priority, minWidth: 50 }}>
        {listing.is_priority_target ? (
          <Star className="h-4 w-4 fill-amber-400 text-amber-400 mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
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
