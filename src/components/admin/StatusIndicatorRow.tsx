import { Shield, FileText, MessageSquare } from "lucide-react";
import { User } from "@/types";

interface StatusIndicatorRowProps {
  user: User;
  followedUp: boolean;
}

export const StatusIndicatorRow = ({ user, followedUp }: StatusIndicatorRowProps) => {
  const getStatusIcon = (sent: boolean, signed: boolean) => {
    if (signed) return "✅";
    if (sent) return "📧";
    return "❌";
  };

  const getStatusText = (sent: boolean, signed: boolean) => {
    if (signed) return "Signed";
    if (sent) return "Sent";
    return "Pending";
  };

  const getStatusColor = (sent: boolean, signed: boolean) => {
    if (signed) return "text-green-600 font-medium";
    if (sent) return "text-blue-600";
    return "text-amber-600";
  };

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <div className="flex items-center gap-1" title="NDA Status">
        <Shield className="h-3 w-3" />
        <span className={getStatusColor(user.nda_email_sent || false, user.nda_signed || false)}>
          {getStatusIcon(user.nda_email_sent || false, user.nda_signed || false)} {getStatusText(user.nda_email_sent || false, user.nda_signed || false)}
        </span>
      </div>
      
      <span className="text-muted-foreground">•</span>
      
      <div className="flex items-center gap-1" title="Fee Agreement Status">
        <FileText className="h-3 w-3" />
        <span className={getStatusColor(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false)}>
          {getStatusIcon(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false)} {getStatusText(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false)}
        </span>
      </div>
      
      <span className="text-muted-foreground">•</span>
      
      <div className="flex items-center gap-1" title="Follow-up Status">
        <MessageSquare className="h-3 w-3" />
        <span className={followedUp ? "text-green-600 font-medium" : "text-amber-600"}>
          {followedUp ? "✅ Done" : "❌ Pending"}
        </span>
      </div>
    </div>
  );
};