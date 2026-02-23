import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ExternalLink,
  Flag,
  Globe,
  History,
  Loader2,
  Pencil,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UniverseAssignmentButton } from "@/components/remarketing/deal-detail";

interface WebsiteActionsCardProps {
  deal: any;
  dealId: string;
  effectiveWebsite: string | null;
  scoreStats: { count: number; approved: number; passed: number; avgScore: number } | undefined;
  isEnriching: boolean;
  enrichmentProgress: number;
  enrichmentStage: string;
  handleEnrichFromWebsite: () => void;
  setBuyerHistoryOpen: (v: boolean) => void;
  toggleContactOwnerMutation: { mutate: (v: boolean) => void; isPending: boolean };
  toggleUniverseFlagMutation: { mutate: (v: boolean) => void; isPending: boolean };
}

export function WebsiteActionsCard({
  deal,
  dealId,
  effectiveWebsite,
  scoreStats,
  isEnriching,
  enrichmentProgress,
  enrichmentStage,
  handleEnrichFromWebsite,
  setBuyerHistoryOpen,
  toggleContactOwnerMutation,
  toggleUniverseFlagMutation,
}: WebsiteActionsCardProps) {
  const needsContact = deal?.needs_owner_contact;

  return (
    <Card className={needsContact ? "border-red-400 border-2 bg-red-50 dark:bg-red-950/20" : ""}>
      {needsContact && (
        <div className="bg-red-500 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2 rounded-t-lg">
          <PhoneCall className="h-4 w-4 animate-pulse" />
          ACTION REQUIRED: Owner needs to be contacted — we have a buyer ready!
        </div>
      )}
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-lg flex items-center gap-2 ${needsContact ? "text-red-700" : ""}`}>
            <Globe className="h-5 w-5" />
            Website & Actions
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        {effectiveWebsite && (
          <p className="text-sm text-muted-foreground truncate">
            {effectiveWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-3">
          {effectiveWebsite && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={effectiveWebsite.startsWith('http') ? effectiveWebsite : `https://${effectiveWebsite}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                View Website
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleEnrichFromWebsite}
            disabled={isEnriching || !effectiveWebsite}
          >
            {isEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Enrich from Website
          </Button>
          <UniverseAssignmentButton
            dealId={dealId}
            dealCategory={deal?.category}
            scoreCount={scoreStats?.count || 0}
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setBuyerHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            Buyer History
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={needsContact ? "default" : "outline"}
                  className={`gap-2 font-semibold ${needsContact
                    ? "bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-md shadow-red-200"
                    : "border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500"
                  }`}
                  onClick={() => toggleContactOwnerMutation.mutate(!needsContact)}
                  disabled={toggleContactOwnerMutation.isPending}
                >
                  {toggleContactOwnerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneCall className={`h-4 w-4 ${needsContact ? "animate-pulse" : ""}`} />
                  )}
                  {needsContact ? "\u{1F6A8} Needs Owner Contact" : "Flag: Contact Owner"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {needsContact
                  ? "This deal is flagged \u2014 team must contact the owner, we have a buyer ready! Click to clear."
                  : "Flag this deal to alert the team that the owner needs to be contacted (buyer is ready)."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={(deal?.universe_build_flagged) ? "default" : "outline"}
                  className={`gap-2 ${(deal?.universe_build_flagged) ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : "border-amber-400 text-amber-600 hover:bg-amber-50"}`}
                  onClick={() => toggleUniverseFlagMutation.mutate(!(deal?.universe_build_flagged))}
                  disabled={toggleUniverseFlagMutation.isPending}
                >
                  {toggleUniverseFlagMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Flag className={`h-4 w-4 ${(deal?.universe_build_flagged) ? "fill-white" : ""}`} />
                  )}
                  {(deal?.universe_build_flagged) ? "Flagged: Build Universe" : "Flag for Universe Build"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {(deal?.universe_build_flagged)
                  ? "This deal is flagged \u2014 a team member needs to build a buyer universe for it. Click to remove flag."
                  : "Flag this deal to indicate a buyer universe needs to be built by the team."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {isEnriching && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {enrichmentStage}
              </span>
              <span className="text-muted-foreground font-medium">{Math.round(enrichmentProgress)}%</span>
            </div>
            <Progress value={enrichmentProgress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
