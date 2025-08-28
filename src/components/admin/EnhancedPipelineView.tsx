import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowRight, 
  Users, 
  FileText, 
  CheckCircle, 
  TrendingUp,
  Filter,
  Calendar,
  BarChart3
} from 'lucide-react';
import { useInboundLeadsQuery } from '@/hooks/admin/use-inbound-leads';
import { useConnectionRequestsQuery } from '@/hooks/admin/requests/use-connection-requests-query';
import { format, subDays, startOfDay } from 'date-fns';

export const EnhancedPipelineView = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: leads = [] } = useInboundLeadsQuery();
  const { data: requests = [] } = useConnectionRequestsQuery();

  // Calculate date filter
  const dateFilter = startOfDay(subDays(new Date(), timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90));
  
  // Filter data by time range
  const filteredLeads = leads.filter(lead => new Date(lead.created_at) >= dateFilter);
  const filteredRequests = requests.filter(req => new Date(req.created_at) >= dateFilter);

  // Pipeline metrics
  const metrics = {
    totalLeads: filteredLeads.length,
    mappedLeads: filteredLeads.filter(l => l.status === 'mapped').length,
    convertedLeads: filteredLeads.filter(l => l.status === 'converted').length,
    totalRequests: filteredRequests.length,
    approvedRequests: filteredRequests.filter(r => r.status === 'approved').length,
    webflowRequests: filteredRequests.filter(r => r.source === 'webflow').length,
    marketplaceRequests: filteredRequests.filter(r => r.source === 'marketplace').length,
  };

  // Conversion rates
  const conversionRates = {
    leadToMapping: metrics.totalLeads > 0 ? (metrics.mappedLeads / metrics.totalLeads) * 100 : 0,
    leadToRequest: metrics.totalLeads > 0 ? (metrics.convertedLeads / metrics.totalLeads) * 100 : 0,
    requestToApproval: metrics.totalRequests > 0 ? (metrics.approvedRequests / metrics.totalRequests) * 100 : 0,
  };

  const PipelineStage = ({ 
    title, 
    count, 
    total, 
    icon: Icon, 
    color = 'blue' 
  }: { 
    title: string; 
    count: number; 
    total: number; 
    icon: any; 
    color?: string; 
  }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <Card className="hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 text-${color}-600`} />
              <span className="font-medium text-sm">{title}</span>
            </div>
            <Badge variant="outline" className={`bg-${color}-50 text-${color}-700 border-${color}-200`}>
              {count}
            </Badge>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="text-xs text-muted-foreground mt-2">
            {percentage.toFixed(1)}% of total
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pipeline Overview</h3>
          <p className="text-sm text-muted-foreground">
            Lead-to-deal conversion funnel analysis
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7d
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30d
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90d
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{metrics.totalLeads}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Requests</p>
                <p className="text-2xl font-bold">{metrics.totalRequests}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{metrics.approvedRequests}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conversion</p>
                <p className="text-2xl font-bold">{conversionRates.requestToApproval.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PipelineStage
              title="Leads → Mapped"
              count={metrics.mappedLeads}
              total={metrics.totalLeads}
              icon={ArrowRight}
              color="blue"
            />
            <PipelineStage
              title="Mapped → Converted"
              count={metrics.convertedLeads}
              total={metrics.mappedLeads}
              icon={ArrowRight}
              color="purple"
            />
            <PipelineStage
              title="Requests → Approved"
              count={metrics.approvedRequests}
              total={metrics.totalRequests}
              icon={CheckCircle}
              color="green"
            />
          </div>
        </CardContent>
      </Card>

      {/* Source Attribution */}
      <Card>
        <CardHeader>
          <CardTitle>Source Attribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Request Sources</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Webflow Forms</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {metrics.webflowRequests}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Marketplace</span>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700">
                    {metrics.marketplaceRequests}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Conversion Rates</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Lead → Request</span>
                  <span className="text-sm font-medium">
                    {conversionRates.leadToRequest.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Request → Approval</span>
                  <span className="text-sm font-medium">
                    {conversionRates.requestToApproval.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};