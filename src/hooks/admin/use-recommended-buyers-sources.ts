/**
 * Data source fetching helpers for Recommended Buyers
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch marketplace buyers who submitted connection requests for this listing.
 * Returns remarketing_buyer_ids for buyers that have a linked profile.
 */
export async function fetchMarketplaceBuyers(listingId: string, excludeIds: Set<string>) {
  // Get connection requests with user profiles that have a remarketing_buyer_id
  const { data: connections } = await supabase
    .from('connection_requests')
    .select('user_id, lead_company, lead_name, lead_email, status, updated_at, created_at')
    .eq('listing_id', listingId)
    .in('status', ['approved', 'converted', 'pending', 'followed_up']);

  if (!connections || connections.length === 0) return [];

  // Get profiles for these users to find remarketing_buyer_id links
  const userIds = connections.map((c) => c.user_id).filter((id): id is string => !!id);

  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, remarketing_buyer_id, company_name, buyer_type, buyer_quality_score, first_name, last_name',
    )
    .in('id', userIds);

  if (!profiles) return [];

  // Collect remarketing_buyer_ids that aren't already scored
  const buyerIds: string[] = [];
  const profileMap = new Map<string, (typeof profiles)[0]>();

  for (const profile of profiles) {
    if (profile.remarketing_buyer_id && !excludeIds.has(profile.remarketing_buyer_id)) {
      buyerIds.push(profile.remarketing_buyer_id);
      profileMap.set(profile.remarketing_buyer_id, profile);
    }
  }

  return { buyerIds, profileMap, connections };
}

/**
 * Fetch buyers from pipeline deals (deals table) for this listing.
 */
export async function fetchPipelineBuyers(listingId: string, excludeIds: Set<string>) {
  const { data: deals } = await supabase
    .from('deals')
    .select('remarketing_buyer_id')
    .eq('listing_id', listingId)
    .not('remarketing_buyer_id', 'is', null);

  if (!deals) return [];

  return deals.map((d) => d.remarketing_buyer_id as string).filter((id) => !excludeIds.has(id));
}

/**
 * Fetch buyers from contacts table linked to this listing.
 */
export async function fetchContactBuyers(listingId: string, excludeIds: Set<string>) {
  const { data: contacts } = await supabase
    .from('contacts')
    .select('remarketing_buyer_id')
    .eq('listing_id', listingId)
    .not('remarketing_buyer_id', 'is', null);

  if (!contacts) return [];

  return contacts.map((c) => c.remarketing_buyer_id as string).filter((id) => !excludeIds.has(id));
}
