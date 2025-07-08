
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";

interface DesktopNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const DesktopNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: DesktopNavItemsProps) => {
  if (!isApproved) return null;
  
  return (
    <nav className="flex items-center space-x-1">
      <Button
        variant="ghost"
        size="sm"
        asChild
      >
        <Link to="/marketplace">
          <img 
            src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
            alt="" 
            className="h-4 w-4 mr-1"
          />
          Marketplace
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        asChild
      >
        <Link to="/my-requests">
          <List className="h-4 w-4 mr-1" />
          My Requests
        </Link>
      </Button>

      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="border-primary text-primary hover:bg-primary/5"
          onClick={onNavigateToAdmin}
        >
          Admin Dashboard
        </Button>
      )}
    </nav>
  );
};

export default DesktopNavItems;
