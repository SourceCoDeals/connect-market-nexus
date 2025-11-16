import { ImageIcon, MapPin, Calendar } from "lucide-react";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import { CategoryLocationBadges } from "@/components/shared/CategoryLocationBadges";
import { EditableTitle } from "@/components/listing-detail/EditableTitle";
import { FinancialMetrics } from "@/components/listing-detail/FinancialMetrics";
import { getListingImage } from "@/lib/listing-image-utils";
import { formatCurrency } from "@/lib/currency-utils";
import { Listing } from "@/types";

interface ListingHeaderProps {
  listing: Listing;
  isAdmin: boolean;
  editModeEnabled: boolean;
  userViewEnabled: boolean;
  isInactive: boolean;
}

export function ListingHeader({ 
  listing, 
  isAdmin, 
  editModeEnabled, 
  userViewEnabled,
  isInactive 
}: ListingHeaderProps) {
  const imageData = getListingImage(listing.image_url, listing.category);
  
  // Format listed date
  const formatListedDate = () => {
    const listedDate = new Date(listing.created_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - listedDate.getTime()) / (1000 * 3600 * 24));
    if (daysDiff === 0) return "Listed today";
    if (daysDiff === 1) return "Listed yesterday";
    if (daysDiff < 7) return `Listed ${daysDiff}d ago`;
    if (daysDiff < 30) return `Listed ${Math.floor(daysDiff / 7)}w ago`;
    return "Listed 30+ days ago";
  };

  return (
    <div className="space-y-2.5 mb-3">
      {/* Top Badges Row - Only Status Tag + Acquisition Type */}
      <div className="flex items-center gap-2 flex-wrap">
        {listing.status_tag && (
          <ListingStatusTag status={listing.status_tag} variant="inline" />
        )}
        <CategoryLocationBadges 
          acquisitionType={listing.acquisition_type}
          variant="default"
        />
        {isInactive && isAdmin && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <span className="text-[10px] font-medium text-red-700 tracking-[0.02em]">
              Inactive
            </span>
          </div>
        )}
      </div>

      {/* Horizontal Image + Info Layout */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        {/* Left - Image */}
        <div className="flex-shrink-0 w-full lg:w-[200px] h-[200px] md:h-[200px] lg:h-[200px] border border-slate-200/60 bg-slate-50 rounded-lg overflow-hidden transition-all duration-200 hover:border-slate-300/80">
          {imageData.type === 'image' ? (
            <img
              src={imageData.value}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ background: imageData.value }}
            >
              <ImageIcon className="h-16 w-16 text-white opacity-40" />
            </div>
          )}
        </div>

        {/* Right - Core Info */}
        <div className="flex-1 flex flex-col">
          {/* Title and badges at top */}
          <div className="space-y-4">
            {/* Title */}
            <div>
              <EditableTitle
                listingId={listing.id}
                initialValue={listing.title}
                isEditing={isAdmin && editModeEnabled && !userViewEnabled}
              />
            </div>

            {/* Category & Location Badges with Listed Date */}
            <div className="flex items-center gap-3 flex-wrap">
              <CategoryLocationBadges 
                categories={listing.categories}
                category={listing.category}
                location={listing.location}
                variant="default"
              />
              <div className="text-xs text-slate-400/80">
                {formatListedDate()}
              </div>
            </div>
          </div>

          {/* Spacer to push metrics to bottom */}
          <div className="flex-1" />

          {/* Financial Metrics - Aligned with image bottom */}
          <div>
            <FinancialMetrics 
              revenue={listing.revenue}
              ebitda={listing.ebitda}
              formatCurrency={formatCurrency}
              fullTimeEmployees={listing.full_time_employees}
              partTimeEmployees={listing.part_time_employees}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
