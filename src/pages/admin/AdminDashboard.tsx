
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Users, MessageSquare, TrendingUp } from "lucide-react";

const AdminDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeListings: 0,
    pendingUsers: 0,
    connectionRequests: 0,
    approvedConnections: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setStats({
        activeListings: 12,
        pendingUsers: 5,
        connectionRequests: 8,
        approvedConnections: 15,
      });
      
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardDescription className="h-4 w-20 bg-muted rounded skeleton"></CardDescription>
            <CardTitle className="h-8 w-24 bg-muted rounded skeleton mt-1"></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-4 w-32 bg-muted rounded skeleton"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {isLoading ? (
        renderSkeleton()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <Store className="h-4 w-4 mr-1" /> Listings
              </CardDescription>
              <CardTitle>{stats.activeListings}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Active listings in marketplace
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <Users className="h-4 w-4 mr-1" /> Users
              </CardDescription>
              <CardTitle>{stats.pendingUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pending approval requests
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <MessageSquare className="h-4 w-4 mr-1" /> Connections
              </CardDescription>
              <CardTitle>{stats.connectionRequests}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                New connection requests
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" /> Activity
              </CardDescription>
              <CardTitle>{stats.approvedConnections}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Total approved connections
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest actions across the marketplace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4 py-1">
                <p className="text-sm">New user registered: <span className="font-medium">John Smith</span></p>
                <p className="text-xs text-muted-foreground">5 minutes ago</p>
              </div>
              <div className="border-l-4 border-primary pl-4 py-1">
                <p className="text-sm">New connection request for <span className="font-medium">Manufacturing Business</span></p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
              <div className="border-l-4 border-primary pl-4 py-1">
                <p className="text-sm">User <span className="font-medium">Alice Johnson</span> approved</p>
                <p className="text-xs text-muted-foreground">3 hours ago</p>
              </div>
              <div className="border-l-4 border-primary pl-4 py-1">
                <p className="text-sm">New listing created: <span className="font-medium">E-commerce Business</span></p>
                <p className="text-xs text-muted-foreground">1 day ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
