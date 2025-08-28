import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, User, Building, Mail, MessageSquare, Filter } from 'lucide-react';
import { useWorkQueue, useWorkQueueStats, WorkQueueFilters } from '@/hooks/admin/use-work-queue';
import { useArchiveInboundLead } from '@/hooks/admin/use-inbound-leads';

export function WorkQueueDashboard() {
  const [filters, setFilters] = useState<WorkQueueFilters>({ status: 'pending' });
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: workQueue, isLoading } = useWorkQueue(filters);
  const { data: stats } = useWorkQueueStats();
  const archiveLead = useArchiveInboundLead();

  const handleFilterChange = (key: keyof WorkQueueFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }));
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return <AlertTriangle className="h-3 w-3" />;
      case 'medium': return <Clock className="h-3 w-3" />;
      case 'low': return <Clock className="h-3 w-3 opacity-50" />;
      default: return <Clock className="h-3 w-3 opacity-50" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted animate-pulse rounded mb-2" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Items</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats?.totalItems || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">High Priority</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">{stats?.highPriority || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Overdue</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-orange-600">{stats?.overdue || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Avg Wait Time</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats?.avgWaitTime?.toFixed(1) || 0}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Work Queue</CardTitle>
              <CardDescription>Priority-based lead management</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="border-t pt-4">
            <div className="grid gap-4 md:grid-cols-5">
              <Select value={filters.status || ''} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="mapped">Mapped</SelectItem>
                  <SelectItem value="merged">Merged</SelectItem>
                  <SelectItem value="discarded">Discarded</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.urgency || ''} onValueChange={(value) => handleFilterChange('urgency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Urgency</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.source || ''} onValueChange={(value) => handleFilterChange('source', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sources</SelectItem>
                  <SelectItem value="webflow">Webflow</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Min Score"
                value={filters.minScore || ''}
                onChange={(e) => handleFilterChange('minScore', e.target.value ? Number(e.target.value) : undefined)}
              />

              <Input
                type="number"
                placeholder="Max Age (days)"
                value={filters.maxAge || ''}
                onChange={(e) => handleFilterChange('maxAge', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Work Queue Items */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {workQueue && workQueue.length > 0 ? (
              workQueue.map((item) => (
                <div key={item.id} className="border-b last:border-b-0 p-4 hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getUrgencyColor(item.urgency) as any} className="flex items-center gap-1">
                          {getUrgencyIcon(item.urgency)}
                          {item.urgency}
                        </Badge>
                        <Badge variant="outline">Score: {item.priority_score}</Badge>
                        <Badge variant="secondary">{item.daysOld}d old</Badge>
                        <Badge variant="outline">{item.source}</Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.name}</span>
                          {item.role && (
                            <Badge variant="outline" className="text-xs">{item.role}</Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{item.email}</span>
                        </div>
                        
                        {item.company_name && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{item.company_name}</span>
                          </div>
                        )}
                        
                        {item.message && (
                          <div className="flex items-start gap-2 mt-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-sm text-muted-foreground line-clamp-2">
                              {item.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {item.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline">
                            Map to Listing
                          </Button>
                          <Button size="sm" variant="ghost" 
                            onClick={() => archiveLead.mutate(item.id)}>
                            Archive
                          </Button>
                        </>
                      )}
                      {item.status !== 'pending' && (
                        <Badge variant="outline" className="capitalize">
                          {item.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No items in work queue</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All leads are processed or no leads match your filters
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}