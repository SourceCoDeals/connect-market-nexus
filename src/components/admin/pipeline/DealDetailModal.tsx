import React, { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertCircle,
  Star,
  CheckSquare,
  X
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
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getBuyerTypeColor = (type?: string) => {
    if (!type) return 'bg-slate-50 text-slate-600 border-slate-200/50';
    
    const cleanType = type.toLowerCase().replace(/[^a-z]/g, '');
    switch (cleanType) {
      case 'privateequity':
        return 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200';
      case 'familyoffice':
        return 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200';
      case 'searchfund':
        return 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200';
      case 'corporate':
        return 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getBuyerTypeLabel = (type?: string) => {
    if (!type) return 'Individual';
    
    const cleanType = type.toLowerCase().replace(/[^a-z]/g, '');
    switch (cleanType) {
      case 'privateequity': return 'Private Equity';
      case 'familyoffice': return 'Family Office';
      case 'searchfund': return 'Search Fund';
      case 'corporate': return 'Corporate';
      case 'independentsponsor': return 'Independent Sponsor';
      default: return 'Individual';
    }
  };

  const getDocumentStatusDisplay = (status: string) => {
    switch (status) {
      case 'signed':
        return { 
          icon: CheckCircle, 
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200', 
          label: 'Signed',
          description: 'Document has been executed'
        };
      case 'sent':
        return { 
          icon: Clock, 
          color: 'text-amber-600 bg-amber-50 border-amber-200', 
          label: 'Pending',
          description: 'Awaiting signature'
        };
      case 'declined':
        return { 
          icon: X, 
          color: 'text-red-600 bg-red-50 border-red-200', 
          label: 'Declined',
          description: 'Document was declined'
        };
      default:
        return { 
          icon: FileX, 
          color: 'text-slate-400 bg-slate-50 border-slate-200', 
          label: 'Not Sent',
          description: 'Document not yet sent'
        };
    }
  };

  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const ndaStatus = getDocumentStatusDisplay(deal.nda_status);
  const feeStatus = getDocumentStatusDisplay(deal.fee_agreement_status);

  const companyName = deal.buyer_company || deal.contact_company || 'Unknown Company';
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown Contact';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden bg-background/95 backdrop-blur-md border border-border/50">
        <DialogHeader className="pb-6 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
                {deal.deal_title}
              </DialogTitle>
              <div className="flex items-center gap-3">
                <Badge 
                  variant={getStatusColor(deal.deal_priority)}
                  className="text-sm font-medium"
                >
                  {deal.deal_priority} priority
                </Badge>
                {deal.buyer_type && (
                  <Badge 
                    variant="outline" 
                    className={cn('text-sm font-medium border', getBuyerTypeColor(deal.buyer_type))}
                  >
                    {getBuyerTypeLabel(deal.buyer_type)}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span>Priority Score: {deal.buyer_priority_score || 0}</span>
                </div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-3xl font-bold text-foreground">{formatCurrency(deal.deal_value)}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" />
                <span>{deal.deal_probability}% probability</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 bg-muted/30 border border-border/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Contact
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Activity
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-6">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Listing Information */}
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                        Business Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Business Name</p>
                            <p className="font-semibold">{deal.listing_title}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Annual Revenue</p>
                            <p className="font-semibold text-emerald-700">{formatCurrency(deal.listing_revenue)}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                            <p className="font-semibold">{deal.listing_location}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">EBITDA</p>
                            <p className="font-semibold text-emerald-700">{formatCurrency(deal.listing_ebitda)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Document Status */}
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileCheck className="h-5 w-5 text-primary" />
                        Document Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className={cn('flex items-center gap-4 p-4 rounded-xl border', ndaStatus.color)}>
                          <ndaStatus.icon className="h-6 w-6" />
                          <div>
                            <p className="font-semibold">NDA</p>
                            <p className="text-sm">{ndaStatus.label}</p>
                            <p className="text-xs opacity-75">{ndaStatus.description}</p>
                          </div>
                        </div>
                        <div className={cn('flex items-center gap-4 p-4 rounded-xl border', feeStatus.color)}>
                          <feeStatus.icon className="h-6 w-6" />
                          <div>
                            <p className="font-semibold">Fee Agreement</p>
                            <p className="text-sm">{feeStatus.label}</p>
                            <p className="text-xs opacity-75">{feeStatus.description}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  
                  {/* Stage Information */}
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="h-5 w-5 text-primary" />
                        Deal Stage
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Current Stage</p>
                        <p className="font-semibold text-lg">{deal.stage_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Time in Stage</p>
                        <p className="font-semibold">{daysInStage} day{daysInStage !== 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Last Contact</p>
                        <p className="font-medium">
                          {deal.last_contact_at 
                            ? formatDistanceToNow(new Date(deal.last_contact_at), { addSuffix: true })
                            : 'No contact recorded'
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Task Summary */}
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CheckSquare className="h-5 w-5 text-primary" />
                        Tasks Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Total Tasks</span>
                        <span className="font-bold text-lg">{deal.total_tasks}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Pending</span>
                        <span className={cn('font-semibold', 
                          deal.pending_tasks > 0 ? 'text-amber-600' : 'text-muted-foreground'
                        )}>
                          {deal.pending_tasks}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Completed</span>
                        <span className="font-semibold text-emerald-600">{deal.completed_tasks}</span>
                      </div>
                      {deal.total_tasks > 0 && (
                        <div className="pt-2">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${(deal.completed_tasks / deal.total_tasks) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 text-center">
                            {Math.round((deal.completed_tasks / deal.total_tasks) * 100)}% Complete
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Assignment */}
                  {deal.assigned_admin_name && (
                    <Card className="border-border/50 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users className="h-5 w-5 text-primary" />
                          Assignment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Assigned to</p>
                          <p className="font-semibold">{deal.assigned_admin_name}</p>
                          <p className="text-sm text-muted-foreground">{deal.assigned_admin_email}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Contact Information */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="h-5 w-5 text-primary" />
                      Contact Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Contact Person</p>
                      <p className="font-semibold text-lg">{contactName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Company</p>
                      <p className="font-semibold">{companyName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Email Address</p>
                      <p className="font-medium">{deal.contact_email || deal.buyer_email || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Phone Number</p>
                      <p className="font-medium">{deal.contact_phone || 'Not provided'}</p>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleEmailContact}
                        disabled={!deal.contact_email || logContact.isPending}
                        className="flex-1 flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Send Email
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handlePhoneContact}
                        disabled={!deal.contact_phone || logContact.isPending}
                        className="flex-1 flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        Log Call
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Notes */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Add Contact Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Record details about your interaction with this buyer..."
                      value={contactNote}
                      onChange={(e) => setContactNote(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
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

            <TabsContent value="tasks" className="mt-0">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    Task Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Task management interface will be implemented here.</p>
                    <p className="text-sm">Create, assign, and track deal-specific tasks.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-primary" />
                    Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                      <div>
                        <p className="font-medium">Deal Created</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(deal.deal_created_at), 'MMM d, yyyy at h:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-center py-6 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Additional activity timeline will be displayed here.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}