import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, MapPin, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency-utils";

interface LivePreviewPanelProps {
  formData: any;
  imagePreview: string | null;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export function LivePreviewPanel({ 
  formData, 
  imagePreview, 
  showPreview, 
  onTogglePreview 
}: LivePreviewPanelProps) {
  return (
    <Card className="sticky top-6 h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Live Preview</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePreview}
          className="h-8 px-2"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-4 w-4 mr-1" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              Show
            </>
          )}
        </Button>
      </CardHeader>

      {showPreview && (
        <CardContent className="space-y-4 text-sm">
          {/* Image Preview */}
          {imagePreview && (
            <div className="aspect-video rounded-md overflow-hidden bg-muted">
              <img 
                src={imagePreview} 
                alt="Listing preview" 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Status Tag */}
          {formData.status_tag && formData.status_tag !== "none" && (
            <Badge variant="secondary" className="text-xs">
              {formData.status_tag.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          )}

          {/* Title */}
          <div>
            <h3 className="font-semibold text-base line-clamp-2">
              {formData.title || "Untitled Business"}
            </h3>
          </div>

          {/* Categories */}
          {formData.categories && formData.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formData.categories.map((cat: string) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          )}

          {/* Location */}
          {formData.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-xs">{formData.location}</span>
            </div>
          )}

          {/* Financials */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Revenue</div>
              <div className="font-semibold flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {formData.revenue ? formatCurrency(parseFloat(formData.revenue.replace(/,/g, ''))) : '$0'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">EBITDA</div>
              <div className="font-semibold flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {formData.ebitda ? formatCurrency(parseFloat(formData.ebitda.replace(/,/g, ''))) : '$0'}
              </div>
            </div>
          </div>

          {/* Description Preview */}
          {formData.description && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-2">Description</div>
              <div className="text-xs line-clamp-4 text-muted-foreground">
                {formData.description}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <Badge variant={formData.status === "active" ? "default" : "secondary"}>
              {formData.status || "active"}
            </Badge>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
