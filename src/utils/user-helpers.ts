
import { Listing, ListingStatus } from "@/types";

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
      categories: Array.isArray(data.categories) ? data.categories : (data.category ? [data.category] : []),
      category: data.category || (Array.isArray(data.categories) && data.categories.length > 0 ? data.categories[0] : "Other"),
      location: data.location || "Not specified",
      tags: Array.isArray(data.tags) ? data.tags : [],
      owner_notes: data.owner_notes || "",
      files: Array.isArray(data.files) ? data.files : [],
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      status: (data.status as ListingStatus) || "active",
      image_url: data.image_url || null,
      
      // Internal admin fields
      deal_identifier: data.deal_identifier || undefined,
      internal_company_name: data.internal_company_name || undefined,
      internal_primary_owner: data.internal_primary_owner || undefined,
      internal_salesforce_link: data.internal_salesforce_link || undefined,
      internal_deal_memo_link: data.internal_deal_memo_link || undefined,
      internal_contact_info: data.internal_contact_info || undefined,
      internal_notes: data.internal_notes || undefined,
      
      // Computed properties
      get ownerNotes() {
        return this.owner_notes || "";
      },
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
