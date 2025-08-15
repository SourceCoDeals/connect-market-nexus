// Centralized Query Key Management
// This ensures consistent cache keys across the entire application

export const QUERY_KEYS = {
  // Auth & User related
  auth: ['auth'] as const,
  user: (userId?: string) => ['user', userId] as const,
  userProfile: (userId?: string) => ['user-profile', userId] as const,
  
  // Listings related
  listings: ['listings'] as const,
  listing: (listingId?: string) => ['listing', listingId] as const,
  
  // Saved listings - normalized keys
  savedListings: (filters?: any) => ['saved-listings', filters] as const,
  savedStatus: (listingId?: string) => ['saved-status', listingId] as const,
  
  // Connection requests - normalized keys  
  connectionRequests: ['connection-requests'] as const,
  connectionStatus: (listingId?: string) => ['connection-status', listingId] as const,
  userConnectionRequests: ['user-connection-requests'] as const,
  
  // Admin specific keys
  admin: {
    connectionRequests: ['admin', 'connection-requests'] as const,
    users: ['admin', 'users'] as const,
    listings: ['admin', 'listings'] as const,
    userSavedListings: (userId?: string) => ['admin', 'user-saved-listings', userId] as const,
    listingSavedBy: (listingId?: string) => ['admin', 'listing-saved-by', listingId] as const,
  },
  
  // Analytics
  analytics: {
    health: ['analytics', 'health'] as const,
    marketplace: (days?: number) => ['analytics', 'marketplace', days] as const,
    feedback: (days?: number) => ['analytics', 'feedback', days] as const,
  },
} as const;

// Cache invalidation patterns - organized by feature
export const INVALIDATION_PATTERNS = {
  // Invalidate all saved listings related queries
  savedListings: () => [
    { queryKey: QUERY_KEYS.savedListings() },
    { queryKey: ['saved-listings'] }, // Legacy support
    { queryKey: ['saved-status'] }, // Legacy support
  ],
  
  // Invalidate all connection requests related queries
  connectionRequests: () => [
    { queryKey: QUERY_KEYS.connectionRequests },
    { queryKey: QUERY_KEYS.userConnectionRequests },
    { queryKey: QUERY_KEYS.admin.connectionRequests },
    { queryKey: ['connection-status'] }, // Legacy support
    { queryKey: ['user-connection-requests'] }, // Legacy support
    { queryKey: ['admin-connection-requests'] }, // Legacy support
  ],
  
  // Invalidate user-specific data
  userProfile: (userId?: string) => [
    { queryKey: QUERY_KEYS.userProfile(userId) },
    { queryKey: QUERY_KEYS.admin.users },
  ],
} as const;

// Helper function for safe query key generation
export const createQueryKey = {
  savedListings: (filters?: any) => QUERY_KEYS.savedListings(filters),
  savedStatus: (listingId?: string) => QUERY_KEYS.savedStatus(listingId),
  connectionStatus: (listingId?: string) => QUERY_KEYS.connectionStatus(listingId),
  userConnectionRequests: (userId?: string) => ['user-connection-requests', userId].filter(Boolean),
  adminConnectionRequests: () => QUERY_KEYS.admin.connectionRequests,
} as const;