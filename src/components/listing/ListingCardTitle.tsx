
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

interface ListingCardTitleProps {
  title: string;
  connectionExists?: boolean;
  connectionStatus?: string;
}

const ListingCardTitle = ({ 
  title, 
  connectionExists = false, 
  connectionStatus = "" 
}: ListingCardTitleProps) => {
  const getStatusIndicator = () => {
    if (!connectionExists) return null;

    switch (connectionStatus) {
      case "pending":
        return (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Pending</span>
          </div>
        );
      case "approved":
        return (
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <CheckCircle className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Connected</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <XCircle className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Rejected</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mb-4">
      <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 mb-2 tracking-[-0.015em] leading-[1.3]">
        {title}
      </h3>
      {getStatusIndicator()}
    </div>
  );
};

export default ListingCardTitle;
