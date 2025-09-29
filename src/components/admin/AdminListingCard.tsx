import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Eye, EyeOff, Edit, Trash2, MoreHorizontal, Calendar, 
  DollarSign, TrendingUp, MapPin, Building2, Activity,
  Users, Heart, ExternalLink
} from "lucide-react";
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
import { StatusTagEditor } from "./StatusTagEditor";

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

  const displayCategories = listing.categories || (listing.category ? [listing.category] : []);
  const revenue = Number(listing.revenue) || 0;
  const ebitda = Number(listing.ebitda) || 0;

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
                    <ListingStatusTag status={listing.status_tag} className="scale-75" />
                  )}
                </div>
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
                  onClick={onToggleStatus}
                  className="h-8 w-8 p-0"
                >
                  {listing.status === "active" ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
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
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-sm bg-card overflow-hidden">
      {/* Image Container with Status Tag Overlay */}
      <div className="relative h-48 bg-gradient-to-br from-sourceco/5 to-sourceco/10 flex items-center justify-center">
        {listing.image_url ? (
          <img 
            src={listing.image_url} 
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Building2 className="h-12 w-12 text-sourceco/40" />
        )}
        
        {/* Status Tag Overlay */}
        {listing.status_tag && (
          <div className="absolute top-3 left-3">
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
            {displayCategories.slice(0, 2).map((cat, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-background">
                {cat}
              </Badge>
            ))}
            {displayCategories.length > 2 && (
              <Badge variant="outline" className="text-xs bg-background">
                +{displayCategories.length - 2}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs bg-background">
              <MapPin className="h-3 w-3 mr-1" />
              {listing.location}
            </Badge>
            {listing.deal_identifier && (
              <Badge variant="outline" className="text-xs font-mono bg-background">
                {listing.deal_identifier}
              </Badge>
            )}
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

        {/* Description */}
        <div className="text-sm text-muted-foreground line-clamp-2">
          {listing.description_html ? (
            <div dangerouslySetInnerHTML={{ __html: listing.description_html }} className="prose prose-sm max-w-none" />
          ) : (
            <p>{listing.description}</p>
          )}
        </div>

        {/* Meta Information */}
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