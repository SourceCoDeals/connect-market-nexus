import { ImageIcon, MapPin } from "lucide-react";
import { EditableTitle } from "@/components/listing-detail/EditableTitle";
import { ListingIdBadge } from "@/components/listing-detail/ListingIdBadge";
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

  return (
    <div className="space-y-6">
      {/* Top Badges Row - Listing ID + Confidential */}
      <div className="flex items-center gap-2 flex-wrap">
        <ListingIdBadge listingId={listing.id} showConfidential={true} />
        {isInactive && isAdmin && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-50 border border-red-200">
            <span className="text-xs font-semibold text-red-700 tracking-wide">
              INACTIVE
            </span>
          </div>
        )}
      </div>

      {/* Full-Width Hero Image */}
      <div className="w-full h-[200px] md:h-[300px] lg:h-[400px] border border-slate-200/60 bg-slate-50 rounded-xl overflow-hidden">
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

      {/* Title with Location */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <EditableTitle
              listingId={listing.id}
              initialValue={listing.title}
              isEditing={isAdmin && editModeEnabled && !userViewEnabled}
              className="text-3xl lg:text-4xl font-semibold text-slate-950 tracking-tight"
            />
          </div>
        </div>
        
        {/* Location with icon */}
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span className="text-base">{listing.location}</span>
        </div>

        {/* Subtitle/Description - first line of description */}
        <p className="text-base text-slate-600 leading-relaxed line-clamp-2">
          {listing.category} business with strong market position and consistent revenue growth.
        </p>
      </div>
    </div>
  );
}
