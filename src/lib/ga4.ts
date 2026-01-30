/**
 * Google Analytics 4 Integration
 * 
 * Provides type-safe helpers for tracking events with GA4.
 * Configured for cross-domain tracking between sourcecodeals.com and marketplace.sourcecodeals.com
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// GA4 Measurement ID for SourceCo
export const GA4_MEASUREMENT_ID = 'G-N5T31YT52K';

/**
 * Track a custom GA4 event
 */
export function trackGA4Event(
  eventName: string,
  params: Record<string, any> = {}
): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

/**
 * Track a page view in GA4
 */
export function trackGA4PageView(path: string, title: string): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
      page_location: window.location.href,
    });
  }
}

/**
 * Set the user ID for cross-session tracking
 */
export function setGA4UserId(userId: string | null): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function' && userId) {
    window.gtag('set', 'user_id', userId);
    window.gtag('set', 'user_properties', {
      user_id: userId,
    });
  }
}

/**
 * Track user sign up event
 */
export function trackGA4SignUp(method: string = 'email'): void {
  trackGA4Event('sign_up', { method });
}

/**
 * Track user login event
 */
export function trackGA4Login(method: string = 'email'): void {
  trackGA4Event('login', { method });
}

/**
 * Track search event
 */
export function trackGA4Search(searchTerm: string, resultsCount: number): void {
  trackGA4Event('search', {
    search_term: searchTerm,
    results_count: resultsCount,
  });
}

/**
 * Track content view (listing view)
 */
export function trackGA4ViewItem(
  itemId: string,
  itemName: string,
  category?: string,
  value?: number
): void {
  trackGA4Event('view_item', {
    items: [{
      item_id: itemId,
      item_name: itemName,
      item_category: category,
      price: value,
    }],
  });
}

/**
 * Track add to wishlist (save listing)
 */
export function trackGA4AddToWishlist(
  itemId: string,
  itemName: string,
  category?: string
): void {
  trackGA4Event('add_to_wishlist', {
    items: [{
      item_id: itemId,
      item_name: itemName,
      item_category: category,
    }],
  });
}

/**
 * Track form submission (connection request)
 */
export function trackGA4GenerateLead(listingId: string, listingName: string): void {
  trackGA4Event('generate_lead', {
    listing_id: listingId,
    listing_name: listingName,
    currency: 'USD',
  });
}

/**
 * Track scroll depth
 */
export function trackGA4ScrollDepth(percent: number, pagePath: string): void {
  if (percent >= 25 && percent < 50) {
    trackGA4Event('scroll_25', { page_path: pagePath });
  } else if (percent >= 50 && percent < 75) {
    trackGA4Event('scroll_50', { page_path: pagePath });
  } else if (percent >= 75 && percent < 90) {
    trackGA4Event('scroll_75', { page_path: pagePath });
  } else if (percent >= 90) {
    trackGA4Event('scroll_90', { page_path: pagePath });
  }
}

/**
 * Track time on page
 */
export function trackGA4TimeOnPage(seconds: number, pagePath: string): void {
  trackGA4Event('time_on_page', {
    page_path: pagePath,
    engagement_time_msec: seconds * 1000,
  });
}

/**
 * Track outbound link click
 */
export function trackGA4OutboundClick(url: string, linkText?: string): void {
  trackGA4Event('click', {
    outbound: true,
    link_url: url,
    link_text: linkText,
  });
}

/**
 * Track conversion event (useful for Google Ads)
 */
export function trackGA4Conversion(
  conversionType: 'signup' | 'connection_request' | 'nda_signed' | 'fee_agreement',
  value?: number
): void {
  trackGA4Event('conversion', {
    conversion_type: conversionType,
    value: value,
    currency: 'USD',
  });
}

/**
 * Initialize GA4 with cross-domain tracking
 * This should be called once when the app loads
 */
export function initGA4(measurementId: string = GA4_MEASUREMENT_ID): void {
  if (typeof window === 'undefined') return;
  
  // Don't initialize if already present or in development without explicit flag
  if (measurementId === 'G-XXXXXXXXXX') {
    console.log('[GA4] Skipping initialization - no measurement ID configured');
    return;
  }

  // Check if gtag is already loaded
  if (typeof window.gtag === 'function') {
    console.log('[GA4] Already initialized');
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Define gtag function
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    // Enable cross-domain tracking for your domains
    linker: {
      domains: ['sourcecodeals.com', 'marketplace.sourcecodeals.com', 'market.sourcecodeals.com'],
      accept_incoming: true,
    },
    // Enhanced measurement features
    send_page_view: false, // We'll send page views manually for SPA
    cookie_domain: '.sourcecodeals.com', // Share cookies across subdomains
  });

  console.log(`[GA4] Initialized with measurement ID: ${measurementId}`);
}
