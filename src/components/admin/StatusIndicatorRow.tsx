import { Shield, FileText, MessageSquare, CheckCircle, Clock, Send, CheckCheck, XCircle } from "lucide-react";
import { User } from "@/types";

interface StatusIndicatorRowProps {
  user: User;
  followedUp: boolean;
  negativeFollowedUp?: boolean;
}

export const StatusIndicatorRow = ({ user, followedUp, negativeFollowedUp = false }: StatusIndicatorRowProps) => {
  const getStatusDisplay = (
    isSigned: boolean, 
    emailSent: boolean, 
    type: 'nda' | 'fee' | 'follow'
  ) => {
    const icons = {
      nda: Shield,
      fee: FileText,
      follow: MessageSquare
    };
    
    const labels = {
      nda: "NDA",
      fee: "Fee Agreement", 
      follow: "Follow-up"
    };
    
    const Icon = icons[type];
    
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {getStatusDisplay(
        user.nda_signed || false, 
        user.nda_email_sent || false, 
        'nda'
      )}
      {getStatusDisplay(
        user.fee_agreement_signed || false, 
        user.fee_agreement_email_sent || false, 
        'fee'
      )}
      {getStatusDisplay(followedUp, false, 'follow')}
      
      {/* Negative Follow-Up Indicator */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
        negativeFollowedUp 
          ? "bg-amber-50 border border-amber-200 hover:bg-amber-100" 
          : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
      }`}>
        <XCircle className={`h-4 w-4 ${negativeFollowedUp ? "text-amber-600" : "text-gray-400"}`} />
        <span className={`text-xs font-medium ${negativeFollowedUp ? "text-amber-700" : "text-gray-500"}`}>
          Rejection Notice
        </span>
        {negativeFollowedUp && <CheckCheck className="h-3 w-3 text-amber-600" />}
        {!negativeFollowedUp && <Clock className="h-3 w-3 text-gray-400" />}
      </div>
    </div>
  );
};