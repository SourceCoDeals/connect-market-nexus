import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Clock, FileText } from 'lucide-react';
import { LeadMetricsDashboard } from './LeadMetricsDashboard';
import { WorkQueueDashboard } from './WorkQueueDashboard';
import { AuditTrailDashboard } from './AuditTrailDashboard';

export function ProjectManagementTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Project Management</h2>
        <p className="text-muted-foreground">
          Comprehensive lead management, work queue, and audit trail
        </p>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Metrics & Analytics
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Work Queue
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Lead Metrics & Analytics
              </CardTitle>
              <CardDescription>
                Track lead intake, conversion rates, and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadMetricsDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Work Queue Management
              </CardTitle>
              <CardDescription>
                Priority-based lead management with smart filtering and urgent item tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkQueueDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Trail & Activity Log
              </CardTitle>
              <CardDescription>
                Complete tracking of all mapping, merge, and decision activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTrailDashboard />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}