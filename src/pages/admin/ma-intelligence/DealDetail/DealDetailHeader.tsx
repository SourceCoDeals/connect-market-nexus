import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Sparkles,
  MoreVertical,
  Archive,
  Trash2,
  TrendingUp,
  FileText,
} from "lucide-react";
import { DealScoreBadge } from "@/components/ma-intelligence";
import type { DealDetailHeaderProps } from "./types";

export function DealDetailHeader({
  deal,
  tracker,
  onNavigateBack,
  onNavigateToTracker,
  onCalculateScore,
  onEnrich,
  onOpenTranscriptDialog,
  onArchive,
  onDelete,
}: DealDetailHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onNavigateBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{deal.deal_name}</h1>
              {deal.company_website && (
                <a
                  href={deal.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {deal.company_website}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tracker && (
            <Badge
              variant="outline"
              className="cursor-pointer"
              onClick={() => onNavigateToTracker(tracker.id)}
            >
              {tracker.name}
            </Badge>
          )}
          {deal.deal_score !== null && deal.deal_score !== undefined && (
            <DealScoreBadge score={deal.deal_score} />
          )}
          <Badge variant={deal.status === "active" ? "default" : "secondary"}>
            {deal.status || "Unknown"}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="w-4 h-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCalculateScore}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Calculate Score
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEnrich}>
                <Sparkles className="w-4 h-4 mr-2" />
                Enrich Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenTranscriptDialog}>
                <FileText className="w-4 h-4 mr-2" />
                Add Transcript
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Archive Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <QuickInfoCard
          icon="dollar"
          title="Revenue"
          value={deal.revenue
            ? `$${deal.revenue >= 1000000
                ? `${(deal.revenue / 1000000).toFixed(1)}M`
                : `${(deal.revenue / 1000).toFixed(0)}K`}`
            : "\u2014"}
          subtitle={deal.revenue_confidence ? `${deal.revenue_confidence} confidence` : undefined}
        />
        <QuickInfoCard
          icon="trending"
          title="EBITDA"
          value={deal.ebitda_amount
            ? `$${deal.ebitda_amount >= 1000000
                ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M`
                : `${(deal.ebitda_amount / 1000).toFixed(0)}K`}`
            : deal.ebitda_percentage
            ? `${deal.ebitda_percentage}%`
            : "\u2014"}
          subtitle={deal.ebitda_confidence ? `${deal.ebitda_confidence} confidence` : undefined}
        />
        <QuickInfoCard
          icon="location"
          title="Location"
          value={deal.headquarters || "\u2014"}
          subtitle={deal.location_count ? `${deal.location_count} location${deal.location_count !== 1 ? "s" : ""}` : undefined}
        />
        <QuickInfoCard
          icon="users"
          title="Employees"
          value={deal.employee_count ? String(deal.employee_count) : "\u2014"}
          subtitle={deal.founded_year ? `Founded ${deal.founded_year}` : undefined}
        />
      </div>
    </>
  );
}

// Inline sub-component to avoid importing too many UI primitives
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, MapPin, Users } from "lucide-react";

function QuickInfoCard({ icon, title, value, subtitle }: { icon: string; title: string; value: string; subtitle?: string }) {
  const IconComponent = icon === "dollar" ? DollarSign
    : icon === "trending" ? TrendingUp
    : icon === "location" ? MapPin
    : Users;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <IconComponent className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
