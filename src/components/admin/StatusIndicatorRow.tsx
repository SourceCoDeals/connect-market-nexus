import { Shield, FileText, MessageSquare, CheckCircle, Clock, Send, CheckCheck, XCircle, AlertTriangle } from "lucide-react";
import { User } from "@/types";
import { format } from "date-fns";

interface StatusIndicatorRowProps {
  user?: User | null; // Now optional for lead-only requests
  requestStatus: 'pending' | 'approved' | 'rejected' | 'on_hold';
  followedUp: boolean;
  negativeFollowedUp?: boolean;
  followedUpByAdmin?: User | null;
  negativeFollowedUpByAdmin?: User | null;
  followedUpAt?: string;
  negativeFollowedUpAt?: string;
}

export const StatusIndicatorRow = ({ 
  user, 
  requestStatus,
  followedUp, 
  negativeFollowedUp = false, 
  followedUpByAdmin, 
  negativeFollowedUpByAdmin,
  followedUpAt,
  negativeFollowedUpAt 
}: StatusIndicatorRowProps) => {
  const getStatusDisplay = (
    isSigned: boolean, 
    emailSent: boolean, 
    type: 'nda' | 'fee' | 'follow' | 'rejected'
  ) => {
    const icons = {
      nda: Shield,
      fee: FileText,
      follow: MessageSquare,
      rejected: XCircle
    };
    
    const labels = {
      nda: "NDA",
      fee: "Fee Agreement", 
      follow: "Follow-up",
      rejected: "Rejected"
    };
    
    const Icon = icons[type];
    
    // Rejected state (red)
    if (type === 'rejected' && requestStatus === 'rejected') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-lg transition-all hover:bg-destructive/15">
          <Icon className="h-4 w-4 text-destructive" />
          <span className="text-xs font-medium text-destructive">{labels[type]}</span>
          <AlertTriangle className="h-3 w-3 text-destructive" />
        </div>
      );
    }
    
    // Don't show rejected status if not rejected
    if (type === 'rejected' && requestStatus !== 'rejected') {
      return null;
    }
    
    // Signed/completed state (green)
    if (isSigned) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg transition-all hover:bg-success/15">
          <Icon className="h-4 w-4 text-success" />
          <span className="text-xs font-medium text-success">{labels[type]}</span>
          <CheckCheck className="h-3 w-3 text-success" />
        </div>
      );
    }
    
    // Email sent state (blue)
    if (emailSent && type !== 'follow') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg transition-all hover:bg-info/15">
          <Icon className="h-4 w-4 text-info" />
          <span className="text-xs font-medium text-info">{labels[type]}</span>
          <Send className="h-3 w-3 text-info" />
        </div>
      );
    }
    
    // Required/pending state (amber)
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg transition-all hover:bg-warning/15">
        <Icon className="h-4 w-4 text-warning" />
        <span className="text-xs font-medium text-warning">{labels[type]}</span>
        <Clock className="h-3 w-3 text-warning" />
      </div>
    );
  };

  // For lead-only requests, treat them equally - show NDA, Fee Agreement, and follow-up status
  // For user requests, use actual user data; for lead-only requests, show pending status
  if (!user) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded-lg">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Lead-Only Request</span>
        </div>
        {/* Show NDA and Fee Agreement as pending for lead-only requests */}
        {getStatusDisplay(false, false, 'nda')}
        {getStatusDisplay(false, false, 'fee')}
        {getStatusDisplay(followedUp, true, 'follow')}
        {/* Show rejection status if applicable */}
        {getStatusDisplay(false, false, 'rejected')}
        {negativeFollowedUp && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg">
            <XCircle className="h-4 w-4 text-warning" />
            <span className="text-xs font-medium text-warning">Negative Follow-up</span>
            <CheckCheck className="h-3 w-3 text-warning" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {getStatusDisplay(user.nda_signed || false, user.nda_email_sent || false, 'nda')}
      {getStatusDisplay(user.fee_agreement_signed || false, user.fee_agreement_email_sent || false, 'fee')}
      {getStatusDisplay(followedUp, true, 'follow')}
      {/* Show rejection status for all requests */}
      {getStatusDisplay(false, false, 'rejected')}
      {negativeFollowedUp && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg">
          <XCircle className="h-4 w-4 text-warning" />
          <span className="text-xs font-medium text-warning">Negative Follow-up</span>
          <CheckCheck className="h-3 w-3 text-warning" />
        </div>
      )}
    </div>
  );
};