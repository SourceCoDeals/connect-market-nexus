import { useState } from 'react';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  User,
  Mail,
  Phone,
  Linkedin,
  Building2,
  Target,
  Calendar,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import type {
  BuyerIntroduction,
  IntroductionStatus,
  UpdateBuyerIntroductionInput,
} from '@/types/buyer-introductions';

interface UpdateIntroductionStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer: BuyerIntroduction;
  listingId: string;
}

const INTRODUCTION_METHODS = [
  'Virtual Meeting',
  'In-Person Meeting',
  'Email Introduction',
  'Phone Call',
  'Conference/Event',
  'Other',
];

export function UpdateIntroductionStatusDialog({
  open,
  onOpenChange,
  buyer,
  listingId,
}: UpdateIntroductionStatusDialogProps) {
  const { updateStatus, isUpdating } = useBuyerIntroductions(listingId);

  const [newStatus, setNewStatus] = useState<IntroductionStatus>(buyer.introduction_status);
  const [introductionDate, setIntroductionDate] = useState(buyer.introduction_date || '');
  const [introducedBy, setIntroducedBy] = useState(buyer.introduced_by || '');
  const [introductionMethod, setIntroductionMethod] = useState(buyer.introduction_method || '');
  const [introductionNotes, setIntroductionNotes] = useState(buyer.introduction_notes || '');
  const [passedDate, setPassedDate] = useState(buyer.passed_date || '');
  const [passedReason, setPassedReason] = useState(buyer.passed_reason || '');
  const [buyerFeedback, setBuyerFeedback] = useState(buyer.buyer_feedback || '');
  const [nextStep, setNextStep] = useState(buyer.next_step || '');
  const [expectedNextStepDate, setExpectedNextStepDate] = useState(
    buyer.expected_next_step_date || '',
  );
  const [scheduledDate, setScheduledDate] = useState(buyer.introduction_scheduled_date || '');

  const handleSubmit = () => {
    const updates: UpdateBuyerIntroductionInput = {
      introduction_status: newStatus,
    };

    if (newStatus === 'introduction_scheduled') {
      updates.introduction_scheduled_date = scheduledDate || undefined;
    }

    if (newStatus === 'introduced' || newStatus === 'passed' || newStatus === 'rejected') {
      updates.introduction_date = introductionDate || undefined;
      updates.introduced_by = introducedBy || undefined;
      updates.introduction_method = introductionMethod || undefined;
      updates.introduction_notes = introductionNotes || undefined;
    }

    if (newStatus === 'passed' || newStatus === 'rejected') {
      updates.passed_date = passedDate || new Date().toISOString().split('T')[0];
      updates.passed_reason = passedReason || undefined;
      updates.buyer_feedback = buyerFeedback || undefined;
      updates.next_step = nextStep || undefined;
      updates.expected_next_step_date = expectedNextStepDate || undefined;
    }

    if (newStatus === 'introduced') {
      updates.buyer_feedback = buyerFeedback || undefined;
      updates.next_step = nextStep || undefined;
      updates.expected_next_step_date = expectedNextStepDate || undefined;
    }

    updateStatus(
      { id: buyer.id, updates },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const statusChanged = newStatus !== buyer.introduction_status;

  return (
    <Dialog open={open} onOpenChange={(v) => !isUpdating && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {buyer.buyer_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{buyer.buyer_firm_name}</p>
        </DialogHeader>

        {/* Buyer Info Summary */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {buyer.buyer_email && (
              <a
                href={`mailto:${buyer.buyer_email}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="h-3 w-3" />
                {buyer.buyer_email}
              </a>
            )}
            {buyer.buyer_phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {buyer.buyer_phone}
              </span>
            )}
            {buyer.buyer_linkedin_url && (
              <a
                href={
                  buyer.buyer_linkedin_url.startsWith('http')
                    ? buyer.buyer_linkedin_url
                    : `https://${buyer.buyer_linkedin_url}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Linkedin className="h-3 w-3" />
                LinkedIn
              </a>
            )}
          </div>
          {buyer.targeting_reason && (
            <p className="text-xs text-muted-foreground">
              <Target className="h-3 w-3 inline mr-1" />
              {buyer.targeting_reason}
            </p>
          )}
          {buyer.internal_champion && (
            <p className="text-xs text-muted-foreground">
              <User className="h-3 w-3 inline mr-1" />
              Champion: {buyer.internal_champion}
            </p>
          )}
        </div>

        {/* Status Update */}
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Update Status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as IntroductionStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_introduced">
                  <span className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-amber-600" />
                    Not Yet Introduced
                  </span>
                </SelectItem>
                <SelectItem value="introduction_scheduled">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    Introduction Scheduled
                  </span>
                </SelectItem>
                <SelectItem value="introduced">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-purple-600" />
                    Introduced (Awaiting Outcome)
                  </span>
                </SelectItem>
                <SelectItem value="passed">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Passed (Moving Forward)
                  </span>
                </SelectItem>
                <SelectItem value="rejected">
                  <span className="flex items-center gap-2">
                    <X className="h-3.5 w-3.5 text-slate-500" />
                    Rejected (Not Interested)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled Date (for introduction_scheduled) */}
          {newStatus === 'introduction_scheduled' && (
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          )}

          {/* Introduction Details (for introduced, passed, rejected) */}
          {(newStatus === 'introduced' || newStatus === 'passed' || newStatus === 'rejected') && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Introduction Details
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Introduction Date</Label>
                  <Input
                    type="date"
                    value={introductionDate}
                    onChange={(e) => setIntroductionDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Introduced By</Label>
                  <Input
                    value={introducedBy}
                    onChange={(e) => setIntroducedBy(e.target.value)}
                    placeholder="Sarah Mitchell"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Introduction Method</Label>
                <Select value={introductionMethod} onValueChange={setIntroductionMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTRODUCTION_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Introduction Notes</Label>
                <Textarea
                  value={introductionNotes}
                  onChange={(e) => setIntroductionNotes(e.target.value)}
                  placeholder="How did the introduction go?"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Feedback & Next Steps (for introduced, passed, rejected) */}
          {(newStatus === 'introduced' || newStatus === 'passed' || newStatus === 'rejected') && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Feedback & Next Steps
              </p>
              <div className="space-y-2">
                <Label>Buyer Feedback</Label>
                <Textarea
                  value={buyerFeedback}
                  onChange={(e) => setBuyerFeedback(e.target.value)}
                  placeholder="What did the buyer say?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Next Step</Label>
                <Input
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="e.g. Management presentation"
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Next Step Date</Label>
                <Input
                  type="date"
                  value={expectedNextStepDate}
                  onChange={(e) => setExpectedNextStepDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Pass/Reject Reason (for passed, rejected) */}
          {(newStatus === 'passed' || newStatus === 'rejected') && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {newStatus === 'passed' ? 'Pass Details' : 'Rejection Details'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{newStatus === 'passed' ? 'Passed Date' : 'Rejected Date'}</Label>
                  <Input
                    type="date"
                    value={passedDate}
                    onChange={(e) => setPassedDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={passedReason}
                  onChange={(e) => setPassedReason(e.target.value)}
                  placeholder={
                    newStatus === 'passed'
                      ? 'e.g. Very interested, wants to move to LOI'
                      : 'e.g. Not aligned on valuation'
                  }
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {statusChanged ? 'Update Status' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
