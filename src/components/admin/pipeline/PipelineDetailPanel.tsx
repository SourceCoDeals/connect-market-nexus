import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, 
  User, 
  Building2, 
  Calendar, 
  DollarSign, 
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
import { BuyerInvestmentCriteria } from './BuyerInvestmentCriteria';
import { BuyerPriorityScore } from './BuyerPriorityScore';
import { ContactIntelligence } from './ContactIntelligence';
import { useBuyerProfile, useDocumentLogs } from '@/hooks/admin/use-deal-real-data';
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
  
  // Real data hooks
  const { data: buyerProfile } = useBuyerProfile(selectedDeal?.deal_id);
  const { data: documentLogs } = useDocumentLogs(selectedDeal?.deal_id);

  if (!selectedDeal) {
    return (
      <div className="relative h-full bg-white border-l" style={{ width: '640px' }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center mx-auto">
              <Target className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">No Deal Selected</p>
              <p className="text-xs text-gray-500 mt-1">Choose a deal from the pipeline to view details</p>
            </div>
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
      const recipientEmail = buyerProfile?.buyerInfo?.email || selectedDeal.buyer_email;
      await logContact.mutateAsync({
        dealId: selectedDeal.deal_id,
        contactType: 'email',
        details: { recipient: recipientEmail }
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
        details: { phone: buyerProfile?.buyerInfo?.phone_number }
      });
    } catch (error) {
      console.error('Failed to log phone call:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-full bg-white border-l" style={{ width: '640px' }}>
      <div className="flex flex-col h-full">
        {/* Apple/Stripe Clean Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-gray-100">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-gray-900">
              {selectedDeal.listing_title || 'Business Opportunity'}
            </h1>
            <p className="text-sm text-gray-600">
              {selectedDeal.contact_company || 'No company specified'}
            </p>
          </div>

          {/* Essential Metrics - Single Row */}
          <div className="mt-4 flex items-center gap-8 text-sm">
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
          <div className="border-b border-gray-100 px-8">
            <TabsList className="grid w-64 grid-cols-4 bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-500 data-[state=active]:text-blue-600"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-500 data-[state=active]:text-blue-600"
              >
                Contact
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-500 data-[state=active]:text-blue-600"
              >
                Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm font-medium text-gray-500 data-[state=active]:text-blue-600"
              >
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Overview Tab - Buyer-Focused Design */}
            <TabsContent value="overview" className="p-8 space-y-8 h-full overflow-y-auto mt-0">
              {/* Buyer Profile Section - Primary Focus */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Buyer Profile</h3>
                
                {buyerProfile?.buyerInfo ? (
                  <div className="space-y-6">
                    {/* Buyer Identity */}
                    <div className="flex items-start gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-blue-50 text-blue-600 text-sm font-medium">
                          {buyerProfile.buyerInfo.name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-gray-900">
                          {buyerProfile.buyerInfo.name || 'Name not available'}
                        </p>
                        <p className="text-sm text-gray-600">{buyerProfile.buyerInfo.company || 'Company not specified'}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">{getBuyerTypeLabel(buyerProfile.buyerInfo.buyer_type)}</p>
                          {!buyerProfile.isRegisteredUser && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              Lead
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Original Buyer Message/Interest */}
                    {buyerProfile.user_message && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Original Interest Message</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{buyerProfile.user_message}</p>
                      </div>
                    )}

                     {/* Buyer Priority Score */}
                    <BuyerPriorityScore 
                      score={selectedDeal.buyer_priority_score || 0}
                      buyerType={buyerProfile.buyerInfo.buyer_type}
                    />

                    {/* Investment Criteria */}
                    <BuyerInvestmentCriteria 
                      buyerProfile={buyerProfile.buyerInfo}
                    />

                    {/* Contact Intelligence */}
                    <ContactIntelligence 
                      buyerProfile={buyerProfile.buyerInfo}
                      dealData={selectedDeal}
                    />
                  </div>
                ) : selectedDeal.buyer_name ? (
                  // Fallback to deal data if buyerProfile is loading
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-blue-50 text-blue-600 text-sm font-medium">
                          {selectedDeal.buyer_name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-gray-900">{selectedDeal.buyer_name}</p>
                        <p className="text-sm text-gray-600">{selectedDeal.buyer_company || 'Company not specified'}</p>
                        <p className="text-xs text-gray-500">{getBuyerTypeLabel(selectedDeal.buyer_type)}</p>
                      </div>
                    </div>
                    
                     {/* Basic Priority Score for Fallback */}
                    <BuyerPriorityScore 
                      score={selectedDeal.buyer_priority_score || 0}
                      buyerType={selectedDeal.buyer_type}
                    />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {selectedDeal.buyer_email && (
                        <div>
                          <p className="text-gray-500 text-xs">Email</p>
                          <p className="text-gray-900">{selectedDeal.buyer_email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No buyer profile available</p>
                  </div>
                )}
              </div>

              {/* Document Status - Clean */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Document Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">NDA</span>
                    <span className="text-sm text-gray-600 capitalize">
                      {selectedDeal.nda_status?.replace('_', ' ') || 'Not sent'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Fee Agreement</span>
                    <span className="text-sm text-gray-600 capitalize">
                      {selectedDeal.fee_agreement_status?.replace('_', ' ') || 'Not sent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contextual Quick Actions */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={handleEmailContact}
                    disabled={!buyerProfile?.buyerInfo?.email && !selectedDeal.buyer_email}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email Buyer
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={handlePhoneContact}
                    disabled={!buyerProfile?.buyerInfo?.phone_number}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Log Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={() => setActiveTab('tasks')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={() => setActiveTab('activity')}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    View Activity
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Contact Tab - Clean Design */}
            <TabsContent value="contact" className="p-8 space-y-8 h-full overflow-y-auto mt-0">
              {/* Real Buyer Contact Info */}
              {buyerProfile?.buyerInfo ? (
                <div className="space-y-6">
                  <h3 className="text-sm font-medium text-gray-900">Buyer Contact Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Name</span>
                      <span className="text-sm font-medium text-gray-900">
                        {buyerProfile.buyerInfo.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Email</span>
                      <span className="text-sm text-gray-900">{buyerProfile.buyerInfo.email}</span>
                    </div>
                    
                    {buyerProfile.buyerInfo.phone_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Phone</span>
                        <span className="text-sm text-gray-900">{buyerProfile.buyerInfo.phone_number}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Company</span>
                      <span className="text-sm text-gray-900">{buyerProfile.buyerInfo.company}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Type</span>
                      <span className="text-sm text-gray-900">{getBuyerTypeLabel(buyerProfile.buyerInfo.buyer_type)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">User Type</span>
                      <span className="text-sm text-gray-900">
                        {buyerProfile.isRegisteredUser ? 'Registered User' : 'Lead'}
                      </span>
                    </div>
                    
                    {buyerProfile.buyerInfo.website && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Website</span>
                        <a 
                          href={buyerProfile.buyerInfo.website.startsWith('http') ? buyerProfile.buyerInfo.website : `https://${buyerProfile.buyerInfo.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          {buyerProfile.buyerInfo.website}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    
                    {buyerProfile.buyerInfo.linkedin_profile && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">LinkedIn</span>
                        <a 
                          href={buyerProfile.buyerInfo.linkedin_profile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View Profile
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedDeal.buyer_name ? (
                // Fallback to deal data
                <div className="space-y-6">
                  <h3 className="text-sm font-medium text-gray-900">Buyer Contact Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Name</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDeal.buyer_name}</span>
                    </div>
                    {selectedDeal.buyer_email && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Email</span>
                        <span className="text-sm text-gray-900">{selectedDeal.buyer_email}</span>
                      </div>
                    )}
                    {selectedDeal.buyer_company && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Company</span>
                        <span className="text-sm text-gray-900">{selectedDeal.buyer_company}</span>
                      </div>
                    )}
                    {selectedDeal.buyer_type && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Type</span>
                        <span className="text-sm text-gray-900">{getBuyerTypeLabel(selectedDeal.buyer_type)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No buyer contact details available</p>
                </div>
              )}

              {/* Add Contact Note */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Add Contact Note</h3>
                <div className="space-y-3">
                  <Textarea
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    placeholder="Add notes about your interaction with this buyer..."
                    className="min-h-[80px] resize-none"
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
                    />
                    <Select value={newTaskPriority} onValueChange={(value: any) => setNewTaskPriority(value)}>
                      <SelectTrigger>
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
                    rows={3}
                  />
                  
                  <div className="flex gap-3">
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
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

                {/* Task List */}
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
    </div>
  );
}