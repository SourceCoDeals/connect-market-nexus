
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileText } from "lucide-react";
import { differenceInDays } from "date-fns";

interface ListingInfoProps {
  id: string;
  createdAt: string;
}

const ListingInfo = ({ id, createdAt }: ListingInfoProps) => {
  const getListingAge = (dateString: string) => {
    const days = differenceInDays(new Date(), new Date(dateString));
    if (days >= 30) {
      return "30+ days";
    }
    return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Listing Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Listed:</span>
          </span>
          <span className="text-sm font-medium">{getListingAge(createdAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Listing ID:</span>
          </span>
          <span className="text-sm font-mono">{id.substring(0, 8)}...</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListingInfo;
