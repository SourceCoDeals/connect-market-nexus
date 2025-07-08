
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ListingFinancialsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

const ListingFinancials = ({ revenue, ebitda, formatCurrency }: ListingFinancialsProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Financial Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Annual Revenue:</span>
              <span className="font-semibold">{formatCurrency(revenue)}</span>
            </div>
            <div className="h-2 bg-muted rounded">
              <div className="h-full bg-primary rounded" style={{ width: '100%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Annual EBITDA:</span>
              <span className="font-semibold">{formatCurrency(ebitda)}</span>
            </div>
            <div className="h-2 bg-muted rounded">
              <div className="h-full bg-primary rounded" style={{ 
                width: `${Math.min((ebitda / revenue) * 100, 100)}%` 
              }}></div>
            </div>
          </div>

          {revenue > 0 && (
            <div className="pt-2 border-t mt-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">EBITDA Margin:</span>
                <span className="font-semibold">
                  {((ebitda / revenue) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ListingFinancials;
