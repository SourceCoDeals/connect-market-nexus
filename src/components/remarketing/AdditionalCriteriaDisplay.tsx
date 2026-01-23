import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  MapPin, 
  Wrench, 
  Pencil,
  Building2,
  Users,
  Ruler
} from "lucide-react";
import { SizeCriteria, GeographyCriteria, ServiceCriteria } from "@/types/remarketing";

interface AdditionalCriteriaDisplayProps {
  sizeCriteria: SizeCriteria;
  geographyCriteria: GeographyCriteria;
  serviceCriteria: ServiceCriteria;
  onEdit?: () => void;
  className?: string;
}

const formatCurrency = (value: number | undefined) => {
  if (!value) return '-';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
};

export const AdditionalCriteriaDisplay = ({
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  onEdit,
  className = ""
}: AdditionalCriteriaDisplayProps) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Additional Criteria
        </h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Size Criteria Card */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Size Criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground text-xs block">Min Revenue</span>
                <span className="font-medium">{formatCurrency(sizeCriteria.revenue_min)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Max Revenue</span>
                <span className="font-medium">{formatCurrency(sizeCriteria.revenue_max)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground text-xs block">Min EBITDA</span>
                <span className="font-medium">{formatCurrency(sizeCriteria.ebitda_min)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Max EBITDA</span>
                <span className="font-medium">{formatCurrency(sizeCriteria.ebitda_max)}</span>
              </div>
            </div>
            {(sizeCriteria.locations_min !== undefined || sizeCriteria.locations_max !== undefined) && (
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Locations:</span>
                <span className="font-medium">
                  {sizeCriteria.locations_min || 1} - {sizeCriteria.locations_max || '∞'}
                </span>
              </div>
            )}
            {(sizeCriteria.employee_min !== undefined || sizeCriteria.employee_max !== undefined) && (
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Employees:</span>
                <span className="font-medium">
                  {sizeCriteria.employee_min || 0} - {sizeCriteria.employee_max || '∞'}
                </span>
              </div>
            )}
            {sizeCriteria.total_sqft_min !== undefined && (
              <div className="flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Total Sq Ft:</span>
                <span className="font-medium">{sizeCriteria.total_sqft_min.toLocaleString()}+</span>
              </div>
            )}
            {sizeCriteria.other_notes && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-xs block">Other</span>
                <span className="text-xs">{sizeCriteria.other_notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service/Product Mix Card */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Service / Product Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {serviceCriteria.required_services && serviceCriteria.required_services.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Required</span>
                <div className="flex flex-wrap gap-1">
                  {serviceCriteria.required_services.map((service, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {serviceCriteria.excluded_services && serviceCriteria.excluded_services.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Excluded</span>
                <div className="flex flex-wrap gap-1">
                  {serviceCriteria.excluded_services.map((service, idx) => (
                    <Badge key={idx} variant="destructive" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {serviceCriteria.business_model && (
              <div>
                <span className="text-muted-foreground text-xs block">Business Model</span>
                <span className="font-medium text-xs">{serviceCriteria.business_model}</span>
              </div>
            )}
            {serviceCriteria.customer_profile && (
              <div>
                <span className="text-muted-foreground text-xs block">Customer Profile</span>
                <span className="font-medium text-xs">{serviceCriteria.customer_profile}</span>
              </div>
            )}
            {!serviceCriteria.required_services?.length && 
             !serviceCriteria.excluded_services?.length && 
             !serviceCriteria.business_model && 
             !serviceCriteria.customer_profile && (
              <span className="text-muted-foreground text-xs">No service criteria defined</span>
            )}
          </CardContent>
        </Card>

        {/* Geography Card */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Geography
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {geographyCriteria.target_regions && geographyCriteria.target_regions.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Required Regions</span>
                <div className="flex flex-wrap gap-1">
                  {geographyCriteria.target_regions.map((region, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {geographyCriteria.target_states && geographyCriteria.target_states.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Target States</span>
                <div className="flex flex-wrap gap-1">
                  {geographyCriteria.target_states.slice(0, 6).map((state, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {state}
                    </Badge>
                  ))}
                  {geographyCriteria.target_states.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{geographyCriteria.target_states.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {geographyCriteria.coverage && (
              <div>
                <span className="text-muted-foreground text-xs block">Coverage</span>
                <span className="font-medium text-xs capitalize">{geographyCriteria.coverage}</span>
              </div>
            )}
            {geographyCriteria.hq_requirements && (
              <div>
                <span className="text-muted-foreground text-xs block">HQ Requirements</span>
                <span className="text-xs">{geographyCriteria.hq_requirements}</span>
              </div>
            )}
            {geographyCriteria.other_notes && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-xs block">Other</span>
                <span className="text-xs">{geographyCriteria.other_notes}</span>
              </div>
            )}
            {!geographyCriteria.target_regions?.length && 
             !geographyCriteria.target_states?.length && 
             !geographyCriteria.coverage &&
             !geographyCriteria.hq_requirements && (
              <span className="text-muted-foreground text-xs">No geography criteria defined</span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdditionalCriteriaDisplay;
