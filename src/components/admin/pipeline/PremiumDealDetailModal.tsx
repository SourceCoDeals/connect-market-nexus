import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Clock, 
  MessageSquare,
  Target,
  TrendingUp,
  FileCheck,
  Send,
  Plus,
  Activity,
  ExternalLink,
  CheckSquare,
  Circle,
  Trash2,
  ShieldCheck,
  DollarSign,
  Star
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { useDealTasks, useCreateDealTask, useUpdateDealTask, useCompleteDealTask, useDeleteDealTask } from '@/hooks/admin/use-deal-tasks';
import { useBuyerProfile } from '@/hooks/admin/use-deal-real-data';

import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PremiumDealDetailModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PremiumDealDetailModal({ deal, open, onOpenChange }: PremiumDealDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [contactNote, setContactNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Task management state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  
  // Hooks
  const { toast } = useToast();
  const logContact = useLogDealContact();
  const { data: tasks = [], isLoading: tasksLoading } = useDealTasks(deal?.deal_id);
  const createTask = useCreateDealTask();
  const updateTask = useUpdateDealTask();
  const completeTask = useCompleteDealTask();
  const deleteTask = useDeleteDealTask();
  
  
  // Real buyer data
  const { data: buyerProfile, isLoading: isBuyerProfileLoading } = useBuyerProfile(deal?.deal_id);

  if (!deal) return null;

  // Helper functions
  const getBuyerTypeColor = (buyerType?: string) => {
    if (!buyerType) return 'bg-background text-muted-foreground border-border/60';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'familyoffice':
        return 'bg-blue-50 text-blue-700 border-blue-200/60';
      case 'searchfund':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'corporate':
        return 'bg-orange-50 text-orange-700 border-orange-200/60';
      case 'individual':
        return 'bg-muted text-muted-foreground border-border/60';
      case 'independentsponsor':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
      default:
        return 'bg-muted text-muted-foreground border-border/60';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    if (!buyerType) return 'Individual';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity': return 'Private Equity';
      case 'familyoffice': return 'Family Office';
      case 'searchfund': return 'Search Fund';
      case 'corporate': return 'Corporate Buyer';
      case 'individual': return 'Individual Investor';
      case 'independentsponsor': return 'Independent Sponsor';
      default: return 'Individual';
    }
  };

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    }
    if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(0)}K`;
    }
    return `$${numValue.toLocaleString()}`;
  };

  // Calculate metrics
  const daysInStage = (() => {
    if (deal.deal_stage_entered_at) {
      return Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)));
    }
    if (deal.deal_created_at) {
      return Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_created_at).getTime()) / (1000 * 60 * 60 * 24)));
    }
    return 1;
  })();

  // Priority score calculation
  const getPriorityScore = (buyerType?: string) => {
    const type = buyerType?.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity': return 5;
      case 'familyoffice': return 4;
      case 'searchfund': return 4;
      case 'corporate': return 3;
      case 'independentsponsor': return 3;
      default: return 1;
    }
  };

  // Task management functions
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await createTask.mutateAsync({
        deal_id: deal.deal_id,
        title: newTaskTitle,
        description: newTaskDescription || undefined,
        priority: newTaskPriority,
        due_date: newTaskDueDate || undefined
      });
      
      // Reset form
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

  // Contact handlers
  const handleLogNote = async () => {
    if (!contactNote.trim()) return;
    
    setIsLoading(true);
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
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
        dealId: deal.deal_id,
        contactType: 'email',
        details: { recipient: deal.contact_email || deal.buyer_email }
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
        dealId: deal.deal_id,
        contactType: 'phone',
        details: { phone: deal.contact_phone }
      });
    } catch (error) {
      console.error('Failed to log phone call:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentToggle = async (docType: 'nda' | 'fee_agreement', currentStatus: string) => {
    const newStatus = currentStatus === 'signed' ? 'not_sent' : 'signed';
    
    try {
      toast({
        title: 'Document Status Updated',
        description: `${docType.toUpperCase()} status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Failed to update document status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document status',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-background border border-border shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Hero Message Section */}
          {buyerProfile?.originalMessage && (
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 mb-6 -mt-6 -mx-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-3">Interest Message</h3>
                  <blockquote className="text-foreground/90 leading-relaxed font-medium border-l-4 border-primary/20 pl-4 text-sm">
                    "{buyerProfile.originalMessage}"
                  </blockquote>
                  {buyerProfile?.buyerInfo?.name && (
                    <p className="text-sm text-primary mt-3 font-medium">
                      — {buyerProfile.buyerInfo.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <DialogHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {deal.listing_title || 'Business Acquisition Opportunity'}
                </DialogTitle>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground font-medium">
                    {deal.contact_company || deal.buyer_company || 'Private Investor'}
                  </p>
                  <Badge className={cn("px-2 py-1 text-xs font-medium border", getBuyerTypeColor(deal.buyer_type))}>
                    {getBuyerTypeLabel(deal.buyer_type)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-primary">
                      Priority {getPriorityScore(deal.buyer_type)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Key metrics */}
            <div className="flex items-center gap-6 text-sm pt-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Revenue:</span>
                <span className="font-medium text-foreground">
                  {deal.listing_revenue ? formatCurrency(deal.listing_revenue) : 'Confidential'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Stage:</span>
                <span className="font-medium text-foreground">{deal.stage_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Days:</span>
                <span className="font-medium text-foreground">{daysInStage}</span>
              </div>
            </div>
          </DialogHeader>

          {/* Unified Actions Bar */}
          <div className="bg-muted/30 border border-border/50 rounded-lg p-4 my-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Contact Actions */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmailContact}
                  disabled={!deal.contact_email && !deal.buyer_email}
                  className="gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePhoneContact}
                  disabled={!deal.contact_phone}
                  className="gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </Button>
                
                {/* Document Actions */}
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">NDA</span>
                    <Switch
                      checked={deal.nda_status === 'signed'}
                      onCheckedChange={() => handleDocumentToggle('nda', deal.nda_status || 'not_sent')}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Fee</span>
                    <Switch
                      checked={deal.fee_agreement_status === 'signed'}
                      onCheckedChange={() => handleDocumentToggle('fee_agreement', deal.fee_agreement_status || 'not_sent')}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </div>
              
              {/* Add Note */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('contact')}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="w-4 h-4" />
                Add Note
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg border border-border/20">
                <TabsTrigger 
                  value="overview" 
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="contact" 
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Contact
                </TabsTrigger>
                <TabsTrigger 
                  value="tasks" 
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Tasks
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Activity
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-0">
                  {/* Buyer Profile Card */}
                  {buyerProfile && (
                    <Card className="border border-border/50 shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {buyerProfile.buyerInfo?.name || deal.contact_name || deal.buyer_name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {buyerProfile.buyerInfo?.company || deal.contact_company || deal.buyer_company}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {buyerProfile.buyerInfo?.email && (
                            <div>
                              <span className="text-muted-foreground">Email:</span>
                              <p className="font-medium text-foreground">{buyerProfile.buyerInfo.email}</p>
                            </div>
                          )}
                          {buyerProfile.buyerInfo?.fund_size && (
                            <div>
                              <span className="text-muted-foreground">Fund Size:</span>
                              <p className="font-medium text-foreground">{formatCurrency(buyerProfile.buyerInfo.fund_size)}</p>
                            </div>
                          )}
                          {buyerProfile.buyerInfo?.target_deal_size_min && (
                            <div>
                              <span className="text-muted-foreground">Target Size:</span>
                              <p className="font-medium text-foreground">{formatCurrency(buyerProfile.buyerInfo.target_deal_size_min)}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Business Details */}
                  <Card className="border border-border/50 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-foreground">Business Details</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Name</span>
                            <p className="text-sm font-medium text-foreground mt-1">{deal.listing_title}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buyer Organization</span>
                            <p className="text-sm font-medium text-foreground mt-1">
                              {deal.contact_company || deal.buyer_company || 'Private Investor'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {deal.listing_revenue && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Annual Revenue</span>
                              <p className="text-sm font-medium text-foreground mt-1">{formatCurrency(deal.listing_revenue)}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Stage</span>
                            <p className="text-sm font-medium text-foreground mt-1">{deal.stage_name}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Contact Tab */}
                <TabsContent value="contact" className="space-y-6 mt-0">
                  <Card className="border border-border/50 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-foreground mb-4">Contact Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>
                          <p className="font-medium text-foreground">{deal.contact_name || deal.buyer_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Company:</span>
                          <p className="font-medium text-foreground">{deal.contact_company || deal.buyer_company}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <p className="font-medium text-foreground">{deal.contact_email || deal.buyer_email}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <p className="font-medium text-foreground">{deal.contact_phone || 'Not provided'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/50 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-foreground mb-4">Add Contact Note</h3>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Enter your note..."
                          value={contactNote}
                          onChange={(e) => setContactNote(e.target.value)}
                          rows={3}
                        />
                        <Button 
                          onClick={handleLogNote}
                          disabled={!contactNote.trim() || isLoading}
                          className="w-full"
                        >
                          {isLoading ? 'Adding Note...' : 'Add Note'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="space-y-6 mt-0">
                  {/* Create Task */}
                  <Card className="border border-border/50 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-foreground mb-4">Create New Task</h3>
                      <div className="space-y-4">
                        <Input
                          placeholder="Task title..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                        />
                        <Textarea
                          placeholder="Task description..."
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-4">
                          <Select value={newTaskPriority} onValueChange={(value: any) => setNewTaskPriority(value)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="w-40"
                          />
                          <Button 
                            onClick={handleCreateTask}
                            disabled={!newTaskTitle.trim()}
                            className="gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Create Task
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Task List */}
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <Card key={task.id} className="border border-border/50 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCompleteTask(task.id)}
                                className="p-0 h-auto"
                              >
                                {task.status === 'completed' ? (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground" />
                                )}
                              </Button>
                              <div>
                                <p className={cn(
                                  "font-medium",
                                  task.status === 'completed' ? "line-through text-muted-foreground" : "text-foreground"
                                )}>
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground">{task.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}>
                                {task.priority}
                              </Badge>
                              {task.due_date && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(task.due_date), 'MMM d')}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-0 h-auto text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-6 mt-0">
                  <Card className="border border-border/50 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-foreground">Activity Timeline</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Activity tracking coming soon...</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}