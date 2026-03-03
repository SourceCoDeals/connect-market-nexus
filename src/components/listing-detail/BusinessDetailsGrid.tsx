import { MapPin, Briefcase, Building2, Users, TrendingUp, DollarSign, Layers } from 'lucide-react';

interface BusinessDetailsGridProps {
  geographic_states?: string[] | null;
  services?: string[] | null;
  number_of_locations?: number | null;
  customer_types?: string | null;
  revenue_model?: string | null;
  business_model?: string | null;
  growth_trajectory?: string | null;
}

interface DetailItem {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

export function BusinessDetailsGrid({
  geographic_states,
  services,
  number_of_locations,
  customer_types,
  revenue_model,
  business_model,
  growth_trajectory,
}: BusinessDetailsGridProps) {
  const details: DetailItem[] = [];

  // Geography
  if (geographic_states && geographic_states.length > 0) {
    details.push({
      icon: <MapPin className="h-4 w-4 text-slate-400" />,
      label: 'Geography',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {geographic_states.map((state) => (
            <span
              key={state}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700"
            >
              {state}
            </span>
          ))}
        </div>
      ),
    });
  }

  // Services
  if (services && services.length > 0) {
    details.push({
      icon: <Briefcase className="h-4 w-4 text-slate-400" />,
      label: 'Services',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {services.map((service) => (
            <span
              key={service}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-xs font-medium text-blue-700"
            >
              {service}
            </span>
          ))}
        </div>
      ),
    });
  }

  // Number of Locations
  if (number_of_locations && number_of_locations > 0) {
    details.push({
      icon: <Building2 className="h-4 w-4 text-slate-400" />,
      label: 'Locations',
      value: (
        <span className="text-sm text-slate-900 font-medium">
          {number_of_locations} {number_of_locations === 1 ? 'location' : 'locations'}
        </span>
      ),
    });
  }

  // Customer Types
  if (customer_types) {
    details.push({
      icon: <Users className="h-4 w-4 text-slate-400" />,
      label: 'Customer Types',
      value: <span className="text-sm text-slate-700">{customer_types}</span>,
    });
  }

  // Revenue Model
  if (revenue_model) {
    details.push({
      icon: <DollarSign className="h-4 w-4 text-slate-400" />,
      label: 'Revenue Model',
      value: <span className="text-sm text-slate-700">{revenue_model}</span>,
    });
  }

  // Business Model
  if (business_model) {
    details.push({
      icon: <Layers className="h-4 w-4 text-slate-400" />,
      label: 'Business Model',
      value: <span className="text-sm text-slate-700">{business_model}</span>,
    });
  }

  // Growth Trajectory
  if (growth_trajectory) {
    details.push({
      icon: <TrendingUp className="h-4 w-4 text-slate-400" />,
      label: 'Growth Trajectory',
      value: <span className="text-sm text-slate-700 capitalize">{growth_trajectory}</span>,
    });
  }

  if (details.length === 0) return null;

  return (
    <div className="py-8 border-t border-slate-100">
      <h2 className="text-sm font-medium leading-5 mb-5">Business Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {details.map((detail) => (
          <div key={detail.label} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">{detail.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
                {detail.label}
              </p>
              {detail.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
