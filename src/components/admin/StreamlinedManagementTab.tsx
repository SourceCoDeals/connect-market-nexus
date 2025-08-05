import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Users, 
  AlertTriangle,
  CheckCircle,
  Shield,
  Settings,
  Clock,
  Activity,
  Database,
  Wifi,
  RefreshCw,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResponsiveManagementTab } from './ResponsiveManagementTab';
import { UsersTable } from './UsersTable';
import { MobileUsersTable } from './MobileUsersTable';
import { useAdminUsers } from '@/hooks/admin/use-admin-users';
import { User } from '@/types';

export function StreamlinedManagementTab() {
  const [systemHealthOpen, setSystemHealthOpen] = useState(false);
  const isMobile = useIsMobile();
  
  const { useUsers, useUpdateUserStatus, useUpdateAdminStatus, useDeleteUser } = useAdminUsers();
  const { data: usersData = [], isLoading } = useUsers();
  
  const updateUserStatus = useUpdateUserStatus();
  const updateAdminStatus = useUpdateAdminStatus();
  const deleteUser = useDeleteUser();

  const handleApprove = (user: User) => {
    updateUserStatus.mutate({ userId: user.id, status: 'approved' });
  };

  const handleMakeAdmin = (user: User) => {
    updateAdminStatus.mutate({ userId: user.id, isAdmin: true });
  };

  const handleRevokeAdmin = (user: User) => {
    updateAdminStatus.mutate({ userId: user.id, isAdmin: false });
  };

  const handleDelete = (user: User) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUser.mutate(user.id);
    }
  };

  const handleSendFeeAgreement = (user: User) => {
    console.log('Send fee agreement to:', user.email);
  };

  const handleSendNDAEmail = (user: User) => {
    console.log('Send NDA email to:', user.email);
  };

  const systemHealthMetrics: Array<{
    label: string;
    status: 'healthy' | 'warning' | 'error';
    icon: React.ElementType;
  }> = [
    { label: 'Database Connection', status: 'healthy', icon: Database },
    { label: 'Real-time Updates', status: 'healthy', icon: Wifi },
    { label: 'Analytics Pipeline', status: 'healthy', icon: Activity },
    { label: 'Email Delivery', status: 'warning', icon: MessageSquare },
    { label: 'File Storage', status: 'healthy', icon: Shield }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Management Center</h2>
        <p className="text-sm text-muted-foreground">
          User management, feedback, deal alerts, and system health
        </p>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {isMobile ? 'Comms' : 'Communications'}
          </TabsTrigger>
          {!isMobile && (
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          )}
        </TabsList>

        {/* User Management */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Approve users, manage permissions, and view user data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <MobileUsersTable 
                  users={usersData}
                  isLoading={isLoading}
                  onApprove={handleApprove}
                  onMakeAdmin={handleMakeAdmin}
                  onRevokeAdmin={handleRevokeAdmin}
                  onDelete={handleDelete}
                  onSendFeeAgreement={handleSendFeeAgreement}
                  onSendNDAEmail={handleSendNDAEmail}
                />
              ) : (
                <UsersTable 
                  users={usersData}
                  isLoading={isLoading}
                  onApprove={handleApprove}
                  onMakeAdmin={handleMakeAdmin}
                  onRevokeAdmin={handleRevokeAdmin}
                  onDelete={handleDelete}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communications (Feedback & Deal Alerts) */}
        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Communications Management
              </CardTitle>
              <CardDescription>
                Manage feedback, deal alerts, and user communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveManagementTab />
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Health (Desktop only, mobile has collapsible) */}
        {!isMobile && (
          <TabsContent value="system" className="space-y-4">
            <SystemHealthSection 
              metrics={systemHealthMetrics}
              isCollapsible={false}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Mobile: Collapsible System Health */}
      {isMobile && (
        <Collapsible open={systemHealthOpen} onOpenChange={setSystemHealthOpen}>
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">System Health</div>
                      <div className="text-sm text-muted-foreground">
                        All systems operational
                      </div>
                    </div>
                  </div>
                  {systemHealthOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4">
              <SystemHealthSection 
                metrics={systemHealthMetrics}
                isCollapsible={true}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

interface SystemHealthSectionProps {
  metrics: Array<{
    label: string;
    status: 'healthy' | 'warning' | 'error';
    icon: React.ElementType;
  }>;
  isCollapsible: boolean;
}

function SystemHealthSection({ metrics, isCollapsible }: SystemHealthSectionProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
      case 'warning':
        return <Badge variant="destructive" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          System Health Monitor
        </CardTitle>
        <CardDescription>
          Monitor system components and health status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <metric.icon className={`h-5 w-5 ${getStatusColor(metric.status)}`} />
                <span className="font-medium">{metric.label}</span>
              </div>
              {getStatusBadge(metric.status)}
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last health check</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">2 minutes ago</span>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}