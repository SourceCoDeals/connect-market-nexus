import { Badge } from "@/components/ui/badge";
import { DollarSign, MapPin, Building2, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import ListingCardBadges from "@/components/listing/ListingCardBadges";
import ListingCardTitle from "@/components/listing/ListingCardTitle";
import ListingCardFinancials from "@/components/listing/ListingCardFinancials";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { formatCurrency } from "@/lib/currency-utils";
import { Card, CardContent } from "@/components/ui/card";

interface EditorLivePreviewProps {
  formValues: any;
  imagePreview: string | null;
}

export function EditorLivePreview({ formValues, imagePreview }: EditorLivePreviewProps) {
  // Calculate quality score
  const calculateQuality = () => {
    let score = 0;
    let items = [];
    
    if (formValues.title && formValues.title.length >= 20) {
      score += 20;
      items.push({ label: "Descriptive title", complete: true });
    } else {
      items.push({ label: "Descriptive title (20+ chars)", complete: false });
    }
    
    if (formValues.categories && formValues.categories.length > 0) {
      score += 15;
      items.push({ label: "Industry categories", complete: true });
    } else {
      items.push({ label: "Industry categories", complete: false });
    }
    
    if (formValues.location) {
      score += 15;
      items.push({ label: "Geographic location", complete: true });
    } else {
      items.push({ label: "Geographic location", complete: false });
    }
    
    if (formValues.revenue && parseFloat(formValues.revenue) > 0) {
      score += 15;
      items.push({ label: "Revenue data", complete: true });
    } else {
      items.push({ label: "Revenue data", complete: false });
    }
    
    if (formValues.ebitda && parseFloat(formValues.ebitda) > 0) {
      score += 15;
      items.push({ label: "EBITDA data", complete: true });
    } else {
      items.push({ label: "EBITDA data", complete: false });
    }
    
    if (formValues.description_html && formValues.description_html.length >= 200) {
      score += 15;
      items.push({ label: "Detailed description", complete: true });
    } else {
      items.push({ label: "Detailed description (200+ chars)", complete: false });
    }
    
    if (imagePreview) {
      score += 5;
      items.push({ label: "Featured image", complete: true });
    } else {
      items.push({ label: "Featured image", complete: false });
    }
    
    return { score, items };
  };

  const quality = calculateQuality();

  return (
    <div className="p-5 space-y-5">
        {/* Quality Score */}
        <div className="bg-background rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Listing Quality</h3>
            <span className="text-2xl font-light text-sourceco-accent">{quality.score}%</span>
          </div>
          <Progress value={quality.score} className="h-2" />
          <div className="space-y-2">
            {quality.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {item.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={item.complete ? "text-foreground" : "text-muted-foreground"}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-background rounded-lg border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <h3 className="text-sm font-medium text-foreground">Live Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">How buyers will see this listing</p>
          </div>
          
          <div className="p-4">
            {/* Card Preview - matching ListingCard exactly */}
            <Card className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-1">
              <div className="relative rounded-t-lg">
                <div className="overflow-hidden rounded-t-lg">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt={formValues.title || "Listing preview"}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No image selected</span>
                    </div>
                  )}
                </div>
                <ListingStatusTag status={formValues.status_tag || null} />
              </div>
              
              <CardContent className="p-4 md:p-6">
                <div>
                  <ListingCardBadges
                    location={formValues.location?.[0] || ""}
                  />
                  
                  <ListingCardTitle
                    title={formValues.title || "Untitled Listing"}
                    connectionExists={false}
                    connectionStatus=""
                  />
                  
                  <ListingCardFinancials
                    revenue={formValues.revenue ? parseFloat(formValues.revenue.toString()) : 0}
                    ebitda={formValues.ebitda ? parseFloat(formValues.ebitda.toString()) : 0}
                    description={formValues.description || ""}
                    formatCurrency={formatCurrency}
                  />
                </div>
                
                {/* Rich description preview */}
                <div className="mt-3 text-sm text-muted-foreground line-clamp-3">
                  {formValues.description_html ? (
                    <RichTextDisplay content={formValues.description_html} />
                  ) : formValues.description ? (
                    <span>{formValues.description}</span>
                  ) : (
                    <span className="italic">No description yet...</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
