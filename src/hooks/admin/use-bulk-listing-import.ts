
import { useState } from "react";
import { useCreateListing } from "./listings/use-create-listing";
import { ParsedListing, BulkImportResult, ImageProcessingResult } from "@/types/bulk-listing";
import { toast } from "@/hooks/use-toast";

export function useBulkListingImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<BulkImportResult[]>([]);
  const [currentOperation, setCurrentOperation] = useState<string>('');
  const [imagesProcessed, setImagesProcessed] = useState(0);
  const [imagesFailed, setImagesFailed] = useState(0);
  
  const createListing = useCreateListing();

  const processImage = async (imageUrl: string, listingTitle: string): Promise<ImageProcessingResult> => {
    if (!imageUrl) return { success: false, error: 'No image URL provided' };
    
    try {
      console.log(`Processing image for "${listingTitle}": ${imageUrl}`);
      
      // Download image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      // Convert to blob
      const blob = await response.blob();
      
      // Create File object
      const file = new File([blob], `${listingTitle.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`, {
        type: blob.type || 'image/jpeg'
      });
      
      return { success: true, url: imageUrl };
    } catch (error: any) {
      console.error(`Failed to process image for "${listingTitle}":`, error);
      return { success: false, error: error.message };
    }
  };

  const importListings = async (listings: ParsedListing[], dryRun = false) => {
    setIsLoading(true);
    setProgress(0);
    setErrors([]);
    setResults([]);
    setCurrentOperation('');
    setImagesProcessed(0);
    setImagesFailed(0);

    const totalListings = listings.length;
    const importResults: BulkImportResult[] = [];
    const importErrors: string[] = [];

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      
      try {
        setCurrentOperation(`Processing "${listing.title}"`);
        
        // Validate the listing
        const validationErrors = validateListing(listing);
        if (validationErrors.length > 0) {
          const error = `Listing "${listing.title}": ${validationErrors.join(', ')}`;
          importErrors.push(error);
          importResults.push({
            success: false,
            title: listing.title,
            error: validationErrors.join(', ')
          });
          continue;
        }

        let processedImageFile: File | null = null;
        let imageProcessed = false;
        
        // Process image if provided
        if (listing.image_url && !dryRun) {
          setCurrentOperation(`Processing image for "${listing.title}"`);
          const imageResult = await processImage(listing.image_url, listing.title);
          
          if (imageResult.success) {
            // For now, we'll pass the URL directly - the create listing hook will handle it
            imageProcessed = true;
            setImagesProcessed(prev => prev + 1);
          } else {
            console.warn(`Image processing failed for "${listing.title}": ${imageResult.error}`);
            setImagesFailed(prev => prev + 1);
          }
        }

        if (!dryRun) {
          setCurrentOperation(`Creating listing "${listing.title}"`);
          
          // Actually create the listing
          const result = await createListing.mutateAsync({
            listing: {
              title: listing.title,
              category: listing.category,
              location: listing.location,
              revenue: listing.revenue,
              ebitda: listing.ebitda,
              description: listing.description,
              owner_notes: listing.owner_notes,
              status: listing.status,
              tags: listing.tags,
              image_url: listing.image_url || null, // Pass the image URL directly
            },
            image: processedImageFile
          });

          importResults.push({
            success: true,
            id: result.id,
            title: listing.title,
            image_processed: imageProcessed,
            image_url: listing.image_url
          });
        } else {
          // Dry run - just validate
          importResults.push({
            success: true,
            title: listing.title,
            image_processed: !!listing.image_url
          });
        }
      } catch (error: any) {
        const errorMessage = `Failed to ${dryRun ? 'validate' : 'create'} "${listing.title}": ${error.message}`;
        importErrors.push(errorMessage);
        importResults.push({
          success: false,
          title: listing.title,
          error: error.message
        });
      }

      // Update progress
      const newProgress = Math.round(((i + 1) / totalListings) * 100);
      setProgress(newProgress);
      setResults([...importResults]);
      setErrors([...importErrors]);

      // Small delay to prevent overwhelming the API
      if (!dryRun) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setIsLoading(false);
    setCurrentOperation('');
    
    const successCount = importResults.filter(r => r.success).length;
    const errorCount = importErrors.length;
    const imagesSuccessCount = importResults.filter(r => r.image_processed).length;
    
    if (dryRun) {
      toast({
        title: "Validation Complete",
        description: `${successCount} listings valid, ${errorCount} errors found. ${imagesSuccessCount} images would be processed.`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
    } else {
      toast({
        title: "Import Complete",
        description: `${successCount} listings imported, ${errorCount} errors. ${imagesProcessed} images processed successfully.`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
    }
  };

  return {
    importListings,
    isLoading,
    progress,
    errors,
    results,
    currentOperation,
    imagesProcessed,
    imagesFailed
  };
}

function validateListing(listing: ParsedListing): string[] {
  const errors: string[] = [];

  if (!listing.title || listing.title.length < 5) {
    errors.push("Title must be at least 5 characters");
  }

  if (!listing.category) {
    errors.push("Category is required");
  }

  if (!listing.location) {
    errors.push("Location is required");
  }

  if (listing.revenue < 0) {
    errors.push("Revenue cannot be negative");
  }

  if (listing.ebitda < 0) {
    errors.push("EBITDA cannot be negative");
  }

  if (!listing.description || listing.description.length < 20) {
    errors.push("Description must be at least 20 characters");
  }

  // Validate image URL if provided
  if (listing.image_url) {
    try {
      new URL(listing.image_url);
    } catch {
      errors.push("Invalid image URL format");
    }
  }

  return errors;
}
