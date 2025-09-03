
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
import { RealCommunicationTimeline } from './RealCommunicationTimeline';
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
    <div className="relative h-full bg-white border-l border-gray-200/60" style={{ width: '640px' }}>
      {!selectedDeal ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm font-medium">Select a deal to view details</p>
            <p className="text-xs text-gray-400 mt-1">Choose from the pipeline to get started</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Clean Header */}
          <div className="flex-shrink-0 p-8 border-b border-gray-200/40">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedDeal.listing_title || 'Business Opportunity'}
              </h2>
              <p className="text-sm text-gray-600">
                {selectedDeal.contact_company || 'No company specified'}
              </p>
            </div>

            {/* Essential Info - Clean Layout */}
            <div className="mt-6 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Stage</span>
                <span className="font-medium text-gray-900">{selectedDeal.stage_name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Value</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(selectedDeal.deal_value || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Days in Stage</span>
                <span className="font-medium text-gray-900">{daysInStage}d</span>
              </div>
            </div>
          </div>
        {/* Clean Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b border-gray-200/40 px-8">
            <TabsList className="grid w-64 grid-cols-4 bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-600 data-[state=active]:text-blue-600"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-600 data-[state=active]:text-blue-600"
              >
                Contact
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-600 data-[state=active]:text-blue-600"
              >
                Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-600 data-[state=active]:text-blue-600"
              >
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Overview Tab - Clean & Minimal */}
            <TabsContent value="overview" className="p-8 space-y-8 h-full overflow-y-auto mt-0">
              {/* Key Metrics - Clean Grid */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Task Progress</p>
                  <p className="text-2xl font-semibold text-gray-900">{Math.round(taskProgress)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Probability</p>
                  <p className="text-2xl font-semibold text-gray-900">{selectedDeal.deal_probability || 50}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Expected Close</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {selectedDeal.deal_expected_close_date ? format(new Date(selectedDeal.deal_expected_close_date), 'MMM dd') : 'TBD'}
                  </p>
                </div>
              </div>

              {/* Clean Document Status */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Documents</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                      <span className="text-sm text-gray-900">NDA</span>
                    </div>
                    <span className="text-sm text-gray-600 capitalize">
                      {selectedDeal.nda_status?.replace('_', ' ') || 'Not sent'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                      <span className="text-sm text-gray-900">Fee Agreement</span>
                    </div>
                    <span className="text-sm text-gray-600 capitalize">
                      {selectedDeal.fee_agreement_status?.replace('_', ' ') || 'Not sent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean Actions */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" className="justify-start">
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <Phone className="w-4 h-4 mr-2" />
                    Log Call
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Meeting
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Contact Tab - Clean Layout */}
            <TabsContent value="contact" className="p-8 space-y-8 h-full overflow-y-auto mt-0">
              <div className="space-y-6">
                <h3 className="text-sm font-medium text-gray-900">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">Name</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedDeal.contact_name || 'Unknown Contact'}
                    </span>
                  </div>
                  
                  {selectedDeal.contact_email && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Email</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDeal.contact_email}</span>
                    </div>
                  )}
                  
                  {selectedDeal.contact_phone && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Phone</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDeal.contact_phone}</span>
                    </div>
                  )}
                  
                  {selectedDeal.contact_company && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Company</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDeal.contact_company}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Add Note</h3>
                <div className="space-y-3">
                  <Textarea
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    placeholder="Add notes about this contact..."
                    className="min-h-[80px] resize-none border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button 
                    onClick={handleLogNote}
                    disabled={!contactNote.trim() || logContact.isPending}
                    size="sm"
                  >
                    {logContact.isPending ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tasks Tab - Clean Interface */}
            <TabsContent value="tasks" className="p-8 space-y-8 h-full overflow-y-auto mt-0">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Create Task</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Select value={newTaskPriority} onValueChange={(value: any) => setNewTaskPriority(value)}>
                      <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Task description"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    rows={3}
                  />
                  
                  <div className="flex gap-3">
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Button 
                      onClick={handleCreateTask}
                      disabled={!newTaskTitle.trim() || createTask.isPending}
                      size="sm"
                    >
                      {createTask.isPending ? 'Creating...' : 'Create Task'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Tasks</h3>
                
                {tasksLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No tasks yet</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={completeTask.isPending}
                          className="h-auto p-0 hover:bg-transparent mt-0.5"
                        >
                          {task.status === 'completed' ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                          )}
                        </Button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={cn(
                              "text-sm font-medium",
                              task.status === 'completed' ? "line-through text-gray-500" : "text-gray-900"
                            )}>
                              {task.title}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deleteTask.isPending}
                              className="text-gray-400 hover:text-red-600 h-auto p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className={cn(
                              "font-medium",
                              task.priority === 'high' && "text-red-600",
                              task.priority === 'medium' && "text-yellow-600",
                              task.priority === 'low' && "text-green-600"
                            )}>
                              {task.priority}
                            </span>
                            {task.due_date && (
                              <span>Due {format(new Date(task.due_date), 'MMM dd')}</span>
                            )}
                            {task.status === 'completed' && task.completed_at && (
                              <span>Completed {format(new Date(task.completed_at), 'MMM dd')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Activity Tab - Real Timeline */}
            <TabsContent value="activity" className="p-8 mt-0">
              <RealCommunicationTimeline 
                dealId={selectedDeal.deal_id}
              />
            </TabsContent>
          </div>
        </Tabs>
        </div>
      )}
    </div>
  );
}
