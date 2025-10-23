
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200">
            <Clock className="h-3.5 w-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-amber-800">
              Pending
            </span>
          </div>
        );
      case "approved":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-700" />
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-emerald-800">
              Connected
            </span>
          </div>
        );
      case "rejected":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-50 border border-red-200">
            <XCircle className="h-3.5 w-3.5 text-red-700" />
            <span className="text-[11px] font-medium text-red-800">
              Request Declined
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mb-3">
      <h3 className="text-[16px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight mb-2">
        {title}
      </h3>
      {getStatusIndicator()}
    </div>
  );
};

export default ListingCardTitle;
