
import { ImageIcon } from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";

interface ListingDetailImageProps {
  imageUrl: string | null;
  title: string;
}

export const ListingDetailImage = ({ imageUrl, title }: ListingDetailImageProps) => {
  return (
    <div className="lg:col-span-2">
      <div className="rounded-lg overflow-hidden border border-border min-h-[300px] max-h-[400px] aspect-[16/9] relative mb-6">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = DEFAULT_IMAGE;
            }}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
      </div>
    </div>
  );
};
