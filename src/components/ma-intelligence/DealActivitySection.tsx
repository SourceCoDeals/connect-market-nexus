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
  TrendingUp,
  Mail,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityEvent {
  id: string;
  type: "scoring" | "enrichment" | "buyer_action" | "transcript" | "outreach";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface DealActivitySectionProps {
  dealId: string;
}

type ActivityFilter =
  | "all"
  | "scoring"
  | "enrichment"
  | "buyer_action"
  | "transcript"
  | "outreach";

export function DealActivitySection({ dealId }: DealActivitySectionProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadActivities();
  }, [dealId]);

  const loadActivities = async () => {
    try {
      const activityEvents: ActivityEvent[] = [];

      // Load enrichment history (if there's a table for it)
      // For now, we'll create activities from related tables

      // Load buyer approvals (selected_for_outreach = true)
      const { data: approvals } = await supabase
        .from("buyer_deal_scores")
        .select(`
          *,
          buyer:remarketing_buyers!buyer_id(pe_firm_name, platform_company_name)
        `)
        .eq("deal_id", dealId)
        .eq("selected_for_outreach", true)
        .order("scored_at", { ascending: false });

      approvals?.forEach((approval: any) => {
        activityEvents.push({
          id: `approval-${approval.id}`,
          type: "buyer_action",
          title: "Buyer Approved",
          description: `${
            approval.buyer?.platform_company_name || approval.buyer?.pe_firm_name
          } approved for outreach`,
          timestamp: approval.scored_at,
          metadata: approval,
        });
      });

      // Load buyer passes
      const { data: passes } = await supabase
        .from("buyer_deal_scores")
        .select(`
          *,
          buyer:remarketing_buyers!buyer_id(pe_firm_name, platform_company_name)
        `)
        .eq("deal_id", dealId)
        .eq("passed_on_deal", true)
        .order("passed_at", { ascending: false });

      passes?.forEach((pass: any) => {
        activityEvents.push({
          id: `pass-${pass.id}`,
          type: "buyer_action",
          title: "Buyer Passed",
          description: `${
            pass.buyer?.platform_company_name || pass.buyer?.pe_firm_name
          } passed: ${pass.pass_category || "No reason"}`,
          timestamp: pass.passed_at || pass.scored_at,
          metadata: pass,
        });
      });

      // Load scoring events
      const { data: scorings } = await supabase
        .from("buyer_deal_scores")
        .select(`
          *,
          buyer:remarketing_buyers!buyer_id(pe_firm_name, platform_company_name)
        `)
        .eq("deal_id", dealId)
        .not("composite_score", "is", null)
        .order("scored_at", { ascending: false })
        .limit(20);

      scorings?.forEach((scoring: any) => {
        activityEvents.push({
          id: `score-${scoring.id}`,
          type: "scoring",
          title: "Buyer Scored",
          description: `${
            scoring.buyer?.platform_company_name || scoring.buyer?.pe_firm_name
          } scored ${scoring.composite_score}`,
          timestamp: scoring.scored_at,
          metadata: scoring,
        });
      });

      // Load transcripts - use listing_id per actual schema
      const { data: transcripts } = await supabase
        .from("deal_transcripts")
        .select("*")
        .eq("listing_id", dealId)
        .order("created_at", { ascending: false });

      transcripts?.forEach((transcript) => {
        activityEvents.push({
          id: `transcript-${transcript.id}`,
          type: "transcript",
          title: "Transcript Added",
          description: transcript.title || "Call transcript added",
          timestamp: transcript.created_at,
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
      case "scoring":
        return <TrendingUp className="w-4 h-4" />;
      case "enrichment":
        return <Sparkles className="w-4 h-4" />;
      case "buyer_action":
        return <CheckCircle className="w-4 h-4" />;
      case "outreach":
        return <Mail className="w-4 h-4" />;
      case "transcript":
        return <Phone className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getActivityBadgeVariant = (type: string) => {
    switch (type) {
      case "scoring":
        return "default";
      case "enrichment":
        return "default";
      case "buyer_action":
        return "secondary";
      case "outreach":
        return "secondary";
      case "transcript":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "scoring":
        return "bg-blue-500/10 text-blue-600";
      case "enrichment":
        return "bg-primary/10 text-primary";
      case "buyer_action":
        return "bg-green-500/10 text-green-600";
      case "outreach":
        return "bg-purple-500/10 text-purple-600";
      case "transcript":
        return "bg-orange-500/10 text-orange-600";
      default:
        return "bg-secondary text-secondary-foreground";
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
            <SelectItem value="scoring">Scoring</SelectItem>
            <SelectItem value="enrichment">Enrichment</SelectItem>
            <SelectItem value="buyer_action">Buyer Actions</SelectItem>
            <SelectItem value="transcript">Transcripts</SelectItem>
            <SelectItem value="outreach">Outreach</SelectItem>
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(
                    activity.type
                  )}`}
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
                        {activity.type.replace("_", " ")}
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
                {activity.type === "buyer_action" &&
                  activity.metadata?.pass_reason && (
                    <div className="mt-2 text-sm text-muted-foreground border-l-2 pl-3">
                      Reason: {activity.metadata.pass_reason}
                    </div>
                  )}
                {activity.type === "scoring" && activity.metadata && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activity.metadata.geography_score !== null && (
                      <Badge variant="outline" className="text-xs">
                        Geo: {activity.metadata.geography_score}
                      </Badge>
                    )}
                    {activity.metadata.service_score !== null && (
                      <Badge variant="outline" className="text-xs">
                        Service: {activity.metadata.service_score}
                      </Badge>
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
