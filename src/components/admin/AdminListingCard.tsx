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
    <Card className="admin-card-premium group overflow-hidden">
      {/* Premium Image Container */}
      <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center overflow-hidden">
        {listing.image_url ? (
          <img 
            src={listing.image_url} 
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
            <Building2 className="h-16 w-16 text-gray-300" />
          </div>
        )}
        
        {/* Premium Status Tag Overlay */}
        {listing.status_tag && (
          <div className="absolute top-4 left-4">
            <div className="bg-white/95 backdrop-blur-sm border border-white/50 rounded-lg px-3 py-1.5 shadow-sm">
              <ListingStatusTag status={listing.status_tag} />
            </div>
          </div>
        )}

        {/* Selection Checkbox - Premium Style */}
        <div className="absolute top-4 right-4">
          <div className="bg-white/95 backdrop-blur-sm border border-white/50 rounded-lg p-1 shadow-sm">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="data-[state=checked]:bg-sourceco data-[state=checked]:border-sourceco"
            />
          </div>
        </div>

        {/* Sophisticated Status Indicator */}
        <div className="absolute bottom-4 right-4">
          <div className={`status-badge-premium ${listing.status === "active" ? "status-active" : "status-inactive"}`}>
            <div className={`w-2 h-2 rounded-full ${listing.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`}></div>
            <span className="capitalize font-medium">{listing.status}</span>
          </div>
        </div>
      </div>

      {/* Sophisticated Status Tag Switcher */}
      {onStatusTagChange && (
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50/50 to-white border-t border-gray-100">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Deal Status
            </label>
            <select
              value={listing.status_tag || ""}
              onChange={(e) => onStatusTagChange(listing.id, e.target.value || null)}
              className="w-full text-sm bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg px-4 py-2.5 
                       text-gray-700 focus:outline-none focus:ring-2 focus:ring-sourceco/30 focus:border-sourceco
                       transition-all duration-200 font-medium"
            >
              <option value="">Select Status</option>
              <option value="just_listed">🆕 Just Listed</option>
              <option value="reviewing_buyers">👀 Reviewing Buyers</option>
              <option value="in_diligence">🔍 In Diligence</option>
              <option value="under_loi">📝 Under LOI</option>
              <option value="accepted_offer">✅ Accepted Offer</option>
            </select>
          </div>
        </div>
      )}

      <CardHeader className="pb-4 px-6 pt-6">
        <div className="space-y-4">
          {/* Investment-Grade Title Section */}
          <div className="space-y-3">
            <h3 className="text-xl font-light text-gray-900 leading-tight tracking-tight">
              {listing.title}
            </h3>
            {listing.internal_company_name && (
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-sourceco/10 to-sourceco-accent/10 
                           border border-sourceco/20 px-3 py-1.5 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-sourceco/60"></div>
                <span className="text-sm font-semibold text-sourceco">
                  {listing.internal_company_name}
                </span>
              </div>
            )}
          </div>

          {/* Sophisticated Metadata */}
          <div className="flex flex-wrap gap-2">
            {displayCategories.slice(0, 2).map((cat, index) => (
              <div key={index} className="inline-flex items-center gap-1.5 px-2.5 py-1 
                                        bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-600">
                {cat}
              </div>
            ))}
            {displayCategories.length > 2 && (
              <div className="inline-flex items-center px-2.5 py-1 bg-gray-50 border border-gray-200 
                           rounded-md text-xs font-medium text-gray-500">
                +{displayCategories.length - 2} more
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 
                         bg-blue-50 border border-blue-200 rounded-md text-xs font-medium text-blue-700">
              <MapPin className="h-3 w-3" />
              {listing.location}
            </div>
            {listing.deal_identifier && (
              <div className="inline-flex items-center px-2.5 py-1 bg-amber-50 border border-amber-200 
                           rounded-md text-xs font-mono font-semibold text-amber-700">
                {listing.deal_identifier}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-6 space-y-6">
        {/* Investment-Grade Financial Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="financial-metric group cursor-default">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 
                         flex items-center justify-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Revenue
            </div>
            <div className="text-xl font-light text-gray-900 tracking-tight">
              {formatCurrency(revenue)}
            </div>
          </div>
          <div className="financial-metric group cursor-default">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 
                         flex items-center justify-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              EBITDA
            </div>
            <div className="text-xl font-light text-gray-900 tracking-tight">
              {formatCurrency(ebitda)}
            </div>
          </div>
        </div>

        {/* Sophisticated Meta Information */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-medium">
                {new Date(listing.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
            <div className="w-px h-3 bg-gray-300"></div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span>Updated {new Date(listing.updated_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric'
              })}</span>
            </div>
          </div>
        </div>

        {/* Investment-Grade Action Panel */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={onEdit}
            className="action-button-primary flex-1 h-11 rounded-lg font-medium"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Listing
          </Button>
          <Button
            variant="outline"
            onClick={onToggleStatus}
            className="px-4 h-11 rounded-lg border-gray-200 bg-white/70 backdrop-blur-sm
                     hover:bg-white hover:border-gray-300 transition-all duration-200"
          >
            {listing.status === "active" ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="px-4 h-11 rounded-lg border-gray-200 bg-white/70 backdrop-blur-sm
                         hover:bg-white hover:border-gray-300 transition-all duration-200"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-sm border-gray-200">
              <DropdownMenuItem 
                onClick={() => window.open(`/listing/${listing.id}`, '_blank')}
                className="h-10"
              >
                <ExternalLink className="h-4 w-4 mr-3" />
                View Public Page
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-10"
              >
                <Activity className="h-4 w-4 mr-3" />
                {isExpanded ? 'Hide' : 'Show'} Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete} 
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-10"
              >
                <Trash2 className="h-4 w-4 mr-3" />
                Delete Listing
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