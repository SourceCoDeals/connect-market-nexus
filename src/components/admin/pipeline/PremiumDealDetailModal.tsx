import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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
  Edit,
  Plus,
  Activity,
  ExternalLink,
  CheckSquare,
  Circle,
  UserCheck,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { useDealTasks, useCreateDealTask, useUpdateDealTask, useCompleteDealTask, useDeleteDealTask } from '@/hooks/admin/use-deal-tasks';
import { useBuyerProfile } from '@/hooks/admin/use-deal-real-data';
import { BuyerProfileSection } from './BuyerProfileSection';
import { BuyerMessageHero } from './BuyerMessageHero';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const logContact = useLogDealContact();
  const { data: tasks = [], isLoading: tasksLoading } = useDealTasks(deal?.deal_id);
  const createTask = useCreateDealTask();
  const updateTask = useUpdateDealTask();
  const completeTask = useCompleteDealTask();
  const deleteTask = useDeleteDealTask();
  
  // Real buyer data
  const { data: buyerProfile, isLoading: isBuyerProfileLoading } = useBuyerProfile(deal?.deal_id);

  if (!deal) return null;

  // Apple/Stripe style helper functions - Clean, minimal design
  const getBuyerTypeColor = (buyerType?: string) => {
    if (!buyerType) return 'bg-slate-50 text-slate-700 border-slate-200/60';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'bg-purple-50 text-purple-800 border-purple-200/60';
      case 'familyoffice':
        return 'bg-blue-50 text-blue-800 border-blue-200/60';
      case 'searchfund':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
      case 'corporate':
        return 'bg-orange-50 text-orange-800 border-orange-200/60';
      case 'individual':
        return 'bg-slate-50 text-slate-700 border-slate-200/60';
      case 'independentsponsor':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200/60';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/60';
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

  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'sent':
        return 'bg-slate-50 text-slate-600 border-slate-200/60';
      case 'declined':
        return 'bg-red-50 text-red-700 border-red-200/60';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200/60';
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

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  // Calculate progress and metrics using real task data
  const taskProgress = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
  const daysInStage = (() => {
    if (deal.deal_stage_entered_at) {
      return Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)));
    }
    if (deal.deal_created_at) {
      return Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_created_at).getTime()) / (1000 * 60 * 60 * 24)));
    }
    return 1;
  })();

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

  // Contact handlers with real functionality
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden bg-white/98 backdrop-blur-xl border border-border/30 shadow-2xl rounded-2xl">
        <div className="flex flex-col h-full">
          {/* Premium Header - Apple/Stripe Level */}
          <DialogHeader className="border-b border-border/5 pb-6 bg-gradient-to-r from-gray-50/40 to-white/60 -m-6 px-6 pt-6 rounded-t-2xl">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-semibold text-gray-900 leading-tight tracking-tight">
                    {deal.listing_title || 'Business Acquisition Opportunity'}
                  </DialogTitle>
                  <p className="text-sm text-gray-600 font-medium">
                    {deal.contact_company || deal.buyer_company || 'Private Investor'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={cn("px-3 py-1.5 text-sm font-medium border rounded-lg", getBuyerTypeColor(deal.buyer_type))}>
                    {getBuyerTypeLabel(deal.buyer_type)}
                  </Badge>
                </div>
              </div>
              
              {/* Key metrics row - Clean Apple-style */}
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</p>
                    <p className="text-base font-semibold text-gray-900 leading-tight">
                      {deal.listing_revenue ? formatCurrency(deal.listing_revenue) : 'Confidential'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stage</p>
                    <p className="text-base font-semibold text-gray-900 leading-tight">{deal.stage_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time in Stage</p>
                    <p className="text-base font-semibold text-gray-900 leading-tight">{daysInStage} days</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Premium Tabs - Apple Design System */}
          <div className="flex-1 overflow-hidden pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 bg-gray-50/60 p-1.5 rounded-xl border border-border/20 shadow-sm">
                <TabsTrigger 
                  value="overview" 
                  className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="contact" 
                  className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
                >
                  Contact
                </TabsTrigger>
                <TabsTrigger 
                  value="tasks" 
                  className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
                >
                  Tasks
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
                >
                  Activity
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-6 scroll-smooth">
                {/* Overview Tab - Completely Redesigned */}
                <TabsContent value="overview" className="space-y-6 mt-0">
                  {/* Hero Buyer Message */}
                  <BuyerMessageHero 
                    message={buyerProfile?.originalMessage} 
                    buyerName={buyerProfile?.buyerInfo?.name || deal.contact_name || deal.buyer_name}
                    isLoading={isBuyerProfileLoading}
                  />
                  
                  {/* Complete Buyer Profile */}
                  <BuyerProfileSection 
                    buyerProfile={buyerProfile}
                    selectedDeal={deal}
                  />
                  
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Business Overview - Full width on mobile */}
                    <Card className="xl:col-span-2 border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                      <CardHeader className="pb-4 border-b border-border/5">
                        <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-blue-700" />
                          </div>
                          Business Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Business Name</label>
                              <p className="text-base font-medium text-gray-900 leading-relaxed">{deal.listing_title}</p>
                            </div>
                            
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Buyer Organization</label>
                              <p className="text-base font-medium text-gray-900 leading-relaxed">
                                {deal.contact_company || deal.buyer_company || 'Private Investor'}
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Buyer Classification</label>
                              <Badge className={cn("px-3 py-1.5 text-sm border rounded-lg font-medium", getBuyerTypeColor(deal.buyer_type))}>
                                {getBuyerTypeLabel(deal.buyer_type)}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {deal.listing_revenue && (
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Annual Revenue</label>
                                <p className="text-base font-medium text-gray-900 leading-relaxed">{formatCurrency(deal.listing_revenue)}</p>
                              </div>
                            )}
                            
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Deal Stage</label>
                              <p className="text-base font-medium text-gray-900 leading-relaxed">{deal.stage_name}</p>
                            </div>
                            
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Days in Current Stage</label>
                              <p className="text-base font-medium text-gray-900 leading-relaxed">{daysInStage} days</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Status Panel */}
                    <div className="space-y-6">
                      {/* Document Status */}
                      <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                        <CardHeader className="pb-4 border-b border-border/5">
                          <CardTitle className="flex items-center gap-3 text-base font-semibold">
                            <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                            </div>
                            Documents
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <div className="flex items-center justify-between p-3 border border-border/10 rounded-lg bg-gray-50/30">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-900">NDA</span>
                            </div>
                            <Badge className={cn("px-2.5 py-1 text-xs border rounded-md font-medium", getDocumentStatusBadge(deal.nda_status))}>
                              {getStatusLabel(deal.nda_status)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 border border-border/10 rounded-lg bg-gray-50/30">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-900">Fee Agreement</span>
                            </div>
                            <Badge className={cn("px-2.5 py-1 text-xs border rounded-md font-medium", getDocumentStatusBadge(deal.fee_agreement_status))}>
                              {getStatusLabel(deal.fee_agreement_status)}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Progress Metrics */}
                      <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                        <CardHeader className="pb-4 border-b border-border/5">
                          <CardTitle className="flex items-center gap-3 text-base font-semibold">
                            <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Activity className="w-3.5 h-3.5 text-purple-700" />
                            </div>
                            Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">Task Completion</span>
                              <span className="text-sm font-semibold text-gray-900">{tasks.filter(t => t.status === 'completed').length}/{tasks.length}</span>
                            </div>
                            <Progress value={taskProgress} className="h-2.5 bg-gray-100" />
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3 pt-2">
                            <div className="text-center p-3 bg-gray-50/50 rounded-lg border border-border/5">
                              <div className="text-xl font-bold text-gray-900">{deal.total_tasks || 0}</div>
                              <div className="text-xs font-medium text-gray-600">Total Tasks</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Assignment Info */}
                      <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                        <CardHeader className="pb-4 border-b border-border/5">
                          <CardTitle className="flex items-center gap-3 text-base font-semibold">
                            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-700" />
                            </div>
                            Assignment
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Assigned To</label>
                            <p className="text-sm font-medium text-gray-900">
                              {deal.assigned_admin_name || 'Unassigned'}
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Created</label>
                            <p className="text-sm text-gray-600">
                              {format(new Date(deal.deal_created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          
                          {deal.followed_up_at && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Last Follow-up</label>
                              <p className="text-sm text-gray-600">
                                {formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true })}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                {/* Contact Tab - Enhanced Design */}
                <TabsContent value="contact" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contact Information */}
                    <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                      <CardHeader className="pb-4 border-b border-border/5">
                        <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-700" />
                          </div>
                          Contact Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Primary Contact</label>
                          <p className="text-base font-medium text-gray-900 leading-relaxed">
                            {deal.contact_name || deal.buyer_name || 'Unknown Contact'}
                          </p>
                        </div>
                        
                        {(deal.contact_email || deal.buyer_email) && (
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Email Address</label>
                            <div className="flex items-center gap-3">
                              <p className="text-base text-gray-700">{deal.contact_email || deal.buyer_email}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleEmailContact}
                                disabled={isLoading}
                                className="h-8 px-3 bg-white/80 hover:bg-white"
                              >
                                <Mail className="w-3.5 h-3.5 mr-1.5" />
                                Email
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {deal.contact_phone && (
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Phone Number</label>
                            <div className="flex items-center gap-3">
                              <p className="text-base text-gray-700">{deal.contact_phone}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePhoneContact}
                                disabled={isLoading}
                                className="h-8 px-3 bg-white/80 hover:bg-white"
                              >
                                <Phone className="w-3.5 h-3.5 mr-1.5" />
                                Call
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Organization</label>
                          <p className="text-base font-medium text-gray-900 leading-relaxed">
                            {deal.contact_company || deal.buyer_company || 'Private Investor'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Contact Actions */}
                    <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                      <CardHeader className="pb-4 border-b border-border/5">
                        <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-emerald-700" />
                          </div>
                          Log Contact
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Contact Note</label>
                          <Textarea
                            value={contactNote}
                            onChange={(e) => setContactNote(e.target.value)}
                            placeholder="Record details about your contact with this prospect..."
                            className="min-h-[100px] bg-white/80 border-border/20"
                          />
                        </div>
                        
                        <div className="flex gap-3">
                          <Button
                            onClick={handleLogNote}
                            disabled={!contactNote.trim() || isLoading}
                            className="flex-1 bg-primary hover:bg-primary/90"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Log Note
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Tasks Tab - Working Task Management */}
                <TabsContent value="tasks" className="space-y-6 mt-0">
                  {/* Create New Task */}
                  <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                    <CardHeader className="pb-4 border-b border-border/5">
                      <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <Plus className="w-4 h-4 text-emerald-700" />
                        </div>
                        Create New Task
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Task Title</label>
                          <Input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Enter task title..."
                            className="bg-white/80 border-border/20"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Description (Optional)</label>
                          <Textarea
                            value={newTaskDescription}
                            onChange={(e) => setNewTaskDescription(e.target.value)}
                            placeholder="Add task details..."
                            className="min-h-[80px] bg-white/80 border-border/20"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Priority</label>
                          <Select value={newTaskPriority} onValueChange={(value: 'low' | 'medium' | 'high') => setNewTaskPriority(value)}>
                            <SelectTrigger className="bg-white/80 border-border/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low Priority</SelectItem>
                              <SelectItem value="medium">Medium Priority</SelectItem>
                              <SelectItem value="high">High Priority</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Due Date (Optional)</label>
                          <Input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="bg-white/80 border-border/20"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <Button
                            onClick={handleCreateTask}
                            disabled={!newTaskTitle.trim() || createTask.isPending}
                            className="w-full bg-primary hover:bg-primary/90"
                          >
                            {createTask.isPending ? (
                              <>
                                <Circle className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Task
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Task List */}
                  <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                    <CardHeader className="pb-4 border-b border-border/5">
                      <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <CheckSquare className="w-4 h-4 text-purple-700" />
                        </div>
                        Task List ({tasks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {tasksLoading ? (
                        <div className="text-center py-8">
                          <Circle className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-400" />
                          <p className="text-gray-600">Loading tasks...</p>
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckSquare className="w-8 h-8 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Yet</h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            Create your first task to start tracking progress on this deal.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-center gap-4 p-4 border border-border/10 rounded-lg bg-white/40 transition-all",
                                task.status === 'completed' && "opacity-75"
                              )}
                            >
                              <button
                                onClick={() => task.status !== 'completed' && handleCompleteTask(task.id)}
                                disabled={task.status === 'completed' || completeTask.isPending}
                                className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                  task.status === 'completed'
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-slate-300 hover:border-emerald-400"
                                )}
                              >
                                {task.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                              </button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={cn(
                                    "font-medium text-sm",
                                    task.status === 'completed' ? "line-through text-gray-500" : "text-gray-900"
                                  )}>
                                    {task.title}
                                  </h4>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs px-2 py-0.5",
                                      task.priority === 'high' && "border-red-200 text-red-700 bg-red-50",
                                      task.priority === 'medium' && "border-amber-200 text-amber-700 bg-amber-50",
                                      task.priority === 'low' && "border-slate-200 text-slate-600 bg-slate-50"
                                    )}
                                  >
                                    {task.priority} priority
                                  </Badge>
                                </div>
                                {task.description && (
                                  <p className={cn(
                                    "text-xs",
                                    task.status === 'completed' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    {task.description}
                                  </p>
                                )}
                                {task.due_date && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                                  </p>
                                )}
                              </div>
                              
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deleteTask.isPending}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Activity Tab - Enhanced */}
                <TabsContent value="activity" className="space-y-6 mt-0">
                  <Card className="border-border/10 shadow-sm bg-white/60 backdrop-blur-sm rounded-xl">
                    <CardHeader className="pb-4 border-b border-border/5">
                      <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Activity className="w-4 h-4 text-blue-700" />
                        </div>
                        Activity Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Activity className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity History</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                          Complete activity tracking and communication timeline features are being developed to provide full visibility into deal interactions.
                        </p>
                      </div>
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