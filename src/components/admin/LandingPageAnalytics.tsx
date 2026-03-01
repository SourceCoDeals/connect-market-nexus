import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Eye, FormInput, UserPlus } from 'lucide-react';

interface LandingPageAnalyticsProps {
  listingId: string;
}

/**
 * GAP 19: Landing page analytics dashboard card.
 * Shows views, form submissions, and signup conversions for a specific listing's landing page.
 */
export function LandingPageAnalytics({ listingId }: LandingPageAnalyticsProps) {
  // Fetch landing page views from page_views table
  const { data: viewCount } = useQuery({
    queryKey: ['landing-page-views', listingId],
    queryFn: async () => {
      const { count } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('page_path', `/deals/${listingId}`);
      return count || 0;
    },
    staleTime: 60 * 1000,
  });

  // Fetch form submissions from connection_requests
  const { data: formSubmissions } = useQuery({
    queryKey: ['landing-page-submissions', listingId],
    queryFn: async () => {
      const { count } = await supabase
        .from('connection_requests')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('source', 'landing_page');
      return count || 0;
    },
    staleTime: 60 * 1000,
  });

  // Fetch email captures
  const { data: emailCaptures } = useQuery({
    queryKey: ['landing-page-email-captures', listingId],
    queryFn: async () => {
      const { count } = await supabase
        .from('connection_requests')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('source', 'landing_page_email_capture');
      return count || 0;
    },
    staleTime: 60 * 1000,
  });

  const views = viewCount ?? 0;
  const submissions = formSubmissions ?? 0;
  const emails = emailCaptures ?? 0;
  const conversionRate = views > 0 ? ((submissions / views) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Landing Page Performance</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Eye className="w-4 h-4 text-blue-500 mt-0.5" />
          <div>
            <p className="text-lg font-bold tabular-nums">{views.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Page Views</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <FormInput className="w-4 h-4 text-green-500 mt-0.5" />
          <div>
            <p className="text-lg font-bold tabular-nums">{submissions}</p>
            <p className="text-xs text-muted-foreground">Form Submissions</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <UserPlus className="w-4 h-4 text-amber-500 mt-0.5" />
          <div>
            <p className="text-lg font-bold tabular-nums">{emails}</p>
            <p className="text-xs text-muted-foreground">Email Captures</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <BarChart3 className="w-4 h-4 text-purple-500 mt-0.5" />
          <div>
            <p className="text-lg font-bold tabular-nums">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </div>
        </div>
      </div>

      {views === 0 && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          No landing page views yet. Share the URL: <code className="text-primary">/deals/{listingId}</code>
        </p>
      )}
    </div>
  );
}
