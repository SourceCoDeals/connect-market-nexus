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
import { Card, CardContent } from '@/components/ui/card';
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
  Users
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface DealDetailModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailModal({ deal, open, onOpenChange }: DealDetailModalProps) {
  const [contactNote, setContactNote] = useState('');
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
        return { icon: FileCheck, color: 'text-emerald-600', label: 'Signed' };
      case 'sent':
        return { icon: Clock, color: 'text-amber-600', label: 'Sent - Pending' };
      case 'not_sent':
        return { icon: FileX, color: 'text-slate-400', label: 'Not Sent' };
      default:
        return { icon: FileX, color: 'text-slate-400', label: 'Not Sent' };
    }
  };

  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const ndaStatus = getDocumentStatusIcon(deal.nda_status);
  const feeStatus = getDocumentStatusIcon(deal.fee_agreement_status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold">
                {deal.deal_title}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-sm', getPriorityColor(deal.deal_priority))}>
                  {deal.deal_priority} priority
                </Badge>
                {deal.buyer_type && (
                  <Badge variant="outline" className={cn('text-sm', getBuyerTypeColor(deal.buyer_type))}>
                    {deal.buyer_type}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(deal.deal_value)}</p>
              <p className="text-sm text-muted-foreground">{deal.deal_probability}% probability</p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Key Metrics */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Key Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Listing Revenue</p>
                      <p className="font-semibold">{formatCurrency(deal.listing_revenue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">EBITDA</p>
                      <p className="font-semibold">{formatCurrency(deal.listing_ebitda)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-semibold">{deal.listing_location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Time in Stage</p>
                      <p className="font-semibold">{daysInStage} days</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Name</p>
                      <p className="font-medium">{deal.contact_name || deal.buyer_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium">{deal.buyer_company || deal.contact_company || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{deal.contact_email || deal.buyer_email || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{deal.contact_phone || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
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
                </div>
              </CardContent>
            </Card>

            {/* Document Status */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Document Status
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <ndaStatus.icon className={cn('h-5 w-5', ndaStatus.color)} />
                    <div>
                      <p className="font-medium">NDA</p>
                      <p className={cn('text-sm', ndaStatus.color)}>{ndaStatus.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <feeStatus.icon className={cn('h-5 w-5', feeStatus.color)} />
                    <div>
                      <p className="font-medium">Fee Agreement</p>
                      <p className={cn('text-sm', feeStatus.color)}>{feeStatus.label}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Log */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Add Contact Note
                </h3>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add a note about your contact with this buyer..."
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    onClick={handleLogNote}
                    disabled={!contactNote.trim() || logContact.isPending}
                    className="w-full"
                  >
                    Log Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            
            {/* Stage Information */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Stage Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Stage</p>
                    <p className="font-medium">{deal.stage_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time in Stage</p>
                    <p className="font-medium">{daysInStage} days</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Contact</p>
                    <p className="font-medium">
                      {deal.last_contact_at 
                        ? formatDistanceToNow(new Date(deal.last_contact_at), { addSuffix: true })
                        : 'No contact recorded'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Task Summary */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Tasks
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Tasks</span>
                    <span className="font-medium">{deal.total_tasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className={cn('font-medium', 
                      deal.pending_tasks > 0 ? 'text-amber-600' : 'text-muted-foreground'
                    )}>
                      {deal.pending_tasks}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-medium text-emerald-600">{deal.completed_tasks}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assignment */}
            {deal.assigned_admin_name && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Assignment
                  </h3>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned to</p>
                    <p className="font-medium">{deal.assigned_admin_name}</p>
                    <p className="text-xs text-muted-foreground">{deal.assigned_admin_email}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deal Timeline */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Deal Timeline</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(new Date(deal.deal_created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(deal.deal_updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  {deal.deal_expected_close_date && (
                    <div>
                      <p className="text-muted-foreground">Expected Close</p>
                      <p className="font-medium">
                        {format(new Date(deal.deal_expected_close_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}