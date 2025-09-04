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
import { DocumentStatus } from './DocumentStatus';
import { EnhancedActivityTimeline } from './EnhancedActivityTimeline';
import { useBuyerProfile, useDocumentLogs } from '@/hooks/admin/use-deal-real-data';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { BuyerProfileSection } from './BuyerProfileSection';


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
        <div className="h-12 border-b bg-background px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-foreground truncate">
              {selectedDeal.listing_title || selectedDeal.buyer_name || 'Untitled Deal'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedDeal.deal_value ? formatCurrency(selectedDeal.deal_value) : 'Value TBD'}
            </span>
            <span className="text-xs text-muted-foreground">
              {selectedDeal.deal_probability || 0}%
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {daysInStage}d
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4 mx-4 mt-3 mb-2 h-8">
              <TabsTrigger value="overview" className="text-xs h-7">Overview</TabsTrigger>
              <TabsTrigger value="contact" className="text-xs h-7">Contact</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs h-7">Tasks</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs h-7">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 p-4 pt-2">
              <BuyerProfileSection
                buyerProfile={buyerProfile}
                selectedDeal={selectedDeal}
                onEmailContact={handleEmailContact}
                onPhoneContact={handlePhoneContact}
                onLogNote={handleLogNote}
              />
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

            {/* Activity Tab - Enhanced Timeline with Document Attribution */}
            <TabsContent value="activity" className="p-8 mt-0">
              <EnhancedActivityTimeline 
                dealId={selectedDeal.deal_id}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}