import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  MapPin,
  Users,
  Building,
  Target,
  Quote,
  Sparkles,
} from "lucide-react";

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

export function ExtractedIntelligenceView({ extractedData }: { extractedData: Record<string, unknown> }) {
  const extracted = extractedData;
  const hasFinancial = extracted.revenue || extracted.ebitda || extracted.ebitda_margin || extracted.asking_price;
  const hasBusiness = extracted.industry || extracted.location;
  const hasServices = (extracted.services as string[] | undefined)?.length || extracted.service_mix;
  const hasGeography = (extracted.geographic_states as string[] | undefined)?.length || extracted.number_of_locations;
  const hasOwner = extracted.owner_goals || extracted.transition_preferences || extracted.timeline_notes;
  const hasStrategic = extracted.executive_summary || extracted.growth_trajectory;
  const safeKeyQuotes = Array.isArray(extracted.key_quotes) ? extracted.key_quotes : (typeof extracted.key_quotes === 'string' && extracted.key_quotes ? [extracted.key_quotes] : []);
  const hasQuotes = safeKeyQuotes.length;

  const fieldCount = Object.entries(extracted)
    .filter(([key, value]) => key !== 'confidence' && value != null &&
      (Array.isArray(value) ? value.length > 0 : true))
    .length;

  return (
    <div className="bg-primary/5 rounded-lg p-4">
      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Extracted Intelligence
        <Badge variant="secondary" className="text-xs">
          {fieldCount} fields
        </Badge>
      </h4>

      <div className="space-y-4 text-sm">
        {hasFinancial && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <DollarSign className="h-3 w-3" />
              Financial
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {extracted.revenue && (
                <div className="bg-background rounded p-2">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="font-semibold">{formatCurrency(extracted.revenue as number)}</p>
                </div>
              )}
              {extracted.ebitda && (
                <div className="bg-background rounded p-2">
                  <p className="text-xs text-muted-foreground">EBITDA</p>
                  <p className="font-semibold">{formatCurrency(extracted.ebitda as number)}</p>
                </div>
              )}
              {extracted.ebitda_margin && (
                <div className="bg-background rounded p-2">
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p className="font-semibold">{((extracted.ebitda_margin as number) * 100).toFixed(1)}%</p>
                </div>
              )}
              {extracted.asking_price && (
                <div className="bg-background rounded p-2">
                  <p className="text-xs text-muted-foreground">Asking Price</p>
                  <p className="font-semibold">{formatCurrency(extracted.asking_price as number)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {hasBusiness && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Building className="h-3 w-3" />
              Business
            </div>
            <div className="grid grid-cols-2 gap-2">
              {extracted.industry && (
                <div><span className="text-muted-foreground">Industry:</span>{' '}<span className="font-medium">{extracted.industry as string}</span></div>
              )}
              {extracted.location && (
                <div><span className="text-muted-foreground">Location:</span>{' '}<span className="font-medium">{extracted.location as string}</span></div>
              )}
            </div>
          </div>
        )}

        {hasServices && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Users className="h-3 w-3" />
              Services & Model
            </div>
            {(extracted.services as string[] | undefined)?.length ? (
              <div className="flex flex-wrap gap-1">
                {(extracted.services as string[]).map((service, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{service}</Badge>
                ))}
              </div>
            ) : null}
            {extracted.service_mix && (
              <p><span className="text-muted-foreground">Mix:</span> {extracted.service_mix as string}</p>
            )}
          </div>
        )}

        {hasGeography && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <MapPin className="h-3 w-3" />
              Geography
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              {(extracted.geographic_states as string[] | undefined)?.map((state, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{state}</Badge>
              ))}
              {extracted.number_of_locations && (
                <span className="text-sm ml-2">({extracted.number_of_locations as number} locations)</span>
              )}
            </div>
          </div>
        )}

        {hasOwner && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Target className="h-3 w-3" />
              Owner & Transaction
            </div>
            {extracted.owner_goals && (
              <p><span className="text-muted-foreground">Goals:</span> {extracted.owner_goals as string}</p>
            )}
            {extracted.transition_preferences && (
              <p><span className="text-muted-foreground">Transition:</span> {extracted.transition_preferences as string}</p>
            )}
            {extracted.timeline_notes && (
              <p><span className="text-muted-foreground">Timeline:</span> {extracted.timeline_notes as string}</p>
            )}
          </div>
        )}

        {hasStrategic && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              Strategic
            </div>
            {extracted.executive_summary && (
              <p className="bg-background rounded p-2 text-sm">{extracted.executive_summary as string}</p>
            )}
            {extracted.growth_trajectory && (
              <p><span className="text-muted-foreground">Growth:</span> {extracted.growth_trajectory as string}</p>
            )}
          </div>
        )}

        {hasQuotes && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Quote className="h-3 w-3" />
              Key Quotes
            </div>
            <div className="space-y-2">
              {safeKeyQuotes.map((quote: string, i: number) => (
                <blockquote
                  key={i}
                  className="text-sm italic border-l-2 border-primary/30 pl-3 text-muted-foreground"
                >
                  "{quote}"
                </blockquote>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
