import { ImageIcon, MapPin } from "lucide-react";
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
      {/* Top Badges Row - Status Tag + Acquisition Type */}
      <div className="flex items-center gap-2 flex-wrap">
        {listing.status_tag && (
          <ListingStatusTag status={listing.status_tag} variant="inline" />
        )}
        {isInactive && isAdmin && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <span className="text-[10px] font-medium text-red-700 tracking-[0.02em]">
              Inactive
            </span>
          </div>
        )}
      </div>

      {/* Full-Width Hero Image */}
      <div className="w-full h-[200px] md:h-[300px] lg:h-[400px] border border-slate-200/60 bg-slate-50 rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-300/80">
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
            <ImageIcon className="h-24 w-24 text-white opacity-40" />
          </div>
        )}
      </div>

      {/* Title Section */}
      <div className="space-y-4">
        {/* Title with inline Add-On/Platform badge */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <EditableTitle
              listingId={listing.id}
              initialValue={listing.title}
              isEditing={isAdmin && editModeEnabled && !userViewEnabled}
            />
          </div>
          {listing.acquisition_type && (
            <div className="flex-shrink-0">
              <CategoryLocationBadges 
                acquisitionType={listing.acquisition_type}
                variant="default"
              />
            </div>
          )}
        </div>

        {/* Location with Icon */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="w-4 h-4" />
          <span className="uppercase tracking-wide font-medium">{listing.location}</span>
        </div>

        {/* Description */}
        <div className="text-[15px] leading-relaxed text-slate-700 max-w-3xl">
          {listing.description}
        </div>

        {/* Category Badges & Listed Date */}
        <div className="flex items-center gap-3 flex-wrap text-sm text-slate-500">
          <CategoryLocationBadges 
            categories={listing.categories}
            category={listing.category}
            variant="default"
          />
          <span>•</span>
          <div>
            {formatListedDate()}
          </div>
        </div>
      </div>
    </div>
  );
}
