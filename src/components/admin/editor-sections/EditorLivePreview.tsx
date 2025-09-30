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
    <div className="hidden lg:block fixed right-0 top-0 w-[420px] h-full bg-muted/30 border-l border-border overflow-y-auto">
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
          
          <div className="p-0">
            {/* Card Preview - matching ListingCard exactly */}
            <div className="bg-background rounded-lg border border-border overflow-hidden m-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/5">
              <div className="relative">
                {/* Image */}
                {imagePreview ? (
                  <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video rounded-t-lg bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No image uploaded</p>
                  </div>
                )}

                {/* Status Tag - positioned exactly like real listing */}
                {formValues.status_tag && formValues.status_tag !== "none" && (
                  <Badge 
                    variant="default"
                    className="absolute -top-2 left-3 z-20 px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wide flex items-center gap-1.5 shadow-lg bg-slate-800 text-white border border-slate-700/50 backdrop-blur-sm"
                  >
                    {formValues.status_tag === "just_listed" && "Just Listed"}
                    {formValues.status_tag === "reviewing_buyers" && "Reviewing Buyers"}
                    {formValues.status_tag === "in_diligence" && "In Diligence"}
                    {formValues.status_tag === "under_loi" && "Under LOI"}
                    {formValues.status_tag === "accepted_offer" && "Accepted Offer"}
                  </Badge>
                )}
              </div>

              <div className="p-4 space-y-3">
                {/* Categories & Location Badges */}
                <div className="flex flex-wrap gap-2">
                  {formValues.categories && formValues.categories.length > 0 && (
                    <>
                      {formValues.categories.slice(0, 2).map((cat: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-normal bg-secondary/50">
                          <Building2 className="h-3 w-3 mr-1" />
                          {cat}
                        </Badge>
                      ))}
                    </>
                  )}
                  {formValues.location && (
                    <Badge variant="secondary" className="text-xs font-normal bg-secondary/50">
                      <MapPin className="h-3 w-3 mr-1" />
                      {formValues.location}
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-lg font-medium text-foreground line-clamp-2 leading-tight">
                  {formValues.title || "Untitled Business"}
                </h2>

                {/* Financials */}
                <div className="flex gap-4 pt-1">
                  {formValues.revenue && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Revenue</div>
                      <p className="text-sm font-semibold text-foreground">
                        ${formValues.revenue}M
                      </p>
                    </div>
                  )}
                  {formValues.ebitda && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">EBITDA</div>
                      <p className="text-sm font-semibold text-foreground">
                        ${formValues.ebitda}M
                      </p>
                    </div>
                  )}
                </div>

                {/* Description Preview */}
                {formValues.description_html && (
                  <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    <div dangerouslySetInnerHTML={{ __html: formValues.description_html }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
