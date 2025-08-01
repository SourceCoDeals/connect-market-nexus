import { Shield, FileText, MessageSquare, CheckCircle, Clock } from "lucide-react";
import { User } from "@/types";

interface StatusIndicatorRowProps {
  user: User;
  followedUp: boolean;
}

export const StatusIndicatorRow = ({ user, followedUp }: StatusIndicatorRowProps) => {
  const getStatusDisplay = (status: boolean, type: 'nda' | 'fee' | 'follow') => {
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
    
    if (status) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-md">
          <Icon className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300">{labels[type]}</span>
          <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{labels[type]}</span>
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        </div>
      );
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {getStatusDisplay(user.nda_signed, 'nda')}
      {getStatusDisplay(user.fee_agreement_signed, 'fee')}
      {getStatusDisplay(followedUp, 'follow')}
    </div>
  );
};