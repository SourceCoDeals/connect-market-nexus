
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, TrendingUp, Building, Users, DollarSign, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSavedListings } from "@/hooks/marketplace/use-saved-listings";
import { useListingAnalytics } from "@/hooks/use-listing-analytics";
import { useToast } from "@/hooks/use-toast";

interface Listing {
  id: string;
  title: string;
  description: string;
  revenue: number;
  ebitda: number;
  location: string;
  category: string;
  image_url?: string;
  tags?: string[];
  categories?: string[];
}

interface ListingCardProps {
  listing: Listing;
  showSaveButton?: boolean;
}

const ListingCard = ({ listing, showSaveButton = true }: ListingCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [imageError, setImageError] = useState(false);
  
  const { 
    savedListings, 
    saveListing, 
    removeListing, 
    isLoading 
  } = useSavedListings();
  
  const {
    trackListingView,
    trackListingSave,
    trackListingUnsave,
  } = useListingAnalytics();

  const isSaved = savedListings?.some(saved => saved.listing_id === listing.id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const handleCardClick = () => {
    trackListingView(listing.id, {
      title: listing.title,
      category: listing.category,
      location: listing.location,
      revenue: listing.revenue,
      clickSource: 'listing_card'
    });
    navigate(`/listing/${listing.id}`);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      if (isSaved) {
        await removeListing.mutateAsync(listing.id);
        trackListingUnsave(listing.id, {
          title: listing.title,
          category: listing.category,
        });
        toast({
          title: "Listing removed",
          description: "The listing has been removed from your saved items.",
        });
      } else {
        await saveListing.mutateAsync(listing.id);
        trackListingSave(listing.id, {
          title: listing.title,
          category: listing.category,
        });
        toast({
          title: "Listing saved",
          description: "The listing has been added to your saved items.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update saved listing. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card 
      className="h-full hover:shadow-md transition-shadow cursor-pointer group"
      onClick={handleCardClick}
    >
      <CardHeader className="p-0">
        <div className="relative">
          {listing.image_url && !imageError ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              className="w-full h-48 object-cover rounded-t-lg"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-t-lg flex items-center justify-center">
              <Building className="h-12 w-12 text-blue-400" />
            </div>
          )}
          
          {showSaveButton && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white shadow-sm"
              onClick={handleSaveToggle}
              disabled={isLoading}
            >
              <Heart 
                className={`h-4 w-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
              />
            </Button>
          )}
          
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-white/90">
              {listing.category}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {listing.title}
          </h3>
          
          <div className="flex items-center text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 mr-1" />
            {listing.location}
          </div>
          
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
            {listing.description}
          </p>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1 text-green-600" />
              <span className="font-medium">{formatCurrency(listing.revenue)}</span>
              <span className="text-muted-foreground ml-1">revenue</span>
            </div>
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-1 text-blue-600" />
              <span className="font-medium">{formatCurrency(listing.ebitda)}</span>
              <span className="text-muted-foreground ml-1">EBITDA</span>
            </div>
          </div>
          
          {(listing.tags || listing.categories) && (
            <div className="flex flex-wrap gap-1">
              {(listing.tags || listing.categories || []).slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {(listing.tags || listing.categories || []).length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{(listing.tags || listing.categories || []).length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ListingCard;
