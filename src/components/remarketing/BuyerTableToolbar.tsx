import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  Upload, 
  Sparkles, 
  GitMerge,
  Loader2 
} from "lucide-react";

interface BuyerTableToolbarProps {
  buyerCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddBuyer?: () => void;
  onImportCSV?: () => void;
  onEnrichAll?: () => void;
  onDedupe?: () => void;
  isEnriching?: boolean;
  isDeduping?: boolean;
  selectedCount?: number;
  className?: string;
}

export const BuyerTableToolbar = ({
  buyerCount,
  searchValue,
  onSearchChange,
  onAddBuyer,
  onImportCSV,
  onEnrichAll,
  onDedupe,
  isEnriching = false,
  isDeduping = false,
  selectedCount = 0,
  className = ""
}: BuyerTableToolbarProps) => {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search buyers..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {buyerCount} buyer{buyerCount !== 1 ? 's' : ''}
          {selectedCount > 0 && (
            <span className="ml-1 text-primary font-medium">
              · {selectedCount} selected
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onAddBuyer && (
          <Button onClick={onAddBuyer} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Buyer
          </Button>
        )}
        {onImportCSV && (
          <Button variant="outline" size="sm" onClick={onImportCSV}>
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </Button>
        )}
        {onEnrichAll && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onEnrichAll}
            disabled={isEnriching}
          >
            {isEnriching ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Enrich All
          </Button>
        )}
        {onDedupe && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDedupe}
            disabled={isDeduping}
          >
            {isDeduping ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4 mr-1" />
            )}
            Dedupe
          </Button>
        )}
      </div>
    </div>
  );
};

export default BuyerTableToolbar;
