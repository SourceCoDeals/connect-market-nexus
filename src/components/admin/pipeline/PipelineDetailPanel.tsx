
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, 
  User, 
  Building2, 
  Calendar, 
  DollarSign, 
  Percent, 
  AlertCircle,
  Phone,
  Mail,
  MessageSquare,
  Plus,
  CheckSquare,
  Circle,
  Clock,
  Target,
  TrendingUp,
  FileCheck,
  FileText,
  Send,
  Edit,
  Activity,
  ExternalLink,
  UserCheck,
  Trash2,
  BarChart3,
  Zap
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { useDealTasks, useCreateDealTask, useCompleteDealTask, useDeleteDealTask } from '@/hooks/admin/use-deal-tasks';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { CommunicationTimeline } from '@/components/admin/CommunicationTimeline';
import { DealInsightsCard } from './DealInsightsCard';
import { DocumentManagementCard } from './DocumentManagementCard';
import { QuickActionsCard } from './QuickActionsCard';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PipelineDetailPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineDetailPanel({ pipeline }: PipelineDetailPanelProps) {
  const { selectedDeal } = pipeline;
  const [activeTab, setActiveTab] = useState('overview');
  const [contactNote, setContactNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Hooks for real functionality
  const logContact = useLogDealContact();
  const { data: tasks = [], isLoading: tasksLoading } = useDealTasks(selectedDeal?.deal_id);
  const createTask = useCreateDealTask();
  const completeTask = useCompleteDealTask();
  const deleteTask = useDeleteDealTask();

  if (!selectedDeal) {
    return (
      <div className="w-[512px] border-l border-border bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto">
            <Target className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">No Deal Selected</p>
            <p className="text-sm text-muted-foreground">Choose a deal from the pipeline to view details</p>
          </div>
        </div>
      </div>
    );
  }

  // Apple/Stripe Design System Helpers
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    if (!buyerType) return 'Individual';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity': return 'Private Equity';
      case 'familyoffice': return 'Family Office';
      case 'searchfund': return 'Search Fund';
      case 'corporate': return 'Corporate';
      case 'individual': return 'Individual';
      case 'independentsponsor': return 'Independent Sponsor';
      default: return 'Individual';
    }
  };

  // Calculate metrics
  const taskProgress = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
  const daysInStage = (() => {
    if (selectedDeal.deal_stage_entered_at) {
      return Math.max(1, Math.floor((new Date().getTime() - new Date(selectedDeal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)));
    }
    return 1;
  })();

  // Action handlers
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await createTask.mutateAsync({
        deal_id: selectedDeal.deal_id,
        title: newTaskTitle,
        description: newTaskDescription || undefined,
        priority: newTaskPriority,
        due_date: newTaskDueDate || undefined
      });
      
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
      setNewTaskDueDate('');
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask.mutateAsync(taskId);
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleLogNote = async () => {
    if (!contactNote.trim()) return;
    
    setIsLoading(true);
    try {
      await logContact.mutateAsync({
        dealId: selectedDeal.deal_id,
        contactType: 'note',
        details: { note: contactNote }
      });
      setContactNote('');
    } catch (error) {
      console.error('Failed to log note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailContact = async () => {
    setIsLoading(true);
    try {
      await logContact.mutateAsync({
        dealId: selectedDeal.deal_id,
        contactType: 'email',
        details: { recipient: selectedDeal.contact_email }
      });
    } catch (error) {
      console.error('Failed to log email:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneContact = async () => {
    setIsLoading(true);
    try {
      await logContact.mutateAsync({
        dealId: selectedDeal.deal_id,
        contactType: 'phone',
        details: { phone: selectedDeal.contact_phone }
      });
    } catch (error) {
      console.error('Failed to log phone call:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-[512px] border-l border-border bg-background flex flex-col h-full">
      {/* Clean Header */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-lg font-medium text-foreground">
              {selectedDeal.listing_title || 'Business Opportunity'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedDeal.contact_company || selectedDeal.buyer_company || 'Private Investor'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pipeline.setSelectedDeal(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Essential Info Bar */}
        <div className="px-6 pb-6 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <span className="text-xs text-foreground">
              {getBuyerTypeLabel(selectedDeal.buyer_type)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Stage</span>
            <span className="text-xs text-foreground">{daysInStage}d in {selectedDeal.stage_name}</span>
          </div>
          {selectedDeal.deal_value && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Value</span>
              <span className="text-xs text-foreground">{formatCurrency(selectedDeal.deal_value)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Clean Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-4 mx-6 mt-6 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-sm">
              Contact
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-sm">
              Activity
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6 space-y-6 mt-0">
              {/* Key Metrics */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Deal Metrics</h4>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Value</div>
                    <div className="text-sm font-medium text-foreground">
                      {selectedDeal.deal_value ? formatCurrency(selectedDeal.deal_value) : 'TBD'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Probability</div>
                    <div className="text-sm font-medium text-foreground">{selectedDeal.deal_probability || 50}%</div>
                  </div>
                  {selectedDeal.deal_expected_close_date && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Expected Close</div>
                      <div className="text-sm font-medium text-foreground">
                        {format(new Date(selectedDeal.deal_expected_close_date), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  )}
                </div>
                
                {tasks.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Task Progress</div>
                    <Progress value={taskProgress} className="h-1.5" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {tasks.filter(t => t.status === 'completed').length} of {tasks.length} completed
                    </div>
                  </div>
                )}
              </div>

              {/* Deal Insights */}
              <DealInsightsCard dealId={selectedDeal.deal_id} />

              {/* Document Management */}
              <DocumentManagementCard 
                dealId={selectedDeal.deal_id}
                contactEmail={selectedDeal.contact_email}
                contactName={selectedDeal.contact_name}
                ndaStatus={selectedDeal.nda_status}
                feeAgreementStatus={selectedDeal.fee_agreement_status}
              />

              {/* Quick Actions */}
              <QuickActionsCard 
                dealId={selectedDeal.deal_id}
                contactEmail={selectedDeal.contact_email}
                contactPhone={selectedDeal.contact_phone}
                contactName={selectedDeal.contact_name}
              />
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="p-6 space-y-6 mt-0">
              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Contact Information</h4>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Name</div>
                    <div className="text-sm font-medium text-foreground">
                      {selectedDeal.contact_name || 'Not provided'}
                    </div>
                  </div>
                  
                  {selectedDeal.contact_email && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Email</div>
                      <div className="text-sm text-foreground">{selectedDeal.contact_email}</div>
                    </div>
                  )}
                  
                  {selectedDeal.contact_phone && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Phone</div>
                      <div className="text-sm text-foreground">{selectedDeal.contact_phone}</div>
                    </div>
                  )}
                  
                  {selectedDeal.contact_company && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Company</div>
                      <div className="text-sm text-foreground">{selectedDeal.contact_company}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Add Note */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Add Note</h4>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add a note about this contact..."
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <Button 
                    onClick={handleLogNote} 
                    disabled={!contactNote.trim() || isLoading}
                    size="sm"
                    className="w-full"
                  >
                    Add Note
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="p-6 space-y-6 mt-0">
              {/* Add Task */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Add Task</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Task title..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Description (optional)..."
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={newTaskPriority} onValueChange={(value: 'low' | 'medium' | 'high') => setNewTaskPriority(value)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="datetime-local"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleCreateTask} 
                    disabled={!newTaskTitle.trim() || createTask.isPending}
                    size="sm"
                    className="w-full"
                  >
                    Create Task
                  </Button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Tasks ({tasks.length})</h4>
                {tasksLoading ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">No tasks yet</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => task.status === 'completed' ? null : handleCompleteTask(task.id)}
                          disabled={task.status === 'completed'}
                          className="p-0 h-auto min-w-0 w-5 h-5"
                        >
                          {task.status === 'completed' ? (
                            <CheckSquare className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "text-sm font-medium",
                            task.status === 'completed' ? "line-through text-muted-foreground" : "text-foreground"
                          )}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {task.priority && task.priority !== 'medium' && (
                              <span className={cn(
                                "text-xs",
                                task.priority === 'high' ? 'text-red-600' : 'text-muted-foreground'
                              )}>
                                {task.priority}
                              </span>
                            )}
                            {task.due_date && (
                              <div className="text-xs text-muted-foreground">
                                Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 h-auto text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="p-6 mt-0">
              <CommunicationTimeline 
                dealId={selectedDeal.deal_id}
                dealTitle={selectedDeal.listing_title || 'Business Opportunity'}
                contactEmail={selectedDeal.contact_email}
                contactName={selectedDeal.contact_name}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
