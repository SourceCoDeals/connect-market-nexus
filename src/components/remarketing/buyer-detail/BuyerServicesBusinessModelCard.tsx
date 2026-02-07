import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuyerServicesBusinessModelCardProps {
  servicesOffered?: string | null;
  businessModel?: string | null;
  revenueModel?: string | null;
  onEdit: () => void;
  className?: string;
}

/**
 * Parse services_offered which may be:
 * - A JSON array string: '["Water mitigation", "Roofing"]'
 * - A comma-separated string: 'Water mitigation, Roofing'
 * - A plain text description (prose)
 */
function parseServices(raw: string): { items: string[] | null; text: string | null } {
  const trimmed = raw.trim();
  
  // Try JSON array parse
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return { items: parsed.map(String).filter(Boolean), text: null };
      }
    } catch {
      // Not valid JSON, treat as text
    }
  }
  
  // Check if it reads like prose (has periods, long sentences, etc.)
  const hasSentences = trimmed.includes('. ') || trimmed.length > 120;
  if (hasSentences) {
    return { items: null, text: trimmed };
  }
  
  // If it's short and comma-separated (no long sentences), treat as list
  const parts = trimmed.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every(p => p.length < 60)) {
    return { items: parts, text: null };
  }
  
  // Single short value — treat as text
  return { items: null, text: trimmed };
}

export const BuyerServicesBusinessModelCard = ({
  servicesOffered,
  businessModel,
  revenueModel,
  onEdit,
  className,
}: BuyerServicesBusinessModelCardProps) => {
  const hasContent = servicesOffered || businessModel || revenueModel;
  const services = servicesOffered ? parseServices(servicesOffered) : null;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Store className="h-4 w-4" />
            Services & Business Model
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground italic">No services or business model specified</p>
        ) : (
          <>
            {/* Business Type as a badge label */}
            {businessModel && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Business Type
                </p>
                <Badge variant="outline" className="text-xs">
                  {businessModel}
                </Badge>
              </div>
            )}

            {/* Services - prose or badges */}
            {services && (
              <div className={businessModel ? "pt-3 border-t" : ""}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Service Mix
                </p>
                {services.text ? (
                  <p className="text-sm leading-relaxed">{services.text}</p>
                ) : services.items ? (
                  <div className="flex flex-wrap gap-1.5">
                    {services.items.map((service, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Revenue Model - always prose */}
            {revenueModel && (
              <div className={(businessModel || services) ? "pt-3 border-t" : ""}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Revenue Model
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {revenueModel}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BuyerServicesBusinessModelCard;
