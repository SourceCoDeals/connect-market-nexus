
import { ImageIcon } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";

interface ListingCardImageProps {
  imageUrl: string | null;
  title: string;
  viewType: "grid" | "list";
}

const ListingCardImage = ({ imageUrl: initialImageUrl, title, viewType }: ListingCardImageProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);
  
  // Initialize image URL when in view
  useEffect(() => {
    if (isInView) {
      const url = initialImageUrl || DEFAULT_IMAGE;
      setImageUrl(url);
      setImageError(false);
    }
  }, [initialImageUrl, isInView]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    if (imageUrl !== DEFAULT_IMAGE) {
      setImageUrl(DEFAULT_IMAGE);
      setImageError(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={viewType === "list" ? "w-1/4 min-w-[180px] relative" : "relative"}
    >
      <AspectRatio ratio={viewType === "list" ? 4/3 : 16/9} className="bg-muted">
        {!isInView ? (
          // Placeholder while not in view
          <div className="w-full h-full flex items-center justify-center bg-gray-100 animate-pulse">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        ) : imageError || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        ) : (
          <>
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt={title} 
              className={`object-cover w-full h-full transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
            />
          </>
        )}
      </AspectRatio>
      <div className="absolute top-2 right-2">
        <Badge className="bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="h-3 w-3" />
        </Badge>
      </div>
    </div>
  );
};

export default ListingCardImage;
