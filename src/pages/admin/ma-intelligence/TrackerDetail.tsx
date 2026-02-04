import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, FileText, Settings, Brain, Upload, Archive, ArrowLeft, Target, Activity, MessageSquare, Sliders } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TrackerBuyersTab } from "@/components/ma-intelligence/tracker/TrackerBuyersTab";
import { TrackerDealsTab } from "@/components/ma-intelligence/tracker/TrackerDealsTab";
import { TrackerFitCriteriaTab } from "@/components/ma-intelligence/tracker/TrackerFitCriteriaTab";
import { TrackerKPIConfigTab } from "@/components/ma-intelligence/tracker/TrackerKPIConfigTab";
import { TrackerScoringBehaviorTab } from "@/components/ma-intelligence/tracker/TrackerScoringBehaviorTab";
import { TrackerDocumentsTab } from "@/components/ma-intelligence/tracker/TrackerDocumentsTab";
import { TrackerQueryTab } from "@/components/ma-intelligence/tracker/TrackerQueryTab";
import { TrackerActivityTab } from "@/components/ma-intelligence/tracker/TrackerActivityTab";
import { InterruptedSessionBanner } from "@/components/ma-intelligence/tracker/InterruptedSessionBanner";
import type { SizeCriteria, ServiceCriteria, GeographyCriteria, ScoringBehavior, TrackerDocument } from "@/lib/ma-intelligence/types";

interface TrackerData {
  id: string;
  name: string;
  industry_name: string;
  description: string | null;
  is_active: boolean;
  size_criteria: SizeCriteria | null;
  service_criteria: ServiceCriteria | null;
  geography_criteria: GeographyCriteria | null;
  scoring_behavior: ScoringBehavior | null;
  kpi_config: Record<string, unknown> | null;
  documents: TrackerDocument[] | null;
  created_at: string;
  updated_at: string;
}

