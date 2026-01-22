import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Eye, EyeOff, Edit, Trash2, MoreHorizontal, Calendar, 
  DollarSign, TrendingUp, MapPin, Building2, Activity,
  Users, Heart, ExternalLink, Globe, ShieldCheck, Sparkles
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminListing } from "@/types/admin";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import { formatCurrency } from "@/lib/utils";
import { CategoryLocationBadges } from "@/components/shared/CategoryLocationBadges";
import { StatusTagEditor } from "./StatusTagEditor";
import { StatusTagSwitcher } from "./StatusTagSwitcher";
import { ReMarketingBadge } from "@/components/remarketing";
import { StatusTagValue } from "@/constants/statusTags";
import { BUYER_TYPE_OPTIONS } from "@/lib/signup-field-options";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminListingCardProps {
  listing: AdminListing;
  viewMode: 'grid' | 'table';
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onStatusTagChange?: (listingId: string, statusTag: string | null) => void;
}

export function AdminListingCard({
  listing,
  viewMode,
  isSelected,
  onSelect,
  onEdit,
  onToggleStatus,
  onDelete,
  onStatusTagChange,
}: AdminListingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const displayCategories = listing.categories || (listing.category ? [listing.category] : []);
  const revenue = Number(listing.revenue) || 0;
  const ebitda = Number(listing.ebitda) || 0;

  // Buyer visibility helpers
  const isVisibleToAll = !listing.visible_to_buyer_types || listing.visible_to_buyer_types.length === 0;
  const visibleBuyerTypesCount = listing.visible_to_buyer_types?.length || 0;
  const visibleBuyerTypeLabels = listing.visible_to_buyer_types?.map(type => 
    BUYER_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type
  ) || [];

  if (viewMode === 'table') {
    return (
      <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-sourceco/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="data-[state=checked]:bg-sourceco data-[state=checked]:border-sourceco"
            />
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {/* Title & Company */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-foreground truncate">{listing.title}</h3>
                  {listing.status_tag && (
                    <ListingStatusTag status={listing.status_tag} className="scale-75 relative top-0 left-0" />
                  )}
                </div>
                {onStatusTagChange && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Status Tag</div>
                    <StatusTagSwitcher
                      currentValue={listing.status_tag}
                      onChange={(value) => onStatusTagChange(listing.id, value)}
                      className="w-48"
                    />
                  </div>
                )}
                {listing.internal_company_name && (
                  <p className="text-sm text-muted-foreground font-medium bg-sourceco/5 px-2 py-0.5 rounded inline-block">
                    {listing.internal_company_name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={listing.status === "active" ? "default" : "secondary"}
                    className={listing.status === "active" 
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                      : "bg-slate-100 text-slate-600 border-slate-200"
                    }
                  >
                    {listing.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {listing.location}
                  </Badge>
                  {/* Visibility Badge */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge 
                          variant="outline" 
                          className={isVisibleToAll 
                            ? "text-xs bg-success/10 text-success border-success/20" 
                            : "text-xs bg-info/10 text-info border-info/20"
                          }
                        >
                          {isVisibleToAll ? (
                            <>
                              <Globe className="h-3 w-3 mr-1" />
                              All Buyers
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {visibleBuyerTypesCount} Types
                            </>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          {isVisibleToAll ? (
                            <p>Visible to all buyer types</p>
                          ) : (
                            <>
                              <p className="font-semibold mb-1">Visible only to:</p>
                              <ul className="list-disc list-inside">
                                {visibleBuyerTypeLabels.map((label, i) => (
                                  <li key={i}>{label}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ReMarketingBadge listingId={listing.id} />
                </div>
              </div>

              {/* Financials */}
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {formatCurrency(revenue)}
                </div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {formatCurrency(ebitda)}
                </div>
                <div className="text-xs text-muted-foreground">EBITDA</div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/admin/remarketing/matching/${listing.id}`)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Match Buyers
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggleStatus}>
                      {listing.status === "active" ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border border-border/50 shadow-sm bg-card rounded-lg">
      {/* Image Container with Status Tag Overlay */}
      <div className="relative h-48 rounded-t-lg">
        <div className="h-full bg-gradient-to-br from-sourceco/5 to-sourceco/10 flex items-center justify-center overflow-hidden rounded-t-lg">
          {listing.image_url ? (
            <img 
              src={listing.image_url} 
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="h-12 w-12 text-sourceco/40" />
          )}
        </div>
        
        {/* Status Tag Overlay */}
        {listing.status_tag && (
          <div className="absolute -top-2 -left-2">
            <ListingStatusTag status={listing.status_tag} />
          </div>
        )}

        {/* Status Tag Editor */}
        {onStatusTagChange && (
          <StatusTagEditor
            currentStatus={listing.status_tag}
            onStatusChange={(status) => onStatusTagChange(listing.id, status)}
          />
        )}

        {/* Selection Checkbox */}
        <div className="absolute top-3 right-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="bg-white/90 border-white/90 data-[state=checked]:bg-sourceco data-[state=checked]:border-sourceco shadow-sm"
          />
        </div>

        {/* Status Badge */}
        <div className="absolute bottom-3 right-3">
          <Badge 
            variant={listing.status === "active" ? "default" : "secondary"}
            className={listing.status === "active" 
              ? "bg-emerald-500 text-white border-0" 
              : "bg-slate-500 text-white border-0"
            }
          >
            {listing.status}
          </Badge>
        </div>
      </div>

      {/* Status Tag Switcher */}
      {onStatusTagChange && (
        <div className="px-4 py-4 bg-muted/20 border-t border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Status Tag</div>
          <StatusTagSwitcher
            currentValue={listing.status_tag}
            onChange={(value) => onStatusTagChange(listing.id, value)}
          />
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="space-y-3">
          {/* Title and Company */}
          <div>
            <h3 className="font-semibold text-lg text-foreground leading-tight mb-1">
              {listing.title}
            </h3>
            {listing.internal_company_name && (
              <p className="text-sm font-medium text-sourceco bg-sourceco/10 px-2 py-1 rounded-md inline-block">
                {listing.internal_company_name}
              </p>
            )}
          </div>

          {/* Categories and Location */}
          <div className="flex flex-wrap gap-1.5">
            <CategoryLocationBadges 
              acquisitionType={listing.acquisition_type}
              category={displayCategories[0]}
              location={listing.location}
            />
            {displayCategories.length > 1 && (
              <Badge variant="outline" className="text-xs bg-background">
                +{displayCategories.length - 1} more
              </Badge>
            )}
            {listing.deal_identifier && (
              <Badge variant="outline" className="text-xs font-mono bg-background">
                {listing.deal_identifier}
              </Badge>
            )}
            {/* Visibility Badge */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge 
                    variant="outline" 
                    className={isVisibleToAll 
                      ? "text-xs bg-success/10 text-success border-success/20" 
                      : "text-xs bg-info/10 text-info border-info/20"
                    }
                  >
                    {isVisibleToAll ? (
                      <>
                        <Globe className="h-3 w-3 mr-1" />
                        All Buyers
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {visibleBuyerTypesCount} Types
                      </>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {isVisibleToAll ? (
                      <p>Visible to all buyer types</p>
                    ) : (
                      <>
                        <p className="font-semibold mb-1">Visible only to:</p>
                        <ul className="list-disc list-inside">
                          {visibleBuyerTypeLabels.map((label, i) => (
                            <li key={i}>{label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Financial Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-sourceco/5 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3" />
              Revenue
            </div>
            <div className="text-lg font-semibold text-foreground">
              {formatCurrency(revenue)}
            </div>
          </div>
          <div className="text-center p-3 bg-sourceco/5 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" />
              EBITDA
            </div>
            <div className="text-lg font-semibold text-foreground">
              {formatCurrency(ebitda)}
            </div>
          </div>
        </div>

        {/* Meta Information and Remarketing Badge */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(listing.created_at).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Last updated {new Date(listing.updated_at).toLocaleDateString()}
            </div>
          </div>
          <ReMarketingBadge listingId={listing.id} />
        </div>

        {/* Primary Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onEdit}
            className="flex-1 bg-sourceco text-sourceco-foreground hover:bg-sourceco/90"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={onToggleStatus}
            className="px-3"
          >
            {listing.status === "active" ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="px-3">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/remarketing/matching/${listing.id}`)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Match Buyers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/listing/${listing.id}`, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Public Page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
                <Activity className="h-4 w-4 mr-2" />
                {isExpanded ? 'Hide' : 'Show'} Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t pt-4 space-y-3 animate-in slide-in-from-top-5 duration-200">
            {listing.owner_notes && (
              <div>
                <div className="text-sm font-medium mb-1">Owner Notes</div>
                <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">{listing.owner_notes}</p>
              </div>
            )}
            
            {listing.tags && listing.tags.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {listing.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}