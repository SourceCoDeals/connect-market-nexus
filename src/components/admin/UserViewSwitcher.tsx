import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserViewSwitcherProps {
  primaryView: 'buyers' | 'owners';
  secondaryView: 'marketplace' | 'non-marketplace';
  onPrimaryViewChange: (view: 'buyers' | 'owners') => void;
  onSecondaryViewChange: (view: 'marketplace' | 'non-marketplace') => void;
  marketplaceCount: number;
  nonMarketplaceCount: number;
  ownerLeadsCount: number;
}

export function UserViewSwitcher({ 
  primaryView,
  secondaryView,
  onPrimaryViewChange,
  onSecondaryViewChange,
  marketplaceCount, 
  nonMarketplaceCount,
  ownerLeadsCount
}: UserViewSwitcherProps) {
  return (
    <div className="space-y-3">
      {/* Primary Level: Buyers / Owners */}
      <div className="inline-flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPrimaryViewChange('buyers')}
          className={`h-9 px-3 text-sm font-medium transition-all ${
            primaryView === 'buyers'
              ? 'bg-background shadow-sm border border-border text-foreground font-semibold'
              : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent'
          }`}
        >
          Buyers
          <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs font-medium bg-muted text-muted-foreground">
            {marketplaceCount + nonMarketplaceCount}
          </Badge>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPrimaryViewChange('owners')}
          className={`h-9 px-3 text-sm font-medium transition-all ${
            primaryView === 'owners'
              ? 'bg-background shadow-sm border border-border text-foreground font-semibold'
              : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent'
          }`}
        >
          Owners
          <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs font-medium bg-muted text-muted-foreground">
            {ownerLeadsCount}
          </Badge>
        </Button>
      </div>

      {/* Secondary Level: Marketplace / Non-Marketplace (only visible when Buyers is active) */}
      {primaryView === 'buyers' && (
        <div className="inline-flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSecondaryViewChange('marketplace')}
            className={`h-8 px-3 text-xs font-medium transition-all ${
              secondaryView === 'marketplace'
                ? 'bg-background shadow-sm border border-border text-foreground font-semibold'
                : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent'
            }`}
          >
            Marketplace Users
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px] font-medium bg-muted text-muted-foreground">
              {marketplaceCount}
            </Badge>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSecondaryViewChange('non-marketplace')}
            className={`h-8 px-3 text-xs font-medium transition-all ${
              secondaryView === 'non-marketplace'
                ? 'bg-background shadow-sm border border-border text-foreground font-semibold'
                : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent'
            }`}
          >
            Non-Marketplace Contacts
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px] font-medium bg-muted text-muted-foreground">
              {nonMarketplaceCount}
            </Badge>
          </Button>
        </div>
      )}
    </div>
  );
}
