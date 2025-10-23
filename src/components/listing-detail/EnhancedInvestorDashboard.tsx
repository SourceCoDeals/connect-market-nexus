// No UI imports needed - using pure document styling
import { AdminListing } from "@/types/admin";
import { RevenueIcon, EBITDAIcon, MarginIcon, EmployeesIcon, ChartIcon } from "@/components/icons/MetricIcons";

interface EnhancedInvestorDashboardProps {
  listing: AdminListing;
  formatCurrency: (value: number) => string;
}

export function EnhancedInvestorDashboard({ listing, formatCurrency }: EnhancedInvestorDashboardProps) {
  const ebitdaMargin = listing.revenue > 0 ? ((listing.ebitda / listing.revenue) * 100) : 0;
  
  // Check if employees data exists
  const hasEmployees = (listing.full_time_employees && listing.full_time_employees > 0) || 
                       (listing.part_time_employees && listing.part_time_employees > 0);
  
  // Format employees display
  const employeesDisplay = () => {
    const ft = listing.full_time_employees || 0;
    const pt = listing.part_time_employees || 0;
    return `${ft}FT/${pt}PT`;
  };

  // Calculate quality scores
  const getMarginQuality = (margin: number) => {
    if (margin >= 20) return { score: 95, label: 'Excellent', color: 'default' };
    if (margin >= 15) return { score: 85, label: 'Strong', color: 'secondary' };
    if (margin >= 10) return { score: 70, label: 'Good', color: 'outline' };
    return { score: 50, label: 'Fair', color: 'destructive' };
  };

  const getCustomerRisk = (concentration?: number) => {
    if (!concentration) return { score: 70, label: 'Unknown', color: 'outline' };
    if (concentration <= 20) return { score: 95, label: 'Low Risk', color: 'default' };
    if (concentration <= 35) return { score: 75, label: 'Moderate', color: 'secondary' };
    if (concentration <= 50) return { score: 60, label: 'Elevated', color: 'outline' };
    return { score: 40, label: 'High Risk', color: 'destructive' };
  };

  const marginQuality = getMarginQuality(ebitdaMargin);
  const customerRisk = getCustomerRisk(listing.customer_concentration);

  const metrics = [
    {
      icon: RevenueIcon,
      label: "Revenue",
      value: formatCurrency(listing.revenue),
    },
    {
      icon: EBITDAIcon,
      label: "EBITDA",
      value: formatCurrency(listing.ebitda),
    },
    {
      icon: MarginIcon,
      label: "Margin",
      value: `${ebitdaMargin.toFixed(1)}%`,
    },
    ...(hasEmployees ? [{
      icon: EmployeesIcon,
      label: "Team",
      value: employeesDisplay(),
    }] : []),
  ];

  return (
    <div className="space-y-8">
      {/* Financial Summary - Clean Minimal Grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <ChartIcon className="w-[15px] h-[15px] text-slate-500" />
          <span className="text-[16px] font-semibold text-slate-900 tracking-tight">Financial Snapshot</span>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-[14px] h-[14px] text-slate-400" />
                  <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                    {metric.label}
                  </span>
                </div>
                <div className="text-2xl font-semibold text-slate-900 tracking-tight">
                  {metric.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
          <span className="document-label">Investment Thesis</span>
          <p className="document-subtitle leading-relaxed">{listing.investment_thesis}</p>
        </div>
      )}

      {/* Growth Drivers */}
      {listing.growth_drivers && listing.growth_drivers.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-slate-100">
          <span className="document-label">Growth Catalysts</span>
          <div className="space-y-2">
            {listing.growth_drivers.map((driver, index) => (
              <div key={index} className="document-subtitle">
                • {driver}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {listing.key_risks && listing.key_risks.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-slate-100">
          <span className="document-label">Risk Factors</span>
          <div className="space-y-2">
            {listing.key_risks.map((risk, index) => (
              <div key={index} className="document-subtitle">
                • {risk}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}