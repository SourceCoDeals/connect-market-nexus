import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DealSourcingRequestsTable } from '@/components/admin/DealSourcingRequestsTable';
import { useDealSourcingRequests, DealSourcingFilters } from '@/hooks/admin/use-deal-sourcing-requests';
import { Loader2, Sparkles } from 'lucide-react';

export default function AdminDealSourcing() {
  const [filters, setFilters] = useState<DealSourcingFilters>({});
  const { data: requests, isLoading } = useDealSourcingRequests(filters);

  const newRequests = requests?.filter(r => r.status === 'new') || [];
  const activeRequests = requests?.filter(r => ['reviewing', 'contacted', 'scheduled_call'].includes(r.status)) || [];
  const convertedRequests = requests?.filter(r => r.status === 'converted_to_deal') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Deal Sourcing Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage custom deal flow inquiries from buyers
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New Requests</CardDescription>
            <CardTitle className="text-3xl">{newRequests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">{activeRequests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Converted</CardDescription>
            <CardTitle className="text-3xl">{convertedRequests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">{requests?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="new" className="space-y-4">
            <TabsList>
              <TabsTrigger value="new">
                New ({newRequests.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({activeRequests.length})
              </TabsTrigger>
              <TabsTrigger value="converted">
                Converted ({convertedRequests.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({requests?.length || 0})
              </TabsTrigger>
            </TabsList>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="new" className="space-y-4">
                  <DealSourcingRequestsTable requests={newRequests} />
                </TabsContent>
                <TabsContent value="active" className="space-y-4">
                  <DealSourcingRequestsTable requests={activeRequests} />
                </TabsContent>
                <TabsContent value="converted" className="space-y-4">
                  <DealSourcingRequestsTable requests={convertedRequests} />
                </TabsContent>
                <TabsContent value="all" className="space-y-4">
                  <DealSourcingRequestsTable requests={requests || []} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
