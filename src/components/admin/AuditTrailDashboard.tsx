import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  FileText, 
  Filter,
  Calendar
} from 'lucide-react';
import { useAuditTrail, useAuditStats, AuditFilters } from '@/hooks/admin/use-audit-trail';
import { format, formatDistanceToNow } from 'date-fns';

export function AuditTrailDashboard() {
  const [filters, setFilters] = useState<AuditFilters>({ limit: 50 });
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: auditTrail, isLoading } = useAuditTrail(filters);
  const { data: stats } = useAuditStats();

  const handleFilterChange = (key: keyof AuditFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }));
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'lead_mapped':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'request_approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'request_rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'request_on_hold':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'lead_mapped':
        return 'default';
      case 'request_approved':
        return 'default';
      case 'request_rejected':
        return 'destructive';
      case 'request_on_hold':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'lead_mapped':
        return 'Lead Mapped';
      case 'request_approved':
        return 'Request Approved';
      case 'request_rejected':
        return 'Request Rejected';
      case 'request_on_hold':
        return 'Request On Hold';
      default:
        return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Activities</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats?.totalActivities || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Mappings Today</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{stats?.mappingsToday || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Decisions Today</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">{stats?.decisionsToday || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Mappings This Week</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats?.mappingsThisWeek || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Decisions This Week</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats?.decisionsThisWeek || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Audit Trail</CardTitle>
              <CardDescription>Complete activity log and decision tracking</CardDescription>
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
            <div className="grid gap-4 md:grid-cols-4">
              <Select value={filters.actionType || ''} onValueChange={(value) => handleFilterChange('actionType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="lead_mapped">Lead Mapped</SelectItem>
                  <SelectItem value="request_approved">Request Approved</SelectItem>
                  <SelectItem value="request_rejected">Request Rejected</SelectItem>
                  <SelectItem value="request_on_hold">Request On Hold</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.entityType || ''} onValueChange={(value) => handleFilterChange('entityType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Entities</SelectItem>
                  <SelectItem value="inbound_lead">Inbound Lead</SelectItem>
                  <SelectItem value="connection_request">Connection Request</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Start Date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />

              <Input
                type="date"
                placeholder="End Date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {auditTrail && auditTrail.length > 0 ? (
              auditTrail.map((entry) => (
                <div key={entry.id} className="border-b last:border-b-0 p-4 hover:bg-muted/50">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 mt-1">
                      {getActionIcon(entry.action_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getActionColor(entry.action_type) as any}>
                          {getActionLabel(entry.action_type)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {entry.entity_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-sm font-medium mb-1">{entry.description}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{entry.admin_name || 'Unknown Admin'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                        <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                      </div>
                      
                      {entry.metadata && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {entry.metadata.lead_name && (
                            <span>Lead: {entry.metadata.lead_name}</span>
                          )}
                          {entry.metadata.user_name && (
                            <span>User: {entry.metadata.user_name}</span>
                          )}
                          {entry.metadata.listing_title && (
                            <span> • Listing: {entry.metadata.listing_title}</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {entry.admin_name ? entry.admin_name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'AD'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No audit entries found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Admin activities will appear here as they occur
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}