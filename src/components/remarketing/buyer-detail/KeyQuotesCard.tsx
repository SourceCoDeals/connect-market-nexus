import { useState } from "react";
import { Quote, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface KeyQuotesCardProps {
  quotes?: string[] | null;
}

export const KeyQuotesCard = ({
  quotes,
}: KeyQuotesCardProps) => {
  const [showAll, setShowAll] = useState(false);
  
  if (!quotes || quotes.length === 0) {
    return null;
  }

  const displayQuotes = showAll ? quotes : quotes.slice(0, 3);
  const remainingCount = quotes.length - 3;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Quote className="h-4 w-4" />
          Key Quotes ({quotes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayQuotes.map((quote, index) => (
          <div 
            key={index}
            className="pl-4 border-l-4 border-amber-400 py-1"
          >
            <p className="text-sm text-muted-foreground italic">"{quote}"</p>
          </div>
        ))}
        
        {remainingCount > 0 && !showAll && (
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={() => setShowAll(true)}
          >
            Show {remainingCount} more quotes
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        )}
        
        {showAll && quotes.length > 3 && (
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={() => setShowAll(false)}
          >
            Show less
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
