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
    <div className="mb-8 relative">
      {/* Image positioned at top */}
      <div className="absolute top-0 left-0 right-0 w-full h-56 border border-slate-200/40 bg-slate-50 rounded-lg overflow-hidden shadow-sm">
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

      {/* Top Badges Row - Status Tag, Inactive, Add-On/Platform - will overflow on image */}
      <div className="flex items-center gap-2 flex-wrap relative z-10 pt-3 px-3">
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
        {listing.acquisition_type && (
          <CategoryLocationBadges 
            acquisitionType={listing.acquisition_type}
            variant="default"
          />
        )}
      </div>

      {/* Title Section - positioned below image */}
      <div className="mt-[15.5rem] mb-8">
        {/* Title */}
        <div className="mb-3">
          <h1 className="!text-[30px] !leading-[38px] !font-[300] !tracking-tight text-foreground">
            <EditableTitle
              listingId={listing.id}
              initialValue={listing.title}
              isEditing={isAdmin && editModeEnabled && !userViewEnabled}
            />
          </h1>
        </div>

        {/* Location, Industry, and Listed Date - All in one row */}
        <div className="flex items-center gap-3 flex-wrap text-foreground/80 mb-4">
          <div className="flex items-center">
            <MapPin size={12} className="mr-1" />
            <span className="text-xs font-semibold tracking-wide uppercase">{listing.location}</span>
          </div>
          <CategoryLocationBadges 
            categories={listing.categories}
            category={listing.category}
            variant="default"
          />
          <div className="text-xs text-muted-foreground">
            {formatListedDate()}
          </div>
        </div>

        {/* Description */}
        <div className="text-foreground/80 text-sm font-normal leading-relaxed max-w-2xl line-clamp-3">
          {listing.description}
        </div>
      </div>
    </div>
  );
}
