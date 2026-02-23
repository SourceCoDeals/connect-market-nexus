/**
 * BuyerDashboard — Personalized dashboard panel for approved marketplace buyers.
 *
 * Shows:
 * - Profile completeness indicator
 * - Connection request status summary
 * - Quick links to saved listings and messages
 */

import { useAuth } from '@/context/AuthContext';
import { useAllConnectionStatuses } from '@/hooks/marketplace/use-connections';
import { useAllSavedListingIds } from '@/hooks/marketplace/use-saved-listings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  UserCircle,
  Bookmark,
  MessageSquare,
  FileCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

function getProfileCompleteness(user: NonNullable<ReturnType<typeof useAuth>['user']>): {
  percent: number;
  missing: string[];
} {
  const checks: [boolean, string][] = [
    [!!user.first_name, 'First name'],
    [!!user.last_name, 'Last name'],
    [!!user.email, 'Email'],
    [!!user.company, 'Company'],
    [!!user.phone_number, 'Phone number'],
    [!!user.buyer_type, 'Buyer type'],
    [!!user.linkedin_profile, 'LinkedIn profile'],
    [!!user.ideal_target_description, 'Ideal target description'],
    [(user.business_categories?.length ?? 0) > 0, 'Business categories'],
    [(Array.isArray(user.target_locations) ? user.target_locations.length : 0) > 0, 'Target locations'],
  ];

  const filled = checks.filter(([ok]) => ok).length;
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);

  return {
    percent: Math.round((filled / checks.length) * 100),
    missing,
  };
}

export function BuyerDashboard() {
  const { user } = useAuth();
  const { data: connectionMap } = useAllConnectionStatuses();
  const { data: savedIds } = useAllSavedListingIds();

  if (!user) return null;

  const { percent, missing } = getProfileCompleteness(user);
  const savedCount = savedIds?.size ?? 0;

  // Count connection request statuses
  let pendingRequests = 0;
  let approvedRequests = 0;
  let totalRequests = 0;
  if (connectionMap) {
    for (const status of connectionMap.values()) {
      totalRequests++;
      if (status === 'pending') pendingRequests++;
      if (status === 'approved') approvedRequests++;
    }
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Welcome banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Welcome back, {user.first_name || 'there'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Here&apos;s a summary of your marketplace activity.
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Profile completeness */}
        <Card className="border">
          <CardContent className="p-4 flex items-start gap-3">
            <div className={`p-2 rounded-md ${percent === 100 ? 'bg-green-100' : 'bg-amber-100'}`}>
              <UserCircle className={`h-4 w-4 ${percent === 100 ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Profile</p>
              <p className="text-sm font-semibold">{percent}% complete</p>
              {missing.length > 0 && (
                <Link to="/profile" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                  Complete profile <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saved listings */}
        <Card className="border">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-blue-100">
              <Bookmark className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Saved</p>
              <p className="text-sm font-semibold">{savedCount} listing{savedCount !== 1 ? 's' : ''}</p>
              {savedCount > 0 && (
                <Link to="/saved-listings" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                  View saved <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connection requests */}
        <Card className="border">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-purple-100">
              <FileCheck className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">My Deals</p>
              <p className="text-sm font-semibold">{totalRequests} request{totalRequests !== 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs">
                {pendingRequests > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-600">
                    <Clock className="h-3 w-3" /> {pendingRequests} pending
                  </span>
                )}
                {approvedRequests > 0 && (
                  <span className="flex items-center gap-0.5 text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> {approvedRequests} approved
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="border">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-indigo-100">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Messages</p>
              <Link to="/messages" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                View messages <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile completeness alert */}
      {percent < 80 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-amber-800">Complete your profile to get better deal matches</p>
            <p className="text-amber-700 mt-0.5">
              Missing: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? `, and ${missing.length - 3} more` : ''}.{' '}
              <Link to="/profile" className="text-primary hover:underline font-medium">
                Update profile
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
