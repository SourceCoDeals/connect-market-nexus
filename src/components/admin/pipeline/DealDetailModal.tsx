import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Deal } from '@/hooks/admin/use-deals';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Percent, 
  CheckCircle, 
  Clock, 
  FileCheck, 
  FileX,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
  Activity,
  Settings,
  History,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface DealDetailModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailModal({ deal, open, onOpenChange }: DealDetailModalProps) {
  const [contactNote, setContactNote] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const logContact = useLogDealContact();

  // Reset tab when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab('overview');
      setContactNote('');
    }
  }, [open]);

  if (!deal) return null;

  const handleLogNote = async () => {
    if (!contactNote.trim()) return;
    
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'note',
        details: { note: contactNote }
      });
      setContactNote('');
    } catch (error) {
      console.error('Failed to log note:', error);
    }
  };

  const handleEmailContact = async () => {
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'email',
        details: { recipient: deal.contact_email }
      });
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  };

  const handlePhoneContact = async () => {
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'phone',
        details: { phone: deal.contact_phone }
      });
    } catch (error) {
      console.error('Failed to log phone call:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 text-red-700 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getBuyerTypeColor = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'privateequity':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'familyoffice':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'searchfund':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'corporate':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getDocumentStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return { icon: FileCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Signed' };
      case 'sent':
        return { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Sent - Pending' };
      case 'not_sent':
        return { icon: FileX, color: 'text-slate-400', bgColor: 'bg-slate-50', label: 'Not Sent' };
      default:
        return { icon: FileX, color: 'text-slate-400', bgColor: 'bg-slate-50', label: 'Not Sent' };
    }
  };

  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const ndaStatus = getDocumentStatusIcon(deal.nda_status);
  const feeStatus = getDocumentStatusIcon(deal.fee_agreement_status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-6 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {deal.listing_title}
              </DialogTitle>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn('text-sm px-3 py-1', getPriorityColor(deal.deal_priority))}>
                  {deal.deal_priority} priority
                </Badge>
                {deal.buyer_type && (
                  <Badge variant="outline" className={cn('text-sm px-3 py-1', getBuyerTypeColor(deal.buyer_type))}>
                    {deal.buyer_type}
                  </Badge>
                )}
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {deal.stage_name}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {deal.buyer_company || deal.contact_company || 'Unknown Company'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {daysInStage} days in stage
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-tight">{formatCurrency(deal.listing_revenue)}</p>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-lg font-semibold text-muted-foreground mt-1">{formatCurrency(deal.listing_ebitda)} EBITDA</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Business Information */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Business Information
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="text-lg font-semibold">{formatCurrency(deal.listing_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">EBITDA</p>
                        <p className="text-lg font-semibold">{formatCurrency(deal.listing_ebitda)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium">{deal.listing_location}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Deal Value</p>
                        <p className="font-medium">{formatCurrency(deal.deal_value)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Document Status */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Documents
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', ndaStatus.bgColor)}>
                      <ndaStatus.icon className={cn('h-5 w-5', ndaStatus.color)} />
                      <div>
                        <p className="font-medium">NDA</p>
                        <p className={cn('text-sm', ndaStatus.color)}>{ndaStatus.label}</p>
                      </div>
                    </div>
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', feeStatus.bgColor)}>
                      <feeStatus.icon className={cn('h-5 w-5', feeStatus.color)} />
                      <div>
                        <p className="font-medium">Fee Agreement</p>
                        <p className={cn('text-sm', feeStatus.color)}>{feeStatus.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tasks & Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Task Summary
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Tasks</span>
                        <span className="font-medium">{deal.total_tasks}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Pending</span>
                        <span className={cn('font-medium', 
                          deal.pending_tasks > 0 ? 'text-amber-600' : 'text-muted-foreground'
                        )}>
                          {deal.pending_tasks}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Completed</span>
                        <span className="font-medium text-emerald-600">{deal.completed_tasks}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Timeline
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created</span>
                        <span className="font-medium">
                          {format(new Date(deal.deal_created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stage Entry</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(deal.deal_stage_entered_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Contact</span>
                        <span className="font-medium">
                          {deal.last_contact_at 
                            ? formatDistanceToNow(new Date(deal.last_contact_at), { addSuffix: true })
                            : 'No contact yet'
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contact Details
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Contact Name</Label>
                        <p className="font-medium">{deal.contact_name || deal.buyer_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Company</Label>
                        <p className="font-medium">{deal.buyer_company || deal.contact_company || 'Unknown'}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Email</Label>
                        <p className="font-medium">{deal.contact_email || deal.buyer_email || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Phone</Label>
                        <p className="font-medium">{deal.contact_phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Role</Label>
                        <p className="font-medium">{deal.contact_role || 'Not specified'}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        size="sm"
                        onClick={handleEmailContact}
                        disabled={!deal.contact_email || logContact.isPending}
                        className="flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Send Email
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePhoneContact}
                        disabled={!deal.contact_phone || logContact.isPending}
                        className="flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        Log Call
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Log Contact Note */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Log Contact
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="contact-note">Contact Note</Label>
                      <Textarea
                        id="contact-note"
                        placeholder="Add details about your interaction with this buyer..."
                        value={contactNote}
                        onChange={(e) => setContactNote(e.target.value)}
                        className="min-h-[120px] mt-2"
                      />
                    </div>
                    <Button
                      onClick={handleLogNote}
                      disabled={!contactNote.trim() || logContact.isPending}
                      className="w-full"
                    >
                      {logContact.isPending ? 'Logging...' : 'Log Contact Note'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Deal Tasks
                    </h3>
                    <Button size="sm">Add Task</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No tasks assigned yet</p>
                      <p className="text-sm">Create tasks to track progress on this deal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Activity Timeline
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No activity recorded yet</p>
                      <p className="text-sm">Contact logs and deal updates will appear here</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}