import { ImageIcon } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState, useEffect } from "react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";

interface ListingCardImageProps {
  imageUrl: string | null;
  title: string;
  viewType: "grid" | "list";
}

const ListingCardImage = ({ imageUrl: initialImageUrl, title, viewType }: ListingCardImageProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Initialize image URL and validate it
  useEffect(() => {
    // Use the listing's image_url or fall back to default
    const url = initialImageUrl || DEFAULT_IMAGE;
    setImageUrl(url);
    
    // Reset error state when listing changes
    setImageError(false);
  }, [initialImageUrl]);

  const handleImageError = () => {
    console.error(`Failed to load image:`, imageUrl);
    setImageError(true);
    // Switch to default image when the original fails
    if (imageUrl !== DEFAULT_IMAGE) {
      setImageUrl(DEFAULT_IMAGE);
    }
  };

  return (
    <div className={viewType === "list" ? "w-1/4 min-w-[180px]" : ""}>
      <AspectRatio ratio={viewType === "list" ? 4/3 : 16/9} className="bg-muted relative">
        {imageError || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        ) : (
          <img 
            src={imageUrl} 
            alt={title} 
            className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-[1.02]" 
            onError={handleImageError}
          />
        )}
      </AspectRatio>
    </div>
  );
};

export default ListingCardImage;