import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Sparkles,
  CheckCircle,
  XCircle,
  Eye,
  Phone,
  BookOpen,
  Calendar,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityEvent {
  id: string;
  type: "enrichment" | "approval" | "pass" | "outreach" | "transcript" | "learning";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface BuyerActivitySectionProps {
  buyerId: string;
}

type ActivityFilter = "all" | "enrichment" | "approval" | "pass" | "outreach" | "transcript" | "learning";

export function BuyerActivitySection({ buyerId }: BuyerActivitySectionProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadActivities();
  }, [buyerId]);

  const loadActivities = async () => {
    try {
      const activityEvents: ActivityEvent[] = [];

      // Load enrichment history
      const { data: enrichments } = await supabase
        .from("buyer_learning_history")
        .select("*")
        .eq("buyer_id", buyerId)
        .order("learned_at", { ascending: false });

      enrichments?.forEach((enrich) => {
        activityEvents.push({
          id: `enrich-${enrich.id}`,
          type: "enrichment",
          title: "Buyer Enriched",
          description: `Data enriched from ${enrich.source || "unknown source"}`,
          timestamp: enrich.learned_at,
          metadata: enrich,
        });
      });

      // Load deal approvals (selected_for_outreach = true)
      const { data: approvals } = await supabase
        .from("buyer_deal_scores")
        .select(`
          *,
          deal:deals(deal_name)
        `)
        .eq("buyer_id", buyerId)
        .eq("selected_for_outreach", true)
        .order("scored_at", { ascending: false });

      approvals?.forEach((approval: any) => {
        activityEvents.push({
          id: `approval-${approval.id}`,
          type: "approval",
          title: "Approved for Deal",
          description: `Selected for outreach: ${approval.deal?.deal_name || "Unknown deal"}`,
          timestamp: approval.scored_at,
          metadata: approval,
        });
      });

      // Load passes
      const { data: passes } = await supabase
        .from("buyer_deal_scores")
        .select(`
          *,
          deal:deals(deal_name)
        `)
        .eq("buyer_id", buyerId)
        .eq("passed_on_deal", true)
        .order("passed_at", { ascending: false });

      passes?.forEach((pass: any) => {
        activityEvents.push({
          id: `pass-${pass.id}`,
          type: "pass",
          title: "Passed on Deal",
          description: `${pass.pass_category || "Passed"}: ${pass.deal?.deal_name || "Unknown deal"}`,
          timestamp: pass.passed_at || pass.scored_at,
          metadata: pass,
        });
      });

      // Load transcripts/calls
      const { data: transcripts } = await supabase
        .from("call_intelligence")
        .select("*")
        .eq("buyer_id", buyerId)
        .order("call_date", { ascending: false });

      transcripts?.forEach((transcript) => {
        activityEvents.push({
          id: `transcript-${transcript.id}`,
          type: "transcript",
          title: "Call Transcript",
          description: transcript.call_summary || "Call recorded",
          timestamp: transcript.call_date || transcript.created_at,
          metadata: transcript,
        });
      });

      // Sort all activities by timestamp
      activityEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activityEvents);
    } catch (error: any) {
      toast({
        title: "Error loading activity",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((activity) => activity.type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (activity) =>
          activity.title.toLowerCase().includes(query) ||
          activity.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activities, filterType, searchQuery]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "enrichment":
        return <Sparkles className="w-4 h-4" />;
      case "approval":
        return <CheckCircle className="w-4 h-4" />;
      case "pass":
        return <XCircle className="w-4 h-4" />;
      case "outreach":
        return <Eye className="w-4 h-4" />;
      case "transcript":
        return <Phone className="w-4 h-4" />;
      case "learning":
        return <BookOpen className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getActivityBadgeVariant = (type: string) => {
    switch (type) {
      case "enrichment":
        return "default";
      case "approval":
        return "default";
      case "pass":
        return "outline";
      case "outreach":
        return "secondary";
      case "transcript":
        return "secondary";
      case "learning":
        return "outline";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(value) => setFilterType(value as ActivityFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="enrichment">Enrichments</SelectItem>
            <SelectItem value="approval">Approvals</SelectItem>
            <SelectItem value="pass">Passes</SelectItem>
            <SelectItem value="outreach">Outreach</SelectItem>
            <SelectItem value="transcript">Transcripts</SelectItem>
            <SelectItem value="learning">Learning</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Feed */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No activity found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.type === "enrichment"
                      ? "bg-primary/10 text-primary"
                      : activity.type === "approval"
                      ? "bg-green-500/10 text-green-600"
                      : activity.type === "pass"
                      ? "bg-orange-500/10 text-orange-600"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {getActivityIcon(activity.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{activity.title}</h4>
                      <Badge variant={getActivityBadgeVariant(activity.type)}>
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                    })}
                  </div>
                </div>

                {/* Additional metadata based on type */}
                {activity.type === "pass" && activity.metadata?.pass_reason && (
                  <div className="mt-2 text-sm text-muted-foreground border-l-2 pl-3">
                    Reason: {activity.metadata.pass_reason}
                  </div>
                )}
                {activity.type === "enrichment" &&
                  activity.metadata?.fields_learned && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {activity.metadata.fields_learned.map(
                        (field: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        )
                      )}
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
