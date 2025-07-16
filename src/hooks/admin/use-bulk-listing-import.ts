
import { useState } from "react";
import { useCreateListing } from "./listings/use-create-listing";
import { ParsedListing, BulkImportResult } from "@/types/bulk-listing";
import { toast } from "@/hooks/use-toast";

export function useBulkListingImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<BulkImportResult[]>([]);
  
  const createListing = useCreateListing();

  const importListings = async (listings: ParsedListing[], dryRun = false) => {
    setIsLoading(true);
    setProgress(0);
    setErrors([]);
    setResults([]);

    const totalListings = listings.length;
    const importResults: BulkImportResult[] = [];
    const importErrors: string[] = [];

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      
      try {
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

        if (!dryRun) {
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
            }
          });

          importResults.push({
            success: true,
            id: result.id,
            title: listing.title
          });
        } else {
          // Dry run - just validate
          importResults.push({
            success: true,
            title: listing.title
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
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setIsLoading(false);
    
    const successCount = importResults.filter(r => r.success).length;
    const errorCount = importErrors.length;
    
    if (dryRun) {
      toast({
        title: "Validation Complete",
        description: `${successCount} listings valid, ${errorCount} errors found`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
    } else {
      toast({
        title: "Import Complete",
        description: `${successCount} listings imported, ${errorCount} errors`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
    }
  };

  return {
    importListings,
    isLoading,
    progress,
    errors,
    results
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

  return errors;
}
