
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, MessageSquare, Heart, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface DesktopNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const DesktopNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: DesktopNavItemsProps) => {
  const location = useLocation();

  if (!isApproved) {
    return null;
  }

  return (
    <div className="flex items-center space-x-8">
      <Link
        to="/"
        className={cn(
          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group",
          location.pathname === "/" 
            ? "text-sourceco-text bg-sourceco-background/40 shadow-sm" 
            : "text-sourceco-text/70 hover:text-sourceco-text hover:bg-sourceco-background/20"
        )}
      >
        <Store className="h-4 w-4 transition-transform group-hover:scale-105" />
        <span className="font-medium">Marketplace</span>
      </Link>
      
      <Link
        to="/saved-listings"
        className={cn(
          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group",
          location.pathname === "/saved-listings" 
            ? "text-sourceco-text bg-sourceco-background/40 shadow-sm" 
            : "text-sourceco-text/70 hover:text-sourceco-text hover:bg-sourceco-background/20"
        )}
      >
        <Heart className="h-4 w-4 transition-transform group-hover:scale-105" />
        <span className="font-medium">Saved Listings</span>
      </Link>

      <Link
        to="/my-requests"
        className={cn(
          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group",
          location.pathname === "/my-requests" 
            ? "text-sourceco-text bg-sourceco-background/40 shadow-sm" 
            : "text-sourceco-text/70 hover:text-sourceco-text hover:bg-sourceco-background/20"
        )}
      >
        <MessageSquare className="h-4 w-4 transition-transform group-hover:scale-105" />
        <span className="font-medium">Notes</span>
      </Link>

      <div className="h-6 w-px bg-gradient-to-b from-transparent via-sourceco-form to-transparent mx-6" />

      <Link
        to="/deal-alerts"
        className={cn(
          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group",
          location.pathname === "/deal-alerts" 
            ? "text-sourceco-accent bg-sourceco-accent/10 shadow-sm" 
            : "text-sourceco-text/70 hover:text-sourceco-accent hover:bg-sourceco-accent/5"
        )}
      >
        <MessageSquare className="h-4 w-4 transition-transform group-hover:scale-105" />
        <span className="font-medium">Get Notified</span>
      </Link>

      {isAdmin && (
        <>
          <div className="h-6 w-px bg-gradient-to-b from-transparent via-sourceco-form to-transparent mx-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToAdmin}
            className="flex items-center gap-2.5 h-10 px-4 border-sourceco-form/40 bg-white/50 text-sourceco-text/80 hover:bg-sourceco-background/30 hover:border-sourceco-accent/30 hover:text-sourceco-accent transition-all duration-200 shadow-sm"
          >
            <Shield className="h-4 w-4" />
            <span className="font-medium">Admin Dashboard</span>
          </Button>
        </>
      )}
    </div>
  );
};

export default DesktopNavItems;
