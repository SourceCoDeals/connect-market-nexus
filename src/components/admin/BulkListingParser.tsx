
import { ParsedListing } from "@/types/bulk-listing";

const categories = [
  "Technology",
  "E-commerce", 
  "SaaS",
  "Manufacturing",
  "Retail",
  "Healthcare",
  "Food & Beverage",
  "Service",
  "Consumer Services",
  "Other",
] as const;

export class BulkListingParser {
  parseRawData(rawData: string): ParsedListing[] {
    const listings: ParsedListing[] = [];
    
    // Split by common dividers
    const sections = rawData.split(/_{4,}|\n\n\n|\n---\n/).filter(section => section.trim());
    
    for (const section of sections) {
      try {
        const parsed = this.parseSection(section.trim());
        if (parsed) {
          listings.push(parsed);
        }
      } catch (error) {
        console.warn("Failed to parse section:", section, error);
      }
    }
    
    return listings;
  }

  private parseSection(section: string): ParsedListing | null {
    const lines = section.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 3) return null;
    
    const listing: Partial<ParsedListing> = {
      status: 'active',
      tags: [],
      owner_notes: '',
    };
    
    let description = '';
    let isInDescription = false;
    
    for (const line of lines) {
      // Skip empty lines and common headers
      if (!line || line.toLowerCase().includes('share') || line.includes('____')) {
        continue;
      }
      
      // Extract title (usually first meaningful line)
      if (!listing.title && !line.includes(':') && !line.includes('$') && line.length > 10) {
        listing.title = line;
        continue;
      }
      
      // Extract structured data
      if (line.includes(':')) {
        const [key, value] = line.split(':').map(s => s.trim());
        const lowerKey = key.toLowerCase();
        
        if (lowerKey.includes('revenue') || lowerKey.includes('gross')) {
          listing.revenue = this.parseNumber(value);
        } else if (lowerKey.includes('ebitda')) {
          listing.ebitda = this.parseNumber(value);
        } else if (lowerKey.includes('location')) {
          listing.location = value;
        } else if (lowerKey.includes('category')) {
          listing.category = this.mapCategory(value);
        } else if (lowerKey.includes('title')) {
          listing.title = value;
        }
      } else if (listing.title && !isInDescription) {
        // Check if this line might be location or category
        const potentialCategory = this.mapCategory(line);
        const potentialLocation = line;
        
        if (potentialCategory && potentialCategory !== 'Other' && !listing.category) {
          listing.category = potentialCategory;
        } else if (!listing.location && line.length < 50 && !line.includes('$')) {
          listing.location = potentialLocation;
        } else {
          // Start of description
          isInDescription = true;
          description = line;
        }
      } else if (isInDescription) {
        description += ' ' + line;
      }
    }
    
    // Set description
    if (description) {
      listing.description = description;
    }
    
    // Apply defaults and validation
    if (!listing.title) return null;
    
    return {
      title: listing.title,
      category: listing.category || 'Other',
      location: listing.location || 'Not specified',
      revenue: listing.revenue || 0,
      ebitda: listing.ebitda || 0,
      description: listing.description || 'No description provided',
      owner_notes: listing.owner_notes || '',
      status: 'active',
      tags: listing.tags || [],
    };
  }
  
  private parseNumber(value: string): number {
    if (!value) return 0;
    
    // Remove currency symbols and clean up
    const cleaned = value.replace(/[$,\s]/g, '');
    
    // Handle millions/thousands notation
    if (cleaned.toLowerCase().includes('m')) {
      const num = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
      return num * 1000000;
    } else if (cleaned.toLowerCase().includes('k')) {
      const num = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
      return num * 1000;
    }
    
    return parseFloat(cleaned.replace(/[^0-9.]/g, '')) || 0;
  }
  
  private mapCategory(value: string): string {
    if (!value) return 'Other';
    
    const normalized = value.toLowerCase().trim();
    
    // Direct matches
    for (const category of categories) {
      if (normalized === category.toLowerCase()) {
        return category;
      }
    }
    
    // Partial matches
    if (normalized.includes('tech') || normalized.includes('software')) return 'Technology';
    if (normalized.includes('ecommerce') || normalized.includes('e-commerce')) return 'E-commerce';
    if (normalized.includes('saas') || normalized.includes('software as a service')) return 'SaaS';
    if (normalized.includes('manufacturing') || normalized.includes('industrial')) return 'Manufacturing';
    if (normalized.includes('retail') || normalized.includes('store')) return 'Retail';
    if (normalized.includes('health') || normalized.includes('medical')) return 'Healthcare';
    if (normalized.includes('food') || normalized.includes('beverage') || normalized.includes('restaurant')) return 'Food & Beverage';
    if (normalized.includes('service') || normalized.includes('consulting')) return 'Service';
    if (normalized.includes('consumer')) return 'Consumer Services';
    
    return 'Other';
  }
}
