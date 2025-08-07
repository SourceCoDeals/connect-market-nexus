import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';

interface AlertPreviewProps {
  alertName: string;
  criteria: {
    category?: string;
    categories?: string[];
    location?: string;
    locations?: string[];
    revenueMin?: number;
    revenueMax?: number;
    ebitdaMin?: number;
    ebitdaMax?: number;
    search?: string;
  };
  frequency: string;
  userEmail?: string;
}

export function AlertPreview({ alertName, criteria, frequency, userEmail }: AlertPreviewProps) {
  const formatCriteria = () => {
    const parts = [];
    
    if (criteria.categories && criteria.categories.length > 0) {
      parts.push(`Categories: ${criteria.categories.join(', ')}`);
    } else if (criteria.category && criteria.category !== 'all') {
      parts.push(criteria.category);
    }
    
    if (criteria.locations && criteria.locations.length > 0) {
      parts.push(`Locations: ${criteria.locations.join(', ')}`);
    } else if (criteria.location && criteria.location !== 'all') {
      parts.push(criteria.location);
    }
    
    if (criteria.revenueMin || criteria.revenueMax) {
      const min = criteria.revenueMin ? formatCurrency(criteria.revenueMin) : '0';
      const max = criteria.revenueMax ? formatCurrency(criteria.revenueMax) : '∞';
      parts.push(`${min} - ${max} revenue`);
    }
    
    if (criteria.search) {
      parts.push(`"${criteria.search}"`);
    }
    
    return parts;
  };

  const criteriaList = formatCriteria();

  return (
    <Card className="border-dashed border-2 bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Alert Preview</CardTitle>
            <h3 className="font-semibold mt-1">{alertName || 'Your Deal Alert'}</h3>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {frequency === 'instant' ? 'Instant' : frequency === 'daily' ? 'Daily' : 'Weekly'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {criteriaList.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">You'll be notified for deals matching:</p>
              <div className="flex flex-wrap gap-1">
                {criteriaList.map((criterion, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {criterion}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              You'll be notified for all new deals. Add criteria to narrow your matches.
            </p>
          )}
          
        </div>
      </CardContent>
    </Card>
  );
}