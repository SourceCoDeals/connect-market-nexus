import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Edit, Trash2, MoreHorizontal, MapPin, Building2, 
  ExternalLink, Sparkles, Star, TrendingUp, Globe, 
  Users, CheckCircle2, AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminListing } from "@/types/admin";
import { formatCurrency, cn } from "@/lib/utils";
import { DealScoreBadge } from "@/components/ma-intelligence/DealScoreBadge";

interface ResearchDealCardProps {
  listing: AdminListing;
  viewMode: 'grid' | 'table';
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ResearchDealCard({
  listing,
  viewMode,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: ResearchDealCardProps) {
  const navigate = useNavigate();
  
  const revenue = Number(listing.revenue) || 0;
  const ebitda = Number(listing.ebitda) || 0;
  const margin = revenue > 0 ? Math.round((ebitda / revenue) * 100) : 0;
  
  // Type assertions for extended fields
  const executiveSummary = (listing as any).executive_summary;
  const serviceMix = (listing as any).service_mix;
  const geographicStates = (listing as any).geographic_states;
  const enrichedAt = (listing as any).enriched_at;
  const dealTotalScore = (listing as any).deal_total_score;
  const linkedinEmployeeCount = (listing as any).linkedin_employee_count;
  const googleRating = (listing as any).google_rating;
  const googleReviewsCount = (listing as any).google_reviews_count;
  const companyWebsite = (listing as any).company_website;
  const isPriorityTarget = (listing as any).is_priority_target;
  
  const qualityScore = dealTotalScore || null;
  const isEnriched = !!enrichedAt;
  
  // Parse geographic states
  const states = Array.isArray(geographicStates) 
    ? geographicStates.slice(0, 3) 
    : typeof geographicStates === 'string' 
      ? geographicStates.split(',').slice(0, 3).map(s => s.trim())
      : [];

  // Score color classes
  const getScoreColor = (score: number | null) => {
    if (!score) return "bg-muted text-muted-foreground";
    if (score >= 80) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (score >= 60) return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    if (score >= 40) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  if (viewMode === 'table') {
    return (
      <Card className="hover:shadow-sm transition-all duration-200 border border-border/50">
        <div className="p-4 flex items-center gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          
          <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            {/* Company Name & Summary */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                {isPriorityTarget && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                <h3 className="font-semibold text-[15px] text-foreground truncate">
                  {listing.internal_company_name || listing.title}
                </h3>
              </div>
              {executiveSummary && (
                <p className="text-xs text-muted-foreground line-clamp-1">{executiveSummary}</p>
              )}
            </div>

            {/* Score */}
            <div className="text-center">
              {qualityScore ? (
                <DealScoreBadge score={qualityScore} size="sm" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>

            {/* Revenue */}
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">{formatCurrency(revenue)}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Revenue</div>
            </div>

            {/* EBITDA */}
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">{formatCurrency(ebitda)}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">EBITDA</div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(`/admin/remarketing/deals/${listing.id}`)}
                className="h-8 w-8 p-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/admin/remarketing/matching/${listing.id}`)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Match Buyers
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border border-border/50 bg-card overflow-hidden">
      {/* Header Row - Status & Score */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          {isPriorityTarget && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-semibold uppercase tracking-wide">
              <Star className="h-3 w-3 mr-1 fill-current" />
              Priority
            </Badge>
          )}
          {isEnriched ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-medium">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Enriched
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-medium">
              <AlertCircle className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          )}
        </div>
        
        {qualityScore && (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm font-semibold",
            getScoreColor(qualityScore)
          )}>
            <TrendingUp className="h-3.5 w-3.5" />
            {qualityScore}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-5 space-y-4">
        {/* Company Name */}
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">
            {listing.internal_company_name || listing.title}
          </h3>
        </div>

        {/* Executive Summary */}
        {executiveSummary && (
          <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
            {executiveSummary}
          </p>
        )}

        {/* Tags Row - Industry, Geography, Google */}
        <div className="flex flex-wrap gap-1.5">
          {listing.category && (
            <Badge variant="outline" className="text-[11px] font-medium bg-background border-border/60">
              <Building2 className="h-3 w-3 mr-1 text-muted-foreground" />
              {listing.category}
            </Badge>
          )}
          {states.length > 0 && states.map((state, i) => (
            <Badge key={i} variant="outline" className="text-[11px] font-medium bg-background border-border/60">
              <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
              {state}
            </Badge>
          ))}
          {googleRating && (
            <Badge variant="outline" className="text-[11px] font-medium bg-background border-border/60">
              <Star className="h-3 w-3 mr-1 text-amber-500 fill-amber-500" />
              {googleRating.toFixed(1)} {googleReviewsCount && `(${googleReviewsCount})`}
            </Badge>
          )}
          {linkedinEmployeeCount && (
            <Badge variant="outline" className="text-[11px] font-medium bg-background border-border/60">
              <Users className="h-3 w-3 mr-1 text-muted-foreground" />
              {linkedinEmployeeCount} emp
            </Badge>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/30" />

        {/* Financial Metrics - Inline */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">{formatCurrency(revenue)}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-medium text-foreground">{formatCurrency(ebitda)}</span>
          {margin > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">{margin}% margin</span>
            </>
          )}
        </div>

        {/* Website Link */}
        {companyWebsite && (
          <>
            <div className="border-t border-border/30" />
            <a 
              href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] text-primary hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              {companyWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </>
        )}

        {/* Divider before actions */}
        <div className="border-t border-border/30" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/remarketing/deals/${listing.id}`)}
            className="flex-1 h-9 text-[13px] font-medium"
          >
            View Deal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/remarketing/matching/${listing.id}`)}
            className="flex-1 h-9 text-[13px] font-medium"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Match Buyers
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Deal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}