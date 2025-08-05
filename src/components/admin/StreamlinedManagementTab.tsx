import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, CheckCircle, Database } from "lucide-react";
import { useState } from "react";
import { EnhancedFeedbackManagement } from "./EnhancedFeedbackManagement";
import { DealAlertsOverview } from "./DealAlertsOverview";
import { DataQualityDashboard } from "./DataQualityDashboard";
import { EnhancedAnalyticsHealthDashboard } from "./EnhancedAnalyticsHealthDashboard";

export function StreamlinedManagementTab() {
  const [isSystemHealthOpen, setIsSystemHealthOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Management Center</h2>
        <p className="text-muted-foreground">Feedback management and deal alerts</p>
      </div>

      {/* Main Management Tabs */}
      <Tabs defaultValue="feedback" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedback">Feedback & Communication</TabsTrigger>
          <TabsTrigger value="alerts">Deal Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-4">
          <EnhancedFeedbackManagement />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
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