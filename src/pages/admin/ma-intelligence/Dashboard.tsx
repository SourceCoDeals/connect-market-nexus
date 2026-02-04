import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/ma-intelligence/StatCard";
import { IntelligenceCoverageBar } from "@/components/ma-intelligence/IntelligenceBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  FileText,
  Users,
  Brain,
  Plus,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface TrackerWithStats {
  id: string;
  industry_name: string;
  buyer_count: number;
  deal_count: number;
  enriched_count: number;    // Buyers with website enrichment (contributes up to 50%)
  transcript_count: number;  // Buyers with transcripts (contributes up to 50%)
}

export default function MADashboard() {
  const [trackers, setTrackers] = useState<TrackerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ buyers: 0, deals: 0, scores: 0 });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: trackersData, error: trackersError } = await (supabase as any)
        .from("industry_trackers")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (trackersError) throw trackersError;

      const trackersWithStats: TrackerWithStats[] = await Promise.all(
        (trackersData || []).map(async (tracker: any) => {
          const [buyersResult, dealsResult, transcriptsResult] = await Promise.all([
            supabase.from("remarketing_buyers").select("id, data_completeness").eq("industry_tracker_id", tracker.id),
            supabase.from("deals").select("id").eq("listing_id", tracker.id),
            supabase.from("buyer_transcripts").select("buyer_id"),
          ]);

          const buyers = (buyersResult.data || []) as any[];
          const transcripts = transcriptsResult.data || [];
          const buyerIdsWithTranscripts = new Set(transcripts.map((t: any) => t.buyer_id));
          
          // Count enriched buyers (high or medium data_completeness)
          const enrichedCount = buyers.filter(b => 
            b.data_completeness === 'high' || b.data_completeness === 'medium'
          ).length;
          
          // Count buyers with transcripts
          const transcriptCount = buyers.filter(b => buyerIdsWithTranscripts.has(b.id)).length;

          return {
            id: tracker.id,
            industry_name: tracker.name || tracker.industry_name || 'Unknown',
            buyer_count: buyers.length,
            deal_count: dealsResult.data?.length || 0,
            enriched_count: enrichedCount,
            transcript_count: transcriptCount,
          };
        })
      );

      setTrackers(trackersWithStats);

      // Load total stats using remarketing tables
      const [buyersCount, dealsCount, scoresCount] = await Promise.all([
        supabase.from("remarketing_buyers").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id", { count: "exact", head: true }),
        supabase.from("remarketing_scores").select("id", { count: "exact", head: true }),
      ]);

      setTotalStats({
        buyers: buyersCount.count || 0,
        deals: dealsCount.count || 0,
        scores: scoresCount.count || 0,
      });
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalBuyers = trackers.reduce((sum, t) => sum + t.buyer_count, 0);
  const totalDeals = trackers.reduce((sum, t) => sum + t.deal_count, 0);
  const totalEnriched = trackers.reduce((sum, t) => sum + t.enriched_count, 0);
  const totalTranscripts = trackers.reduce((sum, t) => sum + t.transcript_count, 0);
  // Two-tier intel: website (up to 50%) + transcripts (up to 50%)
  const websiteIntel = totalBuyers > 0 ? Math.round((totalEnriched / totalBuyers) * 50) : 0;
  const transcriptIntel = totalBuyers > 0 ? Math.round((totalTranscripts / totalBuyers) * 50) : 0;
  const avgCoverage = websiteIntel + transcriptIntel;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">M&A Intelligence Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Building institutional memory for M&A. Every deal makes the next one better.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link to="/admin/ma-intelligence/trackers/new">
              <Plus className="w-4 h-4 mr-2" />
              New Buyer Universe
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Buyer Universes"
          value={trackers.length}
          subtitle="Active industry verticals"
          icon={Building2}
        />
        <StatCard
          title="Total Buyers"
          value={totalStats.buyers}
          subtitle={`Across ${trackers.length} universes`}
          icon={Users}
        />
        <StatCard
          title="Deals Processed"
          value={totalStats.deals}
          subtitle={`${totalStats.scores} scores generated`}
          icon={FileText}
        />
        <StatCard
          title="Intelligence Coverage"
          value={`${avgCoverage}%`}
          subtitle={`${totalTranscripts} with transcripts, ${totalEnriched} enriched`}
          icon={Brain}
          variant={avgCoverage >= 70 ? "success" : avgCoverage >= 40 ? "warning" : "default"}
        />
      </div>

      {/* Buyer Universes List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Buyer Universes</h2>
          <Link
            to="/admin/ma-intelligence/trackers"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {trackers.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No buyer universes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first buyer universe to start building institutional memory.
            </p>
            <Button asChild>
              <Link to="/admin/ma-intelligence/trackers/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Universe
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {trackers.slice(0, 4).map((tracker) => {
              // Two-tier intel: website (up to 50%) + transcripts (up to 50%)
              const websiteIntel = tracker.buyer_count > 0 
                ? Math.round((tracker.enriched_count / tracker.buyer_count) * 50) 
                : 0;
              const transcriptIntel = tracker.buyer_count > 0 
                ? Math.round((tracker.transcript_count / tracker.buyer_count) * 50) 
                : 0;
              const coverage = websiteIntel + transcriptIntel;

              return (
                <Link
                  key={tracker.id}
                  to={`/admin/ma-intelligence/trackers/${tracker.id}`}
                  className="bg-card rounded-lg border p-5 hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{tracker.industry_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{tracker.buyer_count} buyers</span>
                        <span>{tracker.deal_count} deals</span>
                      </div>
                    </div>
                    <Badge
                      variant={coverage >= 75 ? "default" : coverage >= 50 ? "secondary" : "outline"}
                    >
                      {coverage}% intel
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <IntelligenceCoverageBar
                      intelligentCount={tracker.transcript_count}
                      totalCount={tracker.buyer_count}
                      enrichedCount={tracker.enriched_count}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
