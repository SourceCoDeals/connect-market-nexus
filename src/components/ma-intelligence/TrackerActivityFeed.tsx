import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  FileText,
  Sparkles,
  BarChart3,
  Settings,
  Archive,
  Plus,
  Edit,
  Trash2,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrackerActivityFeedProps {
  trackerId: string;
}

interface ActivityItem {
  id: string;
  type: 'buyer_added' | 'buyer_enriched' | 'buyer_deleted' | 'deal_added' | 'deal_enriched' | 'deal_scored' | 'criteria_updated' | 'tracker_archived' | 'tracker_restored';
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
  created_by?: string;
  entity_id?: string;
  entity_name?: string;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'buyer_added':
      return <Plus className="w-4 h-4 text-green-500" />;
    case 'buyer_enriched':
      return <Sparkles className="w-4 h-4 text-blue-500" />;
    case 'buyer_deleted':
      return <Trash2 className="w-4 h-4 text-red-500" />;
    case 'deal_added':
      return <Plus className="w-4 h-4 text-green-500" />;
    case 'deal_enriched':
      return <Sparkles className="w-4 h-4 text-blue-500" />;
    case 'deal_scored':
      return <BarChart3 className="w-4 h-4 text-purple-500" />;
    case 'criteria_updated':
      return <Edit className="w-4 h-4 text-orange-500" />;
    case 'tracker_archived':
      return <Archive className="w-4 h-4 text-gray-500" />;
    case 'tracker_restored':
      return <Archive className="w-4 h-4 text-green-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getActivityTypeLabel = (type: string): string => {
  switch (type) {
    case 'buyer_added':
      return 'Buyer Added';
    case 'buyer_enriched':
      return 'Buyer Enriched';
    case 'buyer_deleted':
      return 'Buyer Deleted';
    case 'deal_added':
      return 'Deal Added';
    case 'deal_enriched':
      return 'Deal Enriched';
    case 'deal_scored':
      return 'Deal Scored';
    case 'criteria_updated':
      return 'Criteria Updated';
    case 'tracker_archived':
      return 'Tracker Archived';
    case 'tracker_restored':
      return 'Tracker Restored';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
};

export function TrackerActivityFeed({ trackerId }: TrackerActivityFeedProps) {
  // Fetch activity from audit logs or activity table
  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['tracker-activity', trackerId],
    queryFn: async () => {
      // Try to fetch from activity logs table if it exists
      const { data, error } = await supabase
        .from('tracker_activity_logs')
        .select('*')
        .eq('tracker_id', trackerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && !error.message.includes('does not exist')) {
        throw error;
      }

      // If table doesn't exist or no data, create mock activity from recent changes
      if (!data || data.length === 0) {
        return await fetchMockActivity(trackerId);
      }

      return data as ActivityItem[];
    },
    enabled: !!trackerId,
  });

  // Fallback: Create activity from recent buyer/deal changes
  async function fetchMockActivity(trackerId: string): Promise<ActivityItem[]> {
    const mockActivities: ActivityItem[] = [];

    try {
      // Fetch recent buyers
      const { data: buyers } = await supabase
        .from('buyers')
        .select('id, pe_firm_name, created_at, data_last_updated')
        .eq('tracker_id', trackerId)
        .order('created_at', { ascending: false })
        .limit(10);

      buyers?.forEach((buyer) => {
        mockActivities.push({
          id: `buyer-${buyer.id}`,
          type: 'buyer_added',
          description: `Added buyer: ${buyer.pe_firm_name}`,
          created_at: buyer.created_at,
          entity_id: buyer.id,
          entity_name: buyer.pe_firm_name,
        });

        if (buyer.data_last_updated && buyer.data_last_updated !== buyer.created_at) {
          mockActivities.push({
            id: `buyer-enriched-${buyer.id}`,
            type: 'buyer_enriched',
            description: `Enriched buyer: ${buyer.pe_firm_name}`,
            created_at: buyer.data_last_updated,
            entity_id: buyer.id,
            entity_name: buyer.pe_firm_name,
          });
        }
      });

      // Fetch recent deals
      const { data: deals } = await supabase
        .from('deals')
        .select('id, deal_name, created_at, last_enriched_at')
        .eq('tracker_id', trackerId)
        .order('created_at', { ascending: false })
        .limit(10);

      deals?.forEach((deal) => {
        mockActivities.push({
          id: `deal-${deal.id}`,
          type: 'deal_added',
          description: `Added deal: ${deal.deal_name}`,
          created_at: deal.created_at,
          entity_id: deal.id,
          entity_name: deal.deal_name,
        });

        if (deal.last_enriched_at) {
          mockActivities.push({
            id: `deal-enriched-${deal.id}`,
            type: 'deal_enriched',
            description: `Enriched deal: ${deal.deal_name}`,
            created_at: deal.last_enriched_at,
            entity_id: deal.id,
            entity_name: deal.deal_name,
          });
        }
      });
    } catch (error) {
      console.error('Error fetching mock activity:', error);
    }

    // Sort by date descending
    return mockActivities.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 50);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Loading activity feed...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Recent updates and changes to this buyer universe
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4" />
            <p>No recent activity</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 pb-4 border-b border-border/40 last:border-0"
                >
                  <div className="mt-1 flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getActivityTypeLabel(activity.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{activity.description}</p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