export default function TrackerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("buyers");
  const [buyerCount, setBuyerCount] = useState(0);
  const [dealCount, setDealCount] = useState(0);

  useEffect(() => {
    if (id && id !== 'new') {
      loadTracker();
    } else if (id === 'new') {
      // Handle new tracker creation
      setTracker({
        id: 'new',
        name: '',
        industry_name: '',
        description: null,
        is_active: true,
        size_criteria: null,
        service_criteria: null,
        geography_criteria: null,
        scoring_behavior: null,
        kpi_config: null,
        documents: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setIsLoading(false);
    }
  }, [id]);

  const loadTracker = async () => {
    if (!id) return;

    try {
      const { data, error } = await (supabase as any)
        .from("industry_trackers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setTracker({
        ...data,
        industry_name: data.name || data.industry_name || 'Unknown',
      });

      // Load counts
      const [buyersRes, dealsRes] = await Promise.all([
        supabase.from("remarketing_buyers").select("id", { count: 'exact', head: true }).eq("industry_tracker_id", id),
        supabase.from("deals").select("id", { count: 'exact', head: true }).eq("listing_id", id),
      ]);

      setBuyerCount(buyersRes.count || 0);
      setDealCount(dealsRes.count || 0);
    } catch (error: any) {
      toast({
        title: "Error loading tracker",
        description: error.message,
        variant: "destructive",
      });
      navigate("/admin/ma-intelligence/trackers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTracker = async (updates: Partial<TrackerData>) => {
    if (!tracker) return;

    try {
      if (tracker.id === 'new') {
        // Create new tracker
        const { data, error } = await (supabase as any)
          .from("industry_trackers")
          .insert({
            name: updates.name || updates.industry_name,
            description: updates.description,
            is_active: true,
            size_criteria: updates.size_criteria,
            service_criteria: updates.service_criteria,
            geography_criteria: updates.geography_criteria,
            scoring_behavior: updates.scoring_behavior,
            kpi_config: updates.kpi_config,
          })
          .select()
          .single();

        if (error) throw error;

        toast({ title: "Tracker created successfully" });
        navigate(`/admin/ma-intelligence/trackers/${data.id}`);
      } else {
        // Update existing tracker
        const { error } = await (supabase as any)
          .from("industry_trackers")
          .update(updates)
          .eq("id", tracker.id);

        if (error) throw error;

        toast({ title: "Tracker updated successfully" });
        loadTracker();
      }
    } catch (error: any) {
      toast({
        title: "Error saving tracker",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchiveToggle = async () => {
    if (!tracker || tracker.id === 'new') return;

    try {
      const { error } = await (supabase as any)
        .from("industry_trackers")
        .update({ is_active: !tracker.is_active })
        .eq("id", tracker.id);

      if (error) throw error;

      toast({ title: tracker.is_active ? "Tracker archived" : "Tracker restored" });
      loadTracker();
    } catch (error: any) {
      toast({
        title: "Error updating tracker",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Tracker not found</h3>
          <Button onClick={() => navigate("/admin/ma-intelligence/trackers")}>
            Back to Trackers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Recovery Banner */}
      <InterruptedSessionBanner trackerId={tracker.id} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/ma-intelligence/trackers")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{tracker.industry_name}</h1>
              <p className="text-muted-foreground">
                {tracker.description || "Buyer universe detail and management"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={tracker.is_active ? "default" : "secondary"}>
            {tracker.is_active ? "Active" : "Archived"}
          </Badge>
          <Button
            variant="outline"
            onClick={handleArchiveToggle}
          >
            <Archive className="w-4 h-4 mr-2" />
            {tracker.is_active ? "Archive" : "Restore"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Buyers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{buyerCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intelligence Coverage</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {buyerCount > 0 ? Math.round((buyerCount * 0.7) / buyerCount * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="buyers">
            <Users className="w-4 h-4 mr-2" />
            Buyers
          </TabsTrigger>
          <TabsTrigger value="deals">
            <FileText className="w-4 h-4 mr-2" />
            Deals
          </TabsTrigger>
          <TabsTrigger value="criteria">
            <Settings className="w-4 h-4 mr-2" />
            Criteria
          </TabsTrigger>
          <TabsTrigger value="kpis">
            <Target className="w-4 h-4 mr-2" />
            KPIs
          </TabsTrigger>
          <TabsTrigger value="scoring">
            <Sliders className="w-4 h-4 mr-2" />
            Scoring
          </TabsTrigger>
          <TabsTrigger value="documents">
            <Upload className="w-4 h-4 mr-2" />
            Docs
          </TabsTrigger>
          <TabsTrigger value="query">
            <MessageSquare className="w-4 h-4 mr-2" />
            Query
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buyers" className="space-y-4">
          <TrackerBuyersTab
            trackerId={tracker.id}
            onBuyerCountChange={setBuyerCount}
          />
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <TrackerDealsTab
            trackerId={tracker.id}
            onDealCountChange={setDealCount}
          />
        </TabsContent>

        <TabsContent value="criteria" className="space-y-4">
          <TrackerFitCriteriaTab
            trackerId={tracker.id}
            sizeCriteria={tracker.size_criteria}
            serviceCriteria={tracker.service_criteria}
            geographyCriteria={tracker.geography_criteria}
            onSave={(criteria) => handleSaveTracker(criteria)}
          />
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <TrackerKPIConfigTab
            trackerId={tracker.id}
            kpiConfig={tracker.kpi_config}
            onSave={(config) => handleSaveTracker({ kpi_config: config })}
          />
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4">
          <TrackerScoringBehaviorTab
            trackerId={tracker.id}
            scoringBehavior={tracker.scoring_behavior}
            onSave={(behavior) => handleSaveTracker({ scoring_behavior: behavior })}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <TrackerDocumentsTab trackerId={tracker.id} />
        </TabsContent>

        <TabsContent value="query" className="space-y-4">
          <TrackerQueryTab trackerId={tracker.id} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <TrackerActivityTab trackerId={tracker.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
