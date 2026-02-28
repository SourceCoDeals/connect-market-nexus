/**
 * Personalized buyer dashboard panel shown above marketplace listings.
 *
 * Shows: profile completeness % with field-level breakdown, live deal match count,
 * saved listings count, connection request status, messages link.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Bookmark, MessageSquare, User as UserIcon, ArrowRight, Target } from 'lucide-react';
import { useAllSavedListingIds } from '@/hooks/marketplace/use-saved-listings';
import { useUnreadBuyerMessageCounts } from '@/hooks/use-connection-messages';
import { useSimpleListings } from '@/hooks/use-simple-listings';
import { getProfileCompletionDetails } from '@/lib/buyer-metrics';
import type { User, Listing } from '@/types';

/** Field-level importance descriptions */
const FIELD_IMPORTANCE: Record<string, string> = {
  business_categories: 'helps match you to relevant deals',
  target_locations: 'surfaces deals in your target geography',
  revenue_range_min: 'filters deals to your revenue range',
  revenue_range_max: 'filters deals to your revenue range',
  ebitda_min: 'narrows deals to your EBITDA target',
  ebitda_max: 'narrows deals to your EBITDA target',
  ideal_target_description: 'strengthens your buyer presentation',
  deal_intent: 'matches platform vs add-on opportunities',
  company: 'helps sellers understand your background',
  linkedin_profile: 'builds credibility with sellers',
  bio: 'personalises your buyer story',
};

function countMatchingListings(user: User, listings: Listing[]): number {
  const categories = Array.isArray(user.business_categories) ? user.business_categories : [];
  const locations = Array.isArray(user.target_locations)
    ? user.target_locations
    : user.target_locations
      ? [user.target_locations]
      : [];

  if (categories.length === 0 && locations.length === 0) return 0;

  return listings.filter((listing) => {
    const catMatch =
      categories.length === 0 ||
      categories.some((c) => listing.category?.toLowerCase() === c.toLowerCase());
    const locMatch =
      locations.length === 0 ||
      locations.some((loc) => listing.location?.toLowerCase().includes(loc.toLowerCase()));
    return catMatch || locMatch;
  }).length;
}

export function BuyerDashboard() {
  const { user } = useAuth();
  const { data: savedIds } = useAllSavedListingIds();
  const { data: unreadMessages } = useUnreadBuyerMessageCounts();
  const { data: listingsData } = useSimpleListings({
    page: 1,
    perPage: 50,
    search: '',
    category: '',
    location: '',
    revenueMin: undefined,
    revenueMax: undefined,
    ebitdaMin: undefined,
    ebitdaMax: undefined,
  });

  const profileDetails = useMemo(() => {
    if (!user) return null;
    return getProfileCompletionDetails(user);
  }, [user]);

  const matchingCount = useMemo(() => {
    if (!user || !listingsData?.listings) return 0;
    return countMatchingListings(user, listingsData.listings);
  }, [user, listingsData?.listings]);

  if (!user) return null;

  const completeness = profileDetails?.percentage ?? 0;
  const savedCount = savedIds?.size ?? 0;
  const unreadCount = unreadMessages?.total ?? 0;

  // Get top 3 missing fields with explanations
  const missingFieldsWithReasons = (profileDetails?.missingFields ?? [])
    .slice(0, 3)
    .map((field) => ({
      field,
      label:
        profileDetails?.missingFieldLabels[profileDetails.missingFields.indexOf(field)] ?? field,
      reason: FIELD_IMPORTANCE[field] || 'improves your profile',
    }));

  return (
    <div className="space-y-3">
      <Card className="border-slate-200 bg-white/80 backdrop-blur-sm">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-center gap-6">
            {/* Profile completeness */}
            <div className="flex items-center gap-3 min-w-[180px]">
              <UserIcon className="h-4 w-4 text-slate-500 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Profile</span>
                  <span className="text-xs font-semibold text-slate-900">{completeness}%</span>
                </div>
                <Progress value={completeness} className="h-1.5" />
              </div>
            </div>

            {/* Live deal match count */}
            <Link
              to="/marketplace"
              className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Target className="h-4 w-4" />
              <span>
                <strong className="text-slate-900">{matchingCount}</strong> deals match
              </span>
            </Link>

            {/* Saved listings */}
            <Link
              to="/saved-listings"
              className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Bookmark className="h-4 w-4" />
              <span>
                <strong className="text-slate-900">{savedCount}</strong> saved
              </span>
            </Link>

            {/* Messages */}
            <Link
              to="/messages"
              className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>
                Messages
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
            </Link>

            {/* Profile link */}
            <Link to="/profile" className="ml-auto">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                Edit Profile <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Profile completeness breakdown with field-level detail */}
      {completeness < 80 && missingFieldsWithReasons.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-medium text-amber-900 mb-2">
              Complete your profile to improve deal matches ({completeness}% complete)
            </p>
            <ul className="space-y-1">
              {missingFieldsWithReasons.map(({ field, label, reason }) => (
                <li key={field} className="flex items-start gap-2 text-xs text-amber-800">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>
                    <Link to="/welcome" className="font-medium underline hover:text-amber-900">
                      {label}
                    </Link>
                    {' — '}
                    {reason}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
