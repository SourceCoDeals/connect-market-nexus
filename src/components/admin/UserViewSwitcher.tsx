import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center gap-6">
      {/* Primary Level: Buyers / Owners */}
      <div className="inline-flex items-center rounded-lg bg-muted/50 p-1">
        <button
          onClick={() => onPrimaryViewChange('buyers')}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            primaryView === 'buyers'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Buyers
          <Badge variant="secondary" className={cn(
            "h-5 min-w-[28px] justify-center px-1.5 text-xs font-medium",
            primaryView === 'buyers' ? 'bg-muted' : 'bg-transparent'
          )}>
            {marketplaceCount + nonMarketplaceCount}
          </Badge>
        </button>
        <button
          onClick={() => onPrimaryViewChange('owners')}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            primaryView === 'owners'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Owners
          <Badge variant="secondary" className={cn(
            "h-5 min-w-[28px] justify-center px-1.5 text-xs font-medium",
            primaryView === 'owners' ? 'bg-muted' : 'bg-transparent'
          )}>
            {ownerLeadsCount}
          </Badge>
        </button>
      </div>

      {/* Divider */}
      {primaryView === 'buyers' && (
        <div className="h-5 w-px bg-border" />
      )}

      {/* Secondary Level: Marketplace / Non-Marketplace (only for Buyers) */}
      {primaryView === 'buyers' && (
        <div className="inline-flex items-center rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => onSecondaryViewChange('marketplace')}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              secondaryView === 'marketplace'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Marketplace
            <Badge variant="secondary" className={cn(
              "h-5 min-w-[28px] justify-center px-1.5 text-xs font-medium",
              secondaryView === 'marketplace' ? 'bg-muted' : 'bg-transparent'
            )}>
              {marketplaceCount}
            </Badge>
          </button>
          <button
            onClick={() => onSecondaryViewChange('non-marketplace')}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              secondaryView === 'non-marketplace'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Non-Marketplace
            <Badge variant="secondary" className={cn(
              "h-5 min-w-[28px] justify-center px-1.5 text-xs font-medium",
              secondaryView === 'non-marketplace' ? 'bg-muted' : 'bg-transparent'
            )}>
              {nonMarketplaceCount}
            </Badge>
          </button>
        </div>
      )}
    </div>
  );
}
