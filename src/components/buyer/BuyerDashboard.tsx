/**
 * Personalized buyer dashboard panel shown above marketplace listings.
 *
 * Shows: profile completeness %, saved listings count, connection request
 * status, messages link, and a profile completeness alert below 80%.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Bookmark, MessageSquare, User as UserIcon, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAllSavedListingIds } from '@/hooks/marketplace/use-saved-listings';
import { useUnreadBuyerMessageCounts } from '@/hooks/use-connection-messages';

/** Fields we consider for "profile completeness". */
const PROFILE_FIELDS = [
  'first_name', 'last_name', 'email', 'company', 'phone_number',
  'buyer_type', 'ideal_target_description', 'business_categories',
  'target_locations', 'revenue_range_min', 'revenue_range_max',
  'linkedin_profile', 'bio',
] as const;

function computeCompleteness(user: Record<string, unknown>): number {
  let filled = 0;
  for (const field of PROFILE_FIELDS) {
    const val = user[field];
    if (val && (typeof val !== 'string' || val.trim() !== '')) {
      if (Array.isArray(val) && val.length === 0) continue;
      filled++;
    }
  }
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

export function BuyerDashboard() {
  const { user } = useAuth();
  const { data: savedIds } = useAllSavedListingIds();
  const { data: unreadMessages } = useUnreadBuyerMessageCounts();

  if (!user) return null;

  const completeness = computeCompleteness(user as unknown as Record<string, unknown>);
  const savedCount = savedIds?.length ?? 0;
  const unreadCount = unreadMessages?.total ?? 0;

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

            {/* Saved listings */}
            <Link to="/saved-listings" className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors">
              <Bookmark className="h-4 w-4" />
              <span><strong className="text-slate-900">{savedCount}</strong> saved</span>
            </Link>

            {/* Messages */}
            <Link to="/messages" className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors">
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

      {/* Profile completeness alert */}
      {completeness < 80 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Your profile is {completeness}% complete. <Link to="/profile" className="font-medium underline">Complete it</Link> to improve deal matches.
          </span>
        </div>
      )}
    </div>
  );
}
