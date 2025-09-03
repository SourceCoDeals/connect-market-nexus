
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
      <div className="w-96 border-l bg-gradient-to-b from-gray-50/50 to-white backdrop-blur-sm flex items-center justify-center">
        <div className="text-center space-y-3 p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900">No Deal Selected</p>
            <p className="text-sm text-gray-500 mt-1">Choose a deal from the pipeline to view details</p>
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

  const getBuyerTypeColor = (buyerType?: string) => {
    if (!buyerType) return 'bg-gray-50 text-gray-700 border-gray-200/60';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity': return 'bg-purple-50 text-purple-800 border-purple-200/60';
      case 'familyoffice': return 'bg-blue-50 text-blue-800 border-blue-200/60';
      case 'searchfund': return 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
      case 'corporate': return 'bg-orange-50 text-orange-800 border-orange-200/60';
      case 'individual': return 'bg-gray-50 text-gray-700 border-gray-200/60';
      case 'independentsponsor': return 'bg-indigo-50 text-indigo-800 border-indigo-200/60';
      default: return 'bg-gray-50 text-gray-700 border-gray-200/60';
    }
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

  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'sent': return 'bg-blue-50 text-blue-600 border-blue-200/60';
      case 'declined': return 'bg-red-50 text-red-700 border-red-200/60';
      default: return 'bg-gray-50 text-gray-500 border-gray-200/60';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'signed': return 'Signed';
      case 'sent': return 'Sent';
      case 'declined': return 'Declined';
      default: return 'Not Sent';
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
    <div className="w-96 border-l bg-white/95 backdrop-blur-sm flex flex-col h-full">
      {/* Premium Header */}
      <div className="border-b border-gray-200/40 bg-gradient-to-r from-gray-50/40 to-white/80">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Deal Details</h3>
              <p className="text-xs text-gray-500">Complete Overview</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pipeline.setSelectedDeal(null)}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Deal Header */}
        <div className="px-4 pb-4 space-y-3">
          <div>
            <h4 className="font-semibold text-lg text-gray-900 leading-tight">
              {selectedDeal.listing_title || 'Business Opportunity'}
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {selectedDeal.contact_company || selectedDeal.buyer_company || 'Private Investor'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={cn("px-2.5 py-1 text-xs font-medium border rounded-md", getBuyerTypeColor(selectedDeal.buyer_type))}>
              {getBuyerTypeLabel(selectedDeal.buyer_type)}
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{daysInStage}d in {selectedDeal.stage_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-4 mx-4 mt-4 bg-gray-50/80 p-1 rounded-lg border border-gray-200/50">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              Overview
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              Contact
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              Activity
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-4 space-y-4 mt-0">
              {/* Key Metrics */}
              <Card className="border-gray-200/60 shadow-sm bg-white/60 rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-600" />
                    Key Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Deal Value</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedDeal.deal_value ? formatCurrency(selectedDeal.deal_value) : 'TBD'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Probability</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedDeal.deal_probability || 50}%</p>
                    </div>
                  </div>
                  
                  {selectedDeal.deal_expected_close_date && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Expected Close</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {format(new Date(selectedDeal.deal_expected_close_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                  
                  {tasks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Task Progress</p>
                      <Progress value={taskProgress} className="h-2" />
                      <p className="text-xs text-gray-600 mt-1">
                        {tasks.filter(t => t.status === 'completed').length} of {tasks.length} completed
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

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
            <TabsContent value="contact" className="p-4 space-y-4 mt-0">
              <Card className="border-gray-200/60 shadow-sm bg-white/60 rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-600" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Contact Name</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedDeal.contact_name || 'Not provided'}
                    </p>
                  </div>
                  
                  {selectedDeal.contact_email && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Email</p>
                      <p className="text-sm text-gray-900">{selectedDeal.contact_email}</p>
                    </div>
                  )}
                  
                  {selectedDeal.contact_phone && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Phone</p>
                      <p className="text-sm text-gray-900">{selectedDeal.contact_phone}</p>
                    </div>
                  )}
                  
                  {selectedDeal.contact_company && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Company</p>
                      <p className="text-sm text-gray-900">{selectedDeal.contact_company}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Note */}
              <Card className="border-gray-200/60 shadow-sm bg-white/60 rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-600" />
                    Add Note
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Add a note about this contact..."
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <Button 
                    onClick={handleLogNote} 
                    disabled={!contactNote.trim() || isLoading}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="p-4 space-y-4 mt-0">
              {/* Add Task */}
              <Card className="border-gray-200/60 shadow-sm bg-white/60 rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-gray-600" />
                    Add Task
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Task title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Task description (optional)"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newTaskPriority} onValueChange={(value: any) => setNewTaskPriority(value)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleCreateTask} 
                    disabled={!newTaskTitle.trim()}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </CardContent>
              </Card>

              {/* Task List */}
              <div className="space-y-2">
                {tasksLoading ? (
                  <div className="text-center py-4">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-gray-500 mt-2">Loading tasks...</p>
                  </div>
                ) : tasks.length > 0 ? (
                  tasks.map((task) => (
                    <Card key={task.id} className="border-gray-200/60 shadow-sm bg-white/60 rounded-lg">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => handleCompleteTask(task.id)}
                            >
                              {task.status === 'completed' ? (
                                <CheckSquare className="w-4 h-4 text-green-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400" />
                              )}
                            </Button>
                            <div className="flex-1">
                              <p className={cn("text-sm font-medium", task.status === 'completed' && "line-through text-gray-500")}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {task.priority}
                                </Badge>
                                {task.due_date && (
                                  <span className="text-xs text-gray-500">
                                    Due {format(new Date(task.due_date), 'MMM dd')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto text-gray-400 hover:text-red-600"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No tasks yet</p>
                    <p className="text-xs text-gray-400">Create your first task above</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="p-4 mt-0">
              <CommunicationTimeline 
                dealId={selectedDeal.deal_id}
                dealTitle={selectedDeal.listing_title || 'Deal'}
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
