
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Pending</span>
          </div>
        );
      case "approved":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Connected</span>
          </div>
        );
      case "rejected":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Rejected</span>
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
