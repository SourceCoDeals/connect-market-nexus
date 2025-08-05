import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Eye, Heart, MessageSquare, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useListingIntelligence, useListingJourneys } from "@/hooks/use-listing-intelligence";

export function ListingIntelligenceTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("performance_score");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedListingId, setSelectedListingId] = useState<string>();
  
  const { data: intelligenceData, isLoading } = useListingIntelligence(30);
  const { data: journeyData } = useListingJourneys(selectedListingId);

  const listings = intelligenceData?.listingPerformance || [];
  const averages = intelligenceData?.averageMetrics;

  const filteredListings = listings.filter(listing => {
    const matchesSearch = !searchTerm || 
      listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || listing.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case 'performance_score': return b.performance_score - a.performance_score;
      case 'views': return b.views - a.views;
      case 'conversion_rate': return b.conversion_rate - a.conversion_rate;
      case 'revenue': return b.revenue - a.revenue;
      default: return 0;
    }
  });

  const categories = [...new Set(listings.map(l => l.category))];

  const getPerformanceBadge = (score: number) => {
    if (score >= 70) return { variant: 'default' as const, label: 'High', color: 'text-green-600' };
    if (score >= 40) return { variant: 'secondary' as const, label: 'Medium', color: 'text-yellow-600' };
    return { variant: 'outline' as const, label: 'Low', color: 'text-red-600' };
  };

  const getJourneyStageIcon = (stage: string) => {
    switch (stage) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'serious': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'interested': return <Heart className="h-4 w-4 text-orange-500" />;
      default: return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Listing Intelligence</h2>
        <p className="text-muted-foreground">Deep insights into listing performance and user behavior</p>
      </div>

      {/* Performance Overview */}
      {averages && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Views/Listing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averages.avgViews.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averages.avgConversionRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averages.topPerformers}</div>
              <p className="text-xs text-muted-foreground">Score 70+</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averages.needsAttention}</div>
              <p className="text-xs text-muted-foreground">Score &lt;30</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
          <TabsTrigger value="journeys">User Journeys</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search listings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="performance_score">Performance</SelectItem>
                      <SelectItem value="views">Views</SelectItem>
                      <SelectItem value="conversion_rate">Conversion</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedListings.map((listing) => {
                  const performance = getPerformanceBadge(listing.performance_score);
                  
                  return (
                    <div key={listing.id} className="p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                         onClick={() => setSelectedListingId(listing.id)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm mb-1">{listing.title}</h4>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{listing.category}</span>
                            <span>${(listing.revenue / 1000000).toFixed(1)}M revenue</span>
                            <span>${(listing.ebitda / 1000000).toFixed(1)}M EBITDA</span>
                          </div>
                        </div>
                        <Badge variant={performance.variant} className={performance.color}>
                          {listing.performance_score} {performance.label}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span>{listing.views} views</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          <span>{listing.saves} saves</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span>{listing.connections} connections</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span>{listing.conversion_rate.toFixed(1)}% conversion</span>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Avg view time: {(listing.avg_view_duration / 60).toFixed(1)}m</span>
                          <span>Bounce rate: {listing.bounce_rate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journeys" className="space-y-4">
          {selectedListingId && journeyData && journeyData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>User Journeys: {journeyData[0].listing_title}</CardTitle>
                <CardDescription>Detailed user interaction patterns for this listing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {journeyData[0].user_journeys.map((journey) => (
                    <div key={journey.user_id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{journey.user_name}</p>
                          <p className="text-xs text-muted-foreground">{journey.user_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getJourneyStageIcon(journey.journey_stage)}
                          <Badge variant="outline" className="capitalize">
                            {journey.journey_stage}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">{journey.total_views}</span> views
                        </div>
                        <div>
                          <span className="font-medium">{(journey.time_spent / 60).toFixed(1)}m</span> time spent
                        </div>
                        <div>
                          First view: {new Date(journey.first_view).toLocaleDateString()}
                        </div>
                        <div>
                          Last active: {new Date(journey.last_activity).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2">
                        {journey.saved && <Badge variant="outline" className="text-xs">Saved</Badge>}
                        {journey.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Select a listing from the Performance tab to view user journeys</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Urgent Optimizations</CardTitle>
                <CardDescription>Listings needing immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedListings
                    .filter(l => l.performance_score < 30)
                    .slice(0, 5)
                    .map((listing) => (
                      <div key={listing.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <h4 className="font-medium text-sm">{listing.title}</h4>
                          <Badge variant="outline" className="text-red-600">
                            Score: {listing.performance_score}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {listing.optimization_suggestions.map((suggestion, index) => (
                            <p key={index} className="text-xs text-red-700">• {suggestion}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
                <CardDescription>Learn from top-performing listings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedListings
                    .filter(l => l.performance_score >= 70)
                    .slice(0, 3)
                    .map((listing) => (
                      <div key={listing.id} className="p-3 border border-green-200 rounded-lg bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <h4 className="font-medium text-sm">{listing.title}</h4>
                          <Badge variant="default" className="text-green-600">
                            Score: {listing.performance_score}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="font-medium">{listing.views}</span> views
                          </div>
                          <div>
                            <span className="font-medium">{listing.conversion_rate.toFixed(1)}%</span> conversion
                          </div>
                          <div>
                            <span className="font-medium">{(listing.avg_view_duration / 60).toFixed(1)}m</span> avg time
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}