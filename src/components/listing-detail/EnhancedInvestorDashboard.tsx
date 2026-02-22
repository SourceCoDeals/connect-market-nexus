// No UI imports needed - using pure document styling
import { AdminListing } from "@/types/admin";

interface EnhancedInvestorDashboardProps {
  listing: AdminListing;
  formatCurrency: (value: number) => string;
}

// Normalize JSONB fields that may be stored as string or array
const normalizeToArray = (value: string[] | string | undefined | null): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
};

export function EnhancedInvestorDashboard({ listing, formatCurrency: _formatCurrency }: EnhancedInvestorDashboardProps) {
  // Normalize arrays to handle both string and array formats from DB
  const keyRisks = normalizeToArray(listing.key_risks);
  const growthDrivers = normalizeToArray(listing.growth_drivers);



  return (
    <div className="space-y-5">

      {/* Revenue Model Breakdown */}
      {listing.revenue_model_breakdown && Object.keys(listing.revenue_model_breakdown).length > 0 && (
        <div className="space-y-4 pt-8 border-t border-slate-100">
          <span className="document-label">Revenue Composition</span>
          <div className="space-y-3">
            {Object.entries(listing.revenue_model_breakdown).map(([type, percentage]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="document-subtitle capitalize">{type.replace('_', ' ')}</span>
                <span className="document-value">{percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment Thesis */}
      {listing.investment_thesis && (
        <div className="space-y-4 pt-8 border-t border-slate-100">
          <h2 className="text-sm font-medium leading-5">Investment Thesis</h2>
          <p className="document-subtitle leading-relaxed">{listing.investment_thesis}</p>
        </div>
      )}

      {/* Growth Drivers */}
      {growthDrivers.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-slate-100">
          <h2 className="text-sm font-medium leading-5">Growth Catalysts</h2>
          <div className="space-y-2">
            {growthDrivers.map((driver) => (
              <div key={driver} className="document-subtitle">
                • {driver}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {keyRisks.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-slate-100">
          <h2 className="text-sm font-medium leading-5">Risk Factors</h2>
          <div className="space-y-2">
            {keyRisks.map((risk) => (
              <div key={risk} className="document-subtitle">
                • {risk}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}