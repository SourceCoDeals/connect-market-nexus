
import { Link } from "react-router-dom";
import { Store, MessageSquare, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const MobileNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: MobileNavItemsProps) => {
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
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <MessageSquare className="h-4 w-4" />
        My Deals
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
