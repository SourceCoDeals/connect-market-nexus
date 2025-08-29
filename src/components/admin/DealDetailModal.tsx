import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Deal, useDealTasks, useCreateDealTask, useUpdateDeal } from '@/hooks/admin/use-deals';
import { useAdmin } from '@/hooks/use-admin';
import { CommunicationTimeline } from '@/components/admin/CommunicationTimeline';
import { 
  User, 
  Building, 
  Phone, 
  Mail, 
  DollarSign, 
  Calendar,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  FileText,
  Plus,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface DealDetailModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailModal({ deal, open, onOpenChange }: DealDetailModalProps) {
  const { data: tasks = [] } = useDealTasks(deal?.deal_id);
  const { users } = useAdmin();
  const { data: admins = [] } = users;
  const createTask = useCreateDealTask();
  const updateDeal = useUpdateDeal();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: '',
    assigned_to: '',
  });

  if (!deal) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'text-success';
      case 'sent': return 'text-warning';
      case 'declined': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const handleCreateTask = () => {
    if (!taskForm.title.trim() || !deal) return;

    createTask.mutate({
      deal_id: deal.deal_id,
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      status: 'pending',
      assigned_to: taskForm.assigned_to || undefined,
      due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : undefined,
    });

    setTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      assigned_to: '',
    });
  };

  const handleUpdateDeal = (updates: any) => {
    if (!deal) return;
    updateDeal.mutate({ dealId: deal.deal_id, updates });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {deal.deal_title}
            <Badge className={`${deal.deal_priority === 'urgent' ? 'bg-destructive' : deal.deal_priority === 'high' ? 'bg-warning' : 'bg-secondary'}`}>
              {deal.deal_priority}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({deal.total_tasks})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Deal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Value:</span>
                    <span className="font-medium">{formatCurrency(deal.deal_value)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Probability:</span>
                    <span className="font-medium">{deal.deal_probability}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Source:</span>
                    <Badge variant="outline">{deal.deal_source}</Badge>
                  </div>
                  {deal.deal_expected_close_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Expected Close:</span>
                      <span className="font-medium">
                        {format(new Date(deal.deal_expected_close_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Listing Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Associated Listing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="font-medium">{deal.listing_title}</div>
                    <div className="text-sm text-muted-foreground">{deal.listing_location}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Revenue:</span>
                      <div className="font-medium">{formatCurrency(deal.listing_revenue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">EBITDA:</span>
                      <div className="font-medium">{formatCurrency(deal.listing_ebitda)}</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Listing
                  </Button>
                </CardContent>
              </Card>

              {/* Status Tracking */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Status Tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">NDA Status:</span>
                    <div className="flex items-center gap-2">
                      {deal.nda_status === 'signed' ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : deal.nda_status === 'sent' ? (
                        <MessageSquare className="h-4 w-4 text-warning" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`text-sm capitalize ${getStatusColor(deal.nda_status)}`}>
                        {deal.nda_status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Fee Agreement:</span>
                    <div className="flex items-center gap-2">
                      {deal.fee_agreement_status === 'signed' ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : deal.fee_agreement_status === 'sent' ? (
                        <MessageSquare className="h-4 w-4 text-warning" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`text-sm capitalize ${getStatusColor(deal.fee_agreement_status)}`}>
                        {deal.fee_agreement_status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Follow-up:</span>
                    <div className="flex items-center gap-2">
                      {deal.followed_up ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`text-sm ${deal.followed_up ? 'text-success' : 'text-muted-foreground'}`}>
                        {deal.followed_up ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assignment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Assignment</CardTitle>
                </CardHeader>
                <CardContent>
                  {deal.assigned_admin_name ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {deal.assigned_admin_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{deal.assigned_admin_name}</div>
                        <div className="text-xs text-muted-foreground">{deal.assigned_admin_email}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Not assigned</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deal.contact_name && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{deal.contact_name}</div>
                      {deal.contact_role && (
                        <div className="text-sm text-muted-foreground">{deal.contact_role}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {deal.contact_company && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div className="font-medium">{deal.contact_company}</div>
                  </div>
                )}
                
                {deal.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${deal.contact_email}`} className="text-primary hover:underline">
                      {deal.contact_email}
                    </a>
                  </div>
                )}
                
                {deal.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${deal.contact_phone}`} className="text-primary hover:underline">
                      {deal.contact_phone}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            {/* Create Task Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Create New Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="task-title">Title</Label>
                    <Input
                      id="task-title"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Task title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="task-priority">Priority</Label>
                    <Select 
                      value={taskForm.priority} 
                      onValueChange={(value: any) => setTaskForm(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="task-due-date">Due Date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="task-assigned-to">Assign To</Label>
                    <Select 
                      value={taskForm.assigned_to} 
                      onValueChange={(value) => setTaskForm(prev => ({ ...prev, assigned_to: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select admin" />
                      </SelectTrigger>
                      <SelectContent>
                        {admins.filter(admin => admin.is_admin).map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.first_name} {admin.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={handleCreateTask} disabled={!taskForm.title.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </CardContent>
            </Card>

            {/* Tasks List */}
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{task.title}</h4>
                          <Badge 
                            variant={task.status === 'completed' ? 'default' : 'outline'}
                          >
                            {task.status}
                          </Badge>
                          <Badge 
                            className={task.priority === 'urgent' ? 'bg-destructive' : task.priority === 'high' ? 'bg-warning' : 'bg-secondary'}
                          >
                            {task.priority}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.due_date && (
                            <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                          )}
                          <span>Created: {format(new Date(task.created_at), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks created yet
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <CommunicationTimeline 
              dealId={deal.deal_id}
              dealTitle={deal.deal_title}
              contactEmail={deal.contact_email}
              contactName={deal.contact_name}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}