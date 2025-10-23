
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
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60">
            <Clock className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              Pending
            </span>
          </div>
        );
      case "approved":
        return (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60">
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Connected
            </span>
          </div>
        );
      case "rejected":
        return (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200/60">
            <XCircle className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-red-700">
              Declined
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2.5">
      <h3 className="text-[20px] font-semibold text-slate-900 tracking-tight leading-snug">
        {title}
      </h3>
      {getStatusIndicator()}
    </div>
  );
};

export default ListingCardTitle;
