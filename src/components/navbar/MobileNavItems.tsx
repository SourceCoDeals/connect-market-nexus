
import { Link } from "react-router-dom";
import { List, Bookmark } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface MobileNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const MobileNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: MobileNavItemsProps) => {
  if (!isApproved) return null;
  
  return (
    <>
      <DropdownMenuItem asChild>
        <Link to="/marketplace">
          <img 
            src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
            alt="" 
            className="mr-2 h-4 w-4"
          />
          <span>Marketplace</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/saved-listings">
          <Bookmark className="mr-2 h-4 w-4" />
          <span>Saved Listings</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/my-requests">
          <List className="mr-2 h-4 w-4" />
          <span>My Requests</span>
        </Link>
      </DropdownMenuItem>
      {isAdmin && (
        <DropdownMenuItem onSelect={onNavigateToAdmin}>
          <img 
            src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
            alt="" 
            className="mr-2 h-4 w-4"
          />
          <span>Admin Dashboard</span>
        </DropdownMenuItem>
      )}
    </>
  );
};

export default MobileNavItems;
