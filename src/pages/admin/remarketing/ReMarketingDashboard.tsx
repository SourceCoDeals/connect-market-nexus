import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { 
  Target, 
  Users, 
  BarChart3, 
  Plus,
  ArrowRight,
  TrendingUp,
  Building2,
  Sparkles,
  PieChart,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { UnlinkedListingsWidget } from "@/components/remarketing/UnlinkedListingsWidget";

const ReMarketingDashboard = () => {
  // Fetch universes with counts
  const { data: universes, isLoading: universesLoading } = useQuery({
    queryKey: ['remarketing', 'universes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch total buyers count
  const { data: buyerCount } = useQuery({
    queryKey: ['remarketing', 'buyers', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('remarketing_buyers')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false);
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch recent scores
  const { data: recentScores } = useQuery({
    queryKey: ['remarketing', 'scores', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select(`
          id,
          composite_score,
          tier,
          status,
          created_at,
          buyer:remarketing_buyers(company_name),
          listing:listings(title)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch outreach stats
  const { data: outreachStats } = useQuery({
    queryKey: ['remarketing', 'outreach', 'stats'],
    queryFn: async () => {
      // Approved scores without outreach
      const { count: approvedCount } = await supabase
        .from('remarketing_scores')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

      // Outreach records that are active
      const { count: activeOutreach } = await supabase
        .from('remarketing_outreach')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("pending","closed_won","closed_lost")');

      // Outreach pending (approved but not started)
      const { data: outreachRecords } = await supabase
        .from('remarketing_outreach')
        .select('score_id');
      
      const outreachScoreIds = new Set((outreachRecords || []).map(r => r.score_id));
      
      const { data: approvedScores } = await supabase
        .from('remarketing_scores')
        .select('id')
        .eq('status', 'approved');
      
      const pendingOutreach = (approvedScores || []).filter(s => !outreachScoreIds.has(s.id)).length;

      return {
        approved: approvedCount || 0,
        activeOutreach: activeOutreach || 0,
        pendingOutreach,
      };
    }
  });

  const stats = [
    {
      title: "Buyer Universes",
      value: universes?.length || 0,
      icon: Target,
      description: "Active buyer groups",
      color: "text-blue-500"
    },
    {
      title: "Total Buyers",
      value: buyerCount || 0,
      icon: Building2,
      description: "External buyers tracked",
      color: "text-emerald-500"
    },
    {
      title: "Recent Matches",
      value: recentScores?.length || 0,
      icon: BarChart3,
      description: "Scores generated",
      color: "text-purple-500"
    },
    {
      title: "Approved",
      value: outreachStats?.approved || 0,
      icon: CheckCircle2,
      description: "Ready for outreach",
      color: "text-green-500"
    },
    {
      title: "Pending Outreach",
      value: outreachStats?.pendingOutreach || 0,
      icon: Mail,
      description: "Approved but not contacted",
      color: outreachStats?.pendingOutreach ? "text-amber-500" : "text-muted-foreground"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Remarketing Tool</h1>
          <p className="text-muted-foreground">
            Match marketplace listings to external buyers using AI-powered scoring
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/remarketing/analytics">
              <PieChart className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/remarketing/buyers">
              <Users className="mr-2 h-4 w-4" />
              View Buyers
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/remarketing/universes/new">
              <Plus className="mr-2 h-4 w-4" />
              New Universe
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unlinked Listings Warning Widget */}
      <UnlinkedListingsWidget />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Buyer Universes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Buyer Universes</CardTitle>
                <CardDescription>Organized buyer groups by industry</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/remarketing/universes">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {universesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : universes?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No universes created yet</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/admin/remarketing/universes/new">Create your first universe</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {universes?.slice(0, 5).map((universe) => (
                  <Link
                    key={universe.id}
                    to={`/admin/remarketing/universes/${universe.id}`}
                    className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{universe.name}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {universe.description || 'No description'}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Matches</CardTitle>
                <CardDescription>Latest AI-generated scores</CardDescription>
              </div>
              <Sparkles className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            {recentScores?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No matches scored yet</p>
                <p className="text-xs mt-1">Start by selecting a listing to match</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentScores?.map((score: any) => (
                  <div
                    key={score.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {score.buyer?.company_name || 'Unknown Buyer'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        → {score.listing?.title || 'Unknown Listing'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant={
                        score.tier === 'A' ? 'default' :
                        score.tier === 'B' ? 'secondary' :
                        'outline'
                      }>
                        {score.tier || '-'} · {Math.round(score.composite_score)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/admin/remarketing/universes?new=true">
                <Plus className="h-5 w-5" />
                <span>Create Universe</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/admin/remarketing/buyers">
                <Users className="h-5 w-5" />
                <span>Import Buyers</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/admin/remarketing/deals">
                <Building2 className="h-5 w-5" />
                <span>View All Deals</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/admin/remarketing/analytics">
                <TrendingUp className="h-5 w-5" />
                <span>View Analytics</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReMarketingDashboard;
