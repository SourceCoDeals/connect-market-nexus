import { ImageIcon, MapPin, Calendar } from "lucide-react";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import { CategoryLocationBadges } from "@/components/shared/CategoryLocationBadges";
import { EditableTitle } from "@/components/listing-detail/EditableTitle";
import { getListingImage } from "@/lib/listing-image-utils";
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
    <div className="space-y-6 mb-8">
      {/* Top Badges Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {listing.status_tag && (
          <ListingStatusTag status={listing.status_tag} />
        )}
        {isInactive && isAdmin && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <span className="text-[10px] font-medium text-red-700 tracking-[0.02em]">
              Inactive
            </span>
          </div>
        )}
      </div>

      {/* Horizontal Image + Info Layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Left - Image */}
        <div className="flex-shrink-0 w-full lg:w-[360px] h-[240px] lg:h-[360px] border border-slate-200 bg-slate-50 rounded-lg overflow-hidden">
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
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {/* Category & Location Badges */}
          <CategoryLocationBadges 
            acquisitionType={listing.acquisition_type}
            categories={listing.categories}
            category={listing.category}
            location={listing.location}
            variant="default"
          />

          {/* Title */}
          <EditableTitle
            listingId={listing.id}
            initialValue={listing.title}
            isEditing={isAdmin && editModeEnabled && !userViewEnabled}
          />

          {/* Location */}
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">{listing.location}</span>
          </div>

          {/* Listed Date */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm w-fit">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-700 tracking-wide">
              {formatListedDate()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
