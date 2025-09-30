import { Badge } from "@/components/ui/badge";
import { DollarSign, MapPin, Building2, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
    <div className="fixed right-0 top-0 w-[480px] h-full bg-muted/30 border-l border-border overflow-y-auto">
      <div className="p-6 space-y-6">
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
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <h3 className="text-sm font-medium text-foreground">Live Preview</h3>
            <p className="text-xs text-muted-foreground mt-1">How buyers will see this listing</p>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Image */}
            {imagePreview ? (
              <div className="aspect-video rounded-md overflow-hidden bg-muted">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No image uploaded</p>
              </div>
            )}

            {/* Status Tag */}
            {formValues.status_tag && formValues.status_tag !== "none" && (
              <Badge className="bg-sourceco-accent text-sourceco-accent-foreground">
                {formValues.status_tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            )}

            {/* Title */}
            <h2 className="text-xl font-medium text-foreground line-clamp-2">
              {formValues.title || "Untitled Business"}
            </h2>

            {/* Categories */}
            {formValues.categories && formValues.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formValues.categories.map((cat: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="bg-muted">
                    <Building2 className="h-3 w-3 mr-1" />
                    {cat}
                  </Badge>
                ))}
              </div>
            )}

            {/* Location */}
            {formValues.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {formValues.location}
              </div>
            )}

            {/* Financials */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {formValues.revenue && (
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    Revenue
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    ${formValues.revenue}M
                  </p>
                </div>
              )}
              {formValues.ebitda && (
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3 w-3" />
                    EBITDA
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    ${formValues.ebitda}M
                  </p>
                </div>
              )}
            </div>

            {/* Description Preview */}
            {formValues.description_html && (
              <div className="prose prose-sm max-w-none">
                <div 
                  className="text-sm text-muted-foreground line-clamp-4"
                  dangerouslySetInnerHTML={{ __html: formValues.description_html }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
