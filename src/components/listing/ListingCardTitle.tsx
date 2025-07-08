
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ListingCardTitleProps {
  title: string;
}

const ListingCardTitle = ({ title }: ListingCardTitleProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <h3 className="text-lg font-semibold line-clamp-2 mb-3">
            {title}
          </h3>
        </TooltipTrigger>
        <TooltipContent>
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ListingCardTitle;
