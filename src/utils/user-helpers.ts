
import { Listing } from "@/types";

/**
 * Converts raw listing data from Supabase to a Listing object with computed properties
 */
export const createListingFromData = (data: any): Listing => {
  if (!data) {
    throw new Error("Cannot create listing from null data");
  }
  
  try {
    const listing: Listing = {
      id: data.id,
      title: data.title || "Untitled Listing",
      description: data.description || "",
      revenue: Number(data.revenue) || 0,
      ebitda: Number(data.ebitda) || 0,
      category: data.category || "Other",
      location: data.location || "Not specified",
      tags: Array.isArray(data.tags) ? data.tags : [],
      owner_notes: data.owner_notes || "",
      files: Array.isArray(data.files) ? data.files : [],
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      
      // Computed properties
      get multiples() {
        const multiple = this.ebitda !== 0 ? (this.revenue / this.ebitda) : 0;
        return {
          revenue: multiple.toFixed(2),
          value: multiple > 0 ? `${multiple.toFixed(2)}x` : "N/A"
        };
      },
      get revenueFormatted() {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(this.revenue);
      },
      get ebitdaFormatted() {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(this.ebitda);
      },
      get createdAt() {
        // Return the ISO string rather than a Date object
        return this.created_at;
      },
      get updatedAt() {
        // Return the ISO string rather than a Date object
        return this.updated_at;
      }
    };
    
    return listing;
  } catch (err) {
    console.error("Error creating listing from data:", err, data);
    throw err;
  }
};
