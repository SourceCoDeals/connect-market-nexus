import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, MessageSquare, Bell, AlertTriangle, CheckCircle, Users, Database } from "lucide-react";
import { useState } from "react";
import { EnhancedFeedbackManagement } from "./EnhancedFeedbackManagement";
import { DealAlertsOverview } from "./DealAlertsOverview";
import { DataQualityDashboard } from "./DataQualityDashboard";
import { EnhancedAnalyticsHealthDashboard } from "./EnhancedAnalyticsHealthDashboard";

export function StreamlinedManagementTab() {
  const [isSystemHealthOpen, setIsSystemHealthOpen] = useState(false);

  // Mock data for urgent approvals - in real app, this would come from hooks
  const urgentApprovals = [
    { id: 1, type: "user", name: "John Smith", email: "john@startup.com", waitTime: "3 days" },
    { id: 2, type: "connection", from: "TechCorp", to: "InnovateLLC", waitTime: "1 day" },
    { id: 3, type: "listing", title: "SaaS Platform for Sale", waitTime: "2 days" }
  ];

  const quickResponseTemplates = [
    "Thank you for your feedback. We're reviewing this and will get back to you within 24 hours.",
    "We appreciate you bringing this to our attention. This issue has been escalated to our technical team.",
    "Your connection request has been approved. You can now contact the seller directly.",
    "Welcome to our marketplace! Your profile has been approved and you can now start browsing listings."
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Management Center</h2>
        <p className="text-muted-foreground">Feedback, alerts, approvals, and system monitoring</p>
      </div>

      {/* Urgent Approvals Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Urgent Approvals
            <Badge variant="destructive">{urgentApprovals.length}</Badge>
          </CardTitle>
          <CardDescription>Items requiring immediate admin attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {urgentApprovals.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{item.type}</Badge>
                    <span className="font-medium">
                      {item.type === 'user' && item.name}
                      {item.type === 'connection' && `${item.from} → ${item.to}`}
                      {item.type === 'listing' && item.title}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Waiting for {item.waitTime}
                    {item.type === 'user' && ` • ${item.email}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                  <Button size="sm">
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Management Tabs */}
      <Tabs defaultValue="feedback" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedback">Feedback & Communication</TabsTrigger>
          <TabsTrigger value="alerts">Deal Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Quick Response Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Quick Response Templates
                </CardTitle>
                <CardDescription>Pre-written responses for common situations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quickResponseTemplates.map((template, index) => (
                    <div key={index} className="p-2 border rounded text-sm cursor-pointer hover:bg-muted">
                      {template}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Communication Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Communication Metrics</CardTitle>
                <CardDescription>Response times and satisfaction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <div className="text-2xl font-bold">2.4h</div>
                    <p className="text-xs text-muted-foreground">Avg Response Time</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">94%</div>
                    <p className="text-xs text-muted-foreground">Response Rate</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">4.7</div>
                    <p className="text-xs text-muted-foreground">Satisfaction Score</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">Open Tickets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Feedback Management */}
          <EnhancedFeedbackManagement />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">47</div>
                <p className="text-xs text-muted-foreground">Currently monitoring</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alerts Sent Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">23</div>
                <p className="text-xs text-muted-foreground">Notifications delivered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89%</div>
                <p className="text-xs text-muted-foreground">Alerts leading to connections</p>
              </CardContent>
            </Card>
          </div>

          <DealAlertsOverview />
        </TabsContent>
      </Tabs>

      {/* System Health & Data Quality (Collapsible) */}
      <Collapsible open={isSystemHealthOpen} onOpenChange={setIsSystemHealthOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <CardTitle>System Health & Data Quality</CardTitle>
                  <div className="flex gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="secondary" className="text-xs">All Systems Normal</Badge>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isSystemHealthOpen ? 'rotate-180' : ''}`} />
              </div>
              <CardDescription>
                Database performance, data integrity, and system monitoring
              </CardDescription>
            </CardHeader>
          </Card>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-3">Data Quality Dashboard</h4>
              <DataQualityDashboard />
            </div>
            <div>
              <h4 className="font-medium mb-3">Analytics Health</h4>
              <EnhancedAnalyticsHealthDashboard />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}