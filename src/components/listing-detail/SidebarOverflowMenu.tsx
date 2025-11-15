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
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-200"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>

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
    </TooltipProvider>
  );
};
