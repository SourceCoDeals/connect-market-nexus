import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserViewSwitcherProps {
  activeView: 'marketplace' | 'non-marketplace';
  onViewChange: (view: 'marketplace' | 'non-marketplace') => void;
  marketplaceCount: number;
  nonMarketplaceCount: number;
}

export function UserViewSwitcher({ 
  activeView, 
  onViewChange, 
  marketplaceCount, 
  nonMarketplaceCount 
}: UserViewSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('marketplace')}
        className={`h-9 px-3 text-sm font-medium transition-all ${
          activeView === 'marketplace'
            ? 'bg-background shadow-sm border border-border text-foreground font-semibold'
            : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent'
        }`}
      >
        Marketplace Users
        <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs font-medium bg-muted text-muted-foreground">
          {marketplaceCount}
        </Badge>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('non-marketplace')}
        className={`h-9 px-3 text-sm font-medium transition-all ${
          activeView === 'non-marketplace'
            ? 'bg-background shadow-sm border border-border text-foreground font-semibold'
            : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent'
        }`}
      >
        Non-Marketplace Contacts
        <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs font-medium bg-muted text-muted-foreground">
          {nonMarketplaceCount}
        </Badge>
      </Button>
    </div>
  );
}
