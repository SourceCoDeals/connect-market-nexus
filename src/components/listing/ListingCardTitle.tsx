
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
          <div className="flex items-center gap-1 text-orange-600">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Request Pending</span>
          </div>
        );
      case "approved":
        return (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Connected</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-1 text-red-600">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Rejected - Submit Again</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-gray-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Status Unknown</span>
          </div>
        );
    }
  };

  return (
    <div className="mb-3">
      <h3 className="text-lg font-semibold text-foreground line-clamp-2 mb-1">
        {title}
      </h3>
      {getStatusIndicator()}
    </div>
  );
};

export default ListingCardTitle;
