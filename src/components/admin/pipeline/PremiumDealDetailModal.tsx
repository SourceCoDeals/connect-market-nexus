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
  Activity
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
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
  const logContact = useLogDealContact();

  if (!deal) return null;

  // Apple/Stripe style helper functions
  const getBuyerTypeColor = (buyerType?: string) => {
    if (!buyerType) return 'bg-slate-50 text-slate-700 border-slate-200';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 border-purple-200';
      case 'familyoffice':
        return 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-200';
      case 'searchfund':
        return 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-200';
      case 'corporate':
        return 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-200';
      case 'individual':
        return 'bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200';
      case 'independentsponsor':
        return 'bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200';
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'sent':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'declined':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
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

  // Calculate progress and metrics
  const taskProgress = deal.total_tasks > 0 ? ((deal.completed_tasks || 0) / deal.total_tasks) * 100 : 0;
  const daysInStage = deal.deal_stage_entered_at 
    ? Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-xl border border-border/40 shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Premium Header */}
          <DialogHeader className="border-b border-border/10 pb-6 bg-gradient-to-r from-slate-50/50 to-white/50 -m-6 px-6 pt-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <DialogTitle className="text-xl font-semibold text-gray-900 leading-tight">
                  {deal.listing_title || 'Business Acquisition Opportunity'}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge className={cn("px-3 py-1 text-sm font-medium border", getBuyerTypeColor(deal.buyer_type))}>
                    {getBuyerTypeLabel(deal.buyer_type)}
                  </Badge>
                </div>
              </div>
              
              {/* Key metrics row */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="text-gray-600">Value:</span>
                  <span className="font-semibold text-gray-900">
                    {deal.listing_revenue ? formatCurrency(deal.listing_revenue) : 'Confidential'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-600">Stage:</span>
                  <span className="font-semibold text-gray-900">{deal.stage_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold text-gray-900">{daysInStage} days</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Premium Tabs */}
          <div className="flex-1 overflow-hidden pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 bg-slate-50/50 p-1 rounded-lg">
                <TabsTrigger value="overview" className="text-sm font-medium">Overview</TabsTrigger>
                <TabsTrigger value="contact" className="text-sm font-medium">Contact</TabsTrigger>
                <TabsTrigger value="tasks" className="text-sm font-medium">Tasks</TabsTrigger>
                <TabsTrigger value="activity" className="text-sm font-medium">Activity</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-6">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Business Details */}
                    <Card className="border-border/20 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Building2 className="w-5 h-5 text-primary" />
                          Business Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Business</label>
                            <p className="text-sm font-medium text-gray-900 mt-1">{deal.listing_title}</p>
                          </div>
                          
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Buyer Company</label>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              {deal.contact_company || deal.buyer_company || 'Private Investor'}
                            </p>
                          </div>
                          
                          {deal.listing_revenue && (
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Revenue</label>
                              <p className="text-sm font-medium text-gray-900 mt-1">{formatCurrency(deal.listing_revenue)}</p>
                            </div>
                          )}
                          
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Buyer Type</label>
                            <Badge className={cn("mt-1 px-2 py-1 text-xs border", getBuyerTypeColor(deal.buyer_type))}>
                              {getBuyerTypeLabel(deal.buyer_type)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Document Status */}
                    <Card className="border-border/20 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileCheck className="w-5 h-5 text-primary" />
                          Document Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 border border-border/20 rounded-lg bg-slate-50/30">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-900">NDA</span>
                            </div>
                            <Badge className={cn("px-2 py-1 text-xs border", getDocumentStatusBadge(deal.nda_status))}>
                              {getStatusLabel(deal.nda_status)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 border border-border/20 rounded-lg bg-slate-50/30">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-900">Fee Agreement</span>
                            </div>
                            <Badge className={cn("px-2 py-1 text-xs border", getDocumentStatusBadge(deal.fee_agreement_status))}>
                              {getStatusLabel(deal.fee_agreement_status)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Deal Progress */}
                    <Card className="border-border/20 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Activity className="w-5 h-5 text-primary" />
                          Progress
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Task Completion</span>
                            <span className="text-sm text-gray-600">{deal.completed_tasks || 0}/{deal.total_tasks || 0}</span>
                          </div>
                          <Progress value={taskProgress} className="h-2" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="text-center p-3 bg-slate-50/50 rounded-lg border border-border/10">
                            <div className="text-lg font-semibold text-gray-900">{daysInStage}</div>
                            <div className="text-xs text-gray-600">Days in Stage</div>
                          </div>
                          <div className="text-center p-3 bg-slate-50/50 rounded-lg border border-border/10">
                            <div className="text-lg font-semibold text-gray-900">{deal.total_tasks || 0}</div>
                            <div className="text-xs text-gray-600">Total Tasks</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Assignment */}
                    <Card className="border-border/20 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <User className="w-5 h-5 text-primary" />
                          Assignment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Assigned To</label>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {deal.assigned_admin_name || 'Unassigned'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</label>
                          <p className="text-sm text-gray-600 mt-1">
                            {format(new Date(deal.deal_created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        
                        {deal.followed_up_at && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Follow-up</label>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true })}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Contact Tab */}
                <TabsContent value="contact" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contact Details */}
                    <Card className="border-border/20 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <User className="w-5 h-5 text-primary" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Name</label>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {deal.contact_name || deal.buyer_name || 'Unknown Contact'}
                          </p>
                        </div>
                        
                        {(deal.contact_email || deal.buyer_email) && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
                            <p className="text-sm text-gray-600 mt-1">{deal.contact_email || deal.buyer_email}</p>
                          </div>
                        )}
                        
                        {deal.contact_phone && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</label>
                            <p className="text-sm text-gray-600 mt-1">{deal.contact_phone}</p>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</label>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {deal.contact_company || deal.buyer_company || 'Private Investor'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="border-border/20 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <MessageSquare className="w-5 h-5 text-primary" />
                          Quick Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={handleEmailContact}
                            disabled={isLoading}
                            variant="outline"
                            className="flex items-center gap-2 h-10"
                          >
                            <Mail className="w-4 h-4" />
                            Send Email
                          </Button>
                          <Button
                            onClick={handlePhoneContact}
                            disabled={isLoading}
                            variant="outline"
                            className="flex items-center gap-2 h-10"
                          >
                            <Phone className="w-4 h-4" />
                            Log Call
                          </Button>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add Contact Note</label>
                          <Textarea
                            value={contactNote}
                            onChange={(e) => setContactNote(e.target.value)}
                            placeholder="Log a note about this contact..."
                            className="min-h-[80px] resize-none"
                          />
                          <Button
                            onClick={handleLogNote}
                            disabled={isLoading || !contactNote.trim()}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Note
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="space-y-6 mt-0">
                  <Card className="border-border/20 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CheckCircle className="w-5 h-5 text-primary" />
                        Task Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">Task management feature coming soon</p>
                        <p className="text-xs text-gray-400 mt-1">Create and assign tasks for this deal</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-6 mt-0">
                  <Card className="border-border/20 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="w-5 h-5 text-primary" />
                        Activity Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Deal Created Event */}
                        <div className="flex items-start gap-3 pb-4 border-b border-border/10 last:border-0">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">Deal Created</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(deal.deal_created_at), 'MMM d, yyyy \'at\' h:mm a')}
                            </p>
                          </div>
                        </div>
                        
                        {/* Follow-up Event */}
                        {deal.followed_up_at && (
                          <div className="flex items-start gap-3 pb-4 border-b border-border/10 last:border-0">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-gray-900">Follow-up Contact</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(deal.followed_up_at), 'MMM d, yyyy \'at\' h:mm a')}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Last Contact Event */}
                        {deal.last_contact_at && (
                          <div className="flex items-start gap-3 pb-4 border-b border-border/10 last:border-0">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-gray-900">Last Contact</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(deal.last_contact_at), 'MMM d, yyyy \'at\' h:mm a')}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        <div className="text-center py-4 text-gray-400">
                          <Activity className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-xs">More activity tracking coming soon</p>
                        </div>
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