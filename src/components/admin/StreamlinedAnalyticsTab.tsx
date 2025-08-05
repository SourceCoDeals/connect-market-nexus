import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Users, Eye, Search, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { useSimpleMarketplaceAnalytics } from "@/hooks/use-simple-marketplace-analytics";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function StreamlinedAnalyticsTab() {
  const [timeRange, setTimeRange] = useState("30");
  const { data: analytics, isLoading } = useSimpleMarketplaceAnalytics(parseInt(timeRange));

  // Mock data for enhanced analytics - in real app, these would come from proper hooks
  const userJourneyData = [
    { step: "Landing", users: 1000, dropoff: 0 },
    { step: "Registration", users: 750, dropoff: 25 },
    { step: "Profile Setup", users: 600, dropoff: 20 },
    { step: "First Browse", users: 520, dropoff: 13 },
    { step: "First Save", users: 380, dropoff: 27 },
    { step: "First Connection", users: 280, dropoff: 26 }
  ];

  const listingPerformanceData = [
    { name: "Tech Startups", views: 2400, saves: 400, connections: 120 },
    { name: "Manufacturing", views: 1800, saves: 300, connections: 90 },
    { name: "Retail", views: 1600, saves: 250, connections: 75 },
    { name: "Healthcare", views: 1200, saves: 200, connections: 60 },
    { name: "Finance", views: 1000, saves: 150, connections: 45 }
  ];

  const searchInsightsData = [
    { term: "SaaS", searches: 450, conversions: 68 },
    { term: "E-commerce", searches: 380, conversions: 52 },
    { term: "AI/ML", searches: 320, conversions: 48 },
    { term: "Fintech", searches: 280, conversions: 42 },
    { term: "Healthcare", searches: 240, conversions: 35 }
  ];

  const geographicData = [
    { region: "North America", users: 45, value: 45 },
    { region: "Europe", users: 30, value: 30 },
    { region: "Asia Pacific", users: 20, value: 20 },
    { region: "Other", users: 5, value: 5 }
  ];

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
      {/* Header with time range selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-muted-foreground">Deep insights into marketplace performance</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28%</div>
            <p className="text-xs text-muted-foreground">Browse to connection rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8m 32s</div>
            <p className="text-xs text-muted-foreground">Time spent per visit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Retention</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">76%</div>
            <p className="text-xs text-muted-foreground">7-day return rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="journey" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="journey">User Journey</TabsTrigger>
          <TabsTrigger value="listings">Listing Performance</TabsTrigger>
          <TabsTrigger value="search">Search Insights</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="journey" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Journey Funnel</CardTitle>
              <CardDescription>Track user progression through key actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userJourneyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="step" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="users" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Biggest drop-off: First Save (27% loss) - Consider improving save UX</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Listing Category Performance</CardTitle>
              <CardDescription>Views, saves, and connections by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={listingPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="views" fill="hsl(var(--primary))" />
                    <Bar dataKey="saves" fill="hsl(var(--secondary))" />
                    <Bar dataKey="connections" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Tech Startups have highest engagement - consider featuring more prominently</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Search Terms</CardTitle>
                <CardDescription>Most searched keywords and conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {searchInsightsData.map((item, index) => (
                    <div key={item.term} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span>{item.term}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{item.searches} searches</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round((item.conversions / item.searches) * 100)}% conversion
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Geographic Distribution</CardTitle>
                <CardDescription>User distribution by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={geographicData}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {geographicData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Behavior Patterns</CardTitle>
              <CardDescription>Peak usage times and activity patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Peak Usage Hours</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>9:00 AM - 11:00 AM</span>
                      <span className="text-green-500">High Activity</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>2:00 PM - 4:00 PM</span>
                      <span className="text-green-500">High Activity</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>7:00 PM - 9:00 PM</span>
                      <span className="text-yellow-500">Medium Activity</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Device Usage</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Desktop</span>
                      <span>58%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Mobile</span>
                      <span>35%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tablet</span>
                      <span>7%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}