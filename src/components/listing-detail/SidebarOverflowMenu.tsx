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
  className?: string;
}

export const SidebarOverflowMenu = ({
  listing,
  isInComparison,
  onCompare,
  onDownload,
  className,
}: SidebarOverflowMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className ?? "absolute top-4 right-4 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-slate-300 hover:text-slate-600 hover:bg-transparent"}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
      >
        <DropdownMenuItem
          onClick={onCompare}
          className="h-8 text-[13px] font-normal rounded-md cursor-pointer transition-colors duration-150"
        >
          <Scale className="h-3.5 w-3.5 mr-2.5 text-slate-400" />
          {isInComparison ? "Remove from compare" : "Add to compare"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDownload}
          className="h-8 text-[13px] font-normal rounded-md cursor-pointer transition-colors duration-150"
        >
          <FileDown className="h-3.5 w-3.5 mr-2.5 text-slate-400" />
          Download summary
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
