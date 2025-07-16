
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
  "Financial Services",
  "Real Estate",
  "Construction",
  "Transportation",
  "Education",
  "Energy",
  "Media & Entertainment",
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
      image_url: null,
    };
    
    let description = '';
    let isInDescription = false;
    
    for (const line of lines) {
      // Skip empty lines and common headers
      if (!line || line.toLowerCase().includes('share') || line.includes('____')) {
        continue;
      }
      
      // Check for image URLs
      if (this.isImageUrl(line)) {
        listing.image_url = line;
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
          listing.location = this.standardizeLocation(value);
        } else if (lowerKey.includes('category') || lowerKey.includes('industry')) {
          listing.category = this.mapCategory(value);
        } else if (lowerKey.includes('title') || lowerKey.includes('name')) {
          listing.title = value;
        } else if (lowerKey.includes('image') || lowerKey.includes('photo')) {
          if (this.isImageUrl(value)) {
            listing.image_url = value;
          }
        } else if (lowerKey.includes('tag')) {
          listing.tags = this.parseTags(value);
        } else if (lowerKey.includes('note')) {
          listing.owner_notes = value;
        }
      } else if (listing.title && !isInDescription) {
        // Check if this line might be location or category
        const potentialCategory = this.mapCategory(line);
        const potentialLocation = this.standardizeLocation(line);
        
        if (potentialCategory && potentialCategory !== 'Other' && !listing.category) {
          listing.category = potentialCategory;
        } else if (!listing.location && line.length < 50 && !line.includes('$') && this.isValidLocation(line)) {
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
    
    // Generate tags from description if none provided
    if (!listing.tags || listing.tags.length === 0) {
      listing.tags = this.generateTags(listing.description || '', listing.category || '');
    }
    
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
      image_url: listing.image_url,
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
    } else if (cleaned.toLowerCase().includes('b')) {
      const num = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
      return num * 1000000000;
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
    
    // Partial matches with better logic
    if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('it')) return 'Technology';
    if (normalized.includes('ecommerce') || normalized.includes('e-commerce') || normalized.includes('online')) return 'E-commerce';
    if (normalized.includes('saas') || normalized.includes('software as a service') || normalized.includes('cloud')) return 'SaaS';
    if (normalized.includes('manufacturing') || normalized.includes('industrial') || normalized.includes('factory')) return 'Manufacturing';
    if (normalized.includes('retail') || normalized.includes('store') || normalized.includes('shop')) return 'Retail';
    if (normalized.includes('health') || normalized.includes('medical') || normalized.includes('clinic')) return 'Healthcare';
    if (normalized.includes('food') || normalized.includes('beverage') || normalized.includes('restaurant') || normalized.includes('dining')) return 'Food & Beverage';
    if (normalized.includes('service') || normalized.includes('consulting') || normalized.includes('agency')) return 'Service';
    if (normalized.includes('consumer') || normalized.includes('b2c')) return 'Consumer Services';
    if (normalized.includes('financial') || normalized.includes('finance') || normalized.includes('banking')) return 'Financial Services';
    if (normalized.includes('real estate') || normalized.includes('property') || normalized.includes('realty')) return 'Real Estate';
    if (normalized.includes('construction') || normalized.includes('building') || normalized.includes('contractor')) return 'Construction';
    if (normalized.includes('transport') || normalized.includes('logistics') || normalized.includes('shipping')) return 'Transportation';
    if (normalized.includes('education') || normalized.includes('school') || normalized.includes('training')) return 'Education';
    if (normalized.includes('energy') || normalized.includes('power') || normalized.includes('renewable')) return 'Energy';
    if (normalized.includes('media') || normalized.includes('entertainment') || normalized.includes('content')) return 'Media & Entertainment';
    
    return 'Other';
  }
  
  private standardizeLocation(value: string): string {
    if (!value) return 'Not specified';
    
    // Common location standardizations
    const normalized = value.trim();
    
    // Handle common abbreviations and formats
    const locationMap: { [key: string]: string } = {
      'usa': 'United States',
      'us': 'United States',
      'uk': 'United Kingdom',
      'ny': 'New York',
      'ca': 'California',
      'tx': 'Texas',
      'fl': 'Florida',
      'northeast': 'Northeast US',
      'southeast': 'Southeast US',
      'southwest': 'Southwest US',
      'northwest': 'Northwest US',
      'midwest': 'Midwest US',
      'west coast': 'West Coast US',
      'east coast': 'East Coast US',
    };
    
    const lowerNormalized = normalized.toLowerCase();
    return locationMap[lowerNormalized] || normalized;
  }
  
  private isValidLocation(value: string): boolean {
    // Simple validation for location strings
    const locationPattern = /^[a-zA-Z\s,.-]+$/;
    return locationPattern.test(value) && value.length > 2 && value.length < 100;
  }
  
  private isImageUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url.pathname) || 
             value.includes('images.unsplash.com') ||
             value.includes('image') ||
             value.includes('photo');
    } catch {
      return false;
    }
  }
  
  private parseTags(value: string): string[] {
    return value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
  
  private generateTags(description: string, category: string): string[] {
    const tags: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Add category as a tag
    if (category && category !== 'Other') {
      tags.push(category);
    }
    
    // Common business-related tags
    const tagKeywords = [
      'b2b', 'b2c', 'saas', 'enterprise', 'startup', 'established',
      'profitable', 'growing', 'scalable', 'recurring', 'subscription',
      'digital', 'online', 'mobile', 'platform', 'marketplace',
      'acquisition', 'investment', 'opportunity', 'franchise'
    ];
    
    tagKeywords.forEach(keyword => {
      if (lowerDesc.includes(keyword)) {
        tags.push(keyword.toUpperCase());
      }
    });
    
    return tags.slice(0, 5); // Limit to 5 tags
  }
}
