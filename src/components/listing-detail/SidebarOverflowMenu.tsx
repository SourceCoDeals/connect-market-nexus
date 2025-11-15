import { MoreHorizontal, Scale, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Listing } from "@/types";

interface SidebarOverflowMenuProps {
  listing: Listing;
  isInComparison: boolean;
  onCompare: () => void;
  onDownload: () => void;
}

export const SidebarOverflowMenu = ({
  listing,
  isInComparison,
  onCompare,
  onDownload,
}: SidebarOverflowMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-slate-300 hover:text-slate-600 hover:bg-transparent"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-48 shadow-lg border-slate-200 rounded-lg p-1"
      >
        <DropdownMenuItem
          onClick={onCompare}
          className="h-9 text-[13px] font-medium rounded-md cursor-pointer transition-colors duration-150"
        >
          <Scale className="h-3.5 w-3.5 mr-2" />
          {isInComparison ? "Remove from compare" : "Add to compare"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDownload}
          className="h-9 text-[13px] font-medium rounded-md cursor-pointer transition-colors duration-150"
        >
          <FileDown className="h-3.5 w-3.5 mr-2" />
          Download summary
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
