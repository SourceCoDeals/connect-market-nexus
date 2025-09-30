import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, DollarSign, TrendingUp, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePreviewPanelProps {
  formValues: any;
  imagePreview: string | null;
}

export function LivePreviewPanel({ formValues, imagePreview }: LivePreviewPanelProps) {
  const qualityChecks = [
    { label: "Business title", check: !!formValues.title, required: true },
    { label: "Categories selected", check: formValues.categories?.length > 0, required: true },
    { label: "Location specified", check: formValues.locations?.length > 0, required: true },
    { label: "Description (100+ chars)", check: formValues.business_description?.length >= 100, required: true },
    { label: "Financial metrics", check: !!(formValues.revenue || formValues.ebitda), required: false },
    { label: "Listing image", check: !!imagePreview, required: true },
  ];

  const requiredComplete = qualityChecks.filter(c => c.required && c.check).length;
  const requiredTotal = qualityChecks.filter(c => c.required).length;
  const optionalComplete = qualityChecks.filter(c => !c.required && c.check).length;
  const optionalTotal = qualityChecks.filter(c => !c.required).length;

  const overallScore = Math.round(((requiredComplete + optionalComplete) / qualityChecks.length) * 100);

  return (
    <div className="h-full flex flex-col border-l bg-card/30">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Live Preview</h3>
        </div>

        {/* Quality Score */}
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Content Quality</span>
              <span className={cn(
                "text-2xl font-bold",
                overallScore >= 80 ? "text-green-600" : overallScore >= 60 ? "text-yellow-600" : "text-orange-600"
              )}>
                {overallScore}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  overallScore >= 80 ? "bg-green-600" : overallScore >= 60 ? "bg-yellow-600" : "bg-orange-600"
                )}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Required: {requiredComplete}/{requiredTotal}</span>
              <span>Optional: {optionalComplete}/{optionalTotal}</span>
            </div>
          </div>
        </Card>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Quality Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quality Checklist</h4>
            <div className="space-y-2">
              {qualityChecks.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {item.check ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className={cn(
                      "w-4 h-4 flex-shrink-0",
                      item.required ? "text-orange-600" : "text-muted-foreground/40"
                    )} />
                  )}
                  <span className={cn(
                    item.check ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buyer View</h4>
            <Card className="overflow-hidden">
              {imagePreview && (
                <div className="aspect-video w-full bg-muted relative overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold line-clamp-1">
                    {formValues.title || "Business Title"}
                  </h3>
                  {formValues.categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formValues.categories.slice(0, 2).map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  {formValues.locations?.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-xs">{formValues.locations[0]}</span>
                    </div>
                  )}
                  {formValues.revenue && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-xs">Revenue: {formValues.revenue}</span>
                    </div>
                  )}
                  {formValues.ebitda && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-xs">EBITDA: {formValues.ebitda}</span>
                    </div>
                  )}
                </div>

                {formValues.business_description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {formValues.business_description.replace(/<[^>]*>/g, '')}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Professional Tips */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Professional Tips</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>• Use clear, investment-grade language</p>
              <p>• Focus on business fundamentals and growth</p>
              <p>• Include specific metrics and achievements</p>
              <p>• Highlight unique competitive advantages</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
