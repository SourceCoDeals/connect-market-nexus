
import { Clock, XCircle, AlertCircle } from "lucide-react";

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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium tracking-wide">PENDING</span>
          </div>
        );
      case "approved":
        // Approved badge is now on the image, not here
        return null;
      case "rejected":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200/60">
            <XCircle className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium tracking-wide">DECLINED</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <h3 className="text-[19px] font-semibold text-slate-900 tracking-[-0.02em] leading-[1.4] line-clamp-2">
        {title}
      </h3>
      {connectionExists && (
        <div className="mt-2">
          {getStatusIndicator()}
        </div>
      )}
    </div>
  );
};

export default ListingCardTitle;
