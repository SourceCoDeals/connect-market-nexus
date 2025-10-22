
import { Link } from "react-router-dom";
import { Store, Briefcase, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserNotifications } from "@/hooks/use-user-notifications";

interface MobileNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const MobileNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: MobileNavItemsProps) => {
  const { unreadCount } = useUserNotifications();
  
  if (!isApproved) {
    return null;
  }

  return (
    <div className="flex flex-col space-y-2 p-4">
      <Link
        to="/"
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Store className="h-4 w-4" />
        Marketplace
      </Link>
      
      <Link
        to="/saved-listings"
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Heart className="h-4 w-4" />
        Saved Listings
      </Link>

      <Link
        to="/my-requests"
        className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Briefcase className="h-4 w-4" strokeWidth={1.5} />
        My Deals
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-40"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-white shadow-sm"></span>
          </span>
        )}
      </Link>

      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateToAdmin}
          className="flex items-center gap-2 justify-start"
        >
          <Shield className="h-4 w-4" />
          Admin Dashboard
        </Button>
      )}
    </div>
  );
};

export default MobileNavItems;
