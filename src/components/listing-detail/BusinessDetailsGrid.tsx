import { MapPin } from 'lucide-react';

interface BusinessDetailsGridProps {
  geographic_states?: string[] | null;
}

export function BusinessDetailsGrid({
  geographic_states,
}: BusinessDetailsGridProps) {
  if (!geographic_states || geographic_states.length === 0) return null;

  return (
    <div className="py-8 border-t border-slate-100">
      <div className="flex items-start gap-3">
        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
            Geography
          </p>
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
        </div>
      </div>
    </div>
  );
}
