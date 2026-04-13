import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { usePortalThesisCriteria, useDeleteThesisCriteria } from '@/hooks/portal/use-portal-thesis';
import { ThesisCriteriaCard } from './ThesisCriteriaCard';
import { ThesisCriteriaForm } from './ThesisCriteriaForm';
import type { PortalThesisCriteria } from '@/types/portal';

interface PortalThesisTabProps {
  portalOrgId: string;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toLocaleString()}`;
}

export function PortalThesisTab({ portalOrgId }: PortalThesisTabProps) {
  const { data: criteria, isLoading } = usePortalThesisCriteria(portalOrgId);
  const deleteMutation = useDeleteThesisCriteria();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<PortalThesisCriteria | null>(null);

  // Compute summary from active criteria
  const summary = useMemo(() => {
    if (!criteria?.length) return null;
    const active = criteria.filter((c) => c.is_active);
    if (!active.length) return null;

    const activeCount = active.length;

    // Unique target states across all active criteria
    const allStates = new Set<string>();
    active.forEach((c) => c.target_states.forEach((s) => allStates.add(s)));
    const stateCount = allStates.size;

    // Global EBITDA range (min of mins, max of maxes)
    const ebitdaMins = active.map((c) => c.ebitda_min).filter((v): v is number => v != null);
    const ebitdaMaxes = active.map((c) => c.ebitda_max).filter((v): v is number => v != null);

    const globalMin = ebitdaMins.length ? Math.min(...ebitdaMins) : null;
    const globalMax = ebitdaMaxes.length ? Math.max(...ebitdaMaxes) : null;

    let ebitdaLabel: string | null = null;
    if (globalMin != null && globalMax != null) {
      ebitdaLabel = `${formatCompact(globalMin)}-${formatCompact(globalMax)} EBITDA range`;
    } else if (globalMin != null) {
      ebitdaLabel = `${formatCompact(globalMin)}+ EBITDA`;
    } else if (globalMax != null) {
      ebitdaLabel = `Up to ${formatCompact(globalMax)} EBITDA`;
    }

    return { activeCount, stateCount, ebitdaLabel };
  }, [criteria]);

  const handleEdit = (c: PortalThesisCriteria) => {
    setEditingCriteria(c);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id, portalOrgId });
  };

  const handleAddNew = () => {
    setEditingCriteria(null);
    setFormOpen(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-64 bg-muted animate-pulse rounded" />
          <div className="h-9 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = !criteria?.length;

  return (
    <div className="space-y-4">
      {/* Header: summary + add button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {summary ? (
          <p className="text-sm text-muted-foreground">
            {summary.activeCount} active {summary.activeCount === 1 ? 'industry' : 'industries'}
            {summary.stateCount > 0 && (
              <>
                , {summary.stateCount} target {summary.stateCount === 1 ? 'state' : 'states'}
              </>
            )}
            {summary.ebitdaLabel && <>, {summary.ebitdaLabel}</>}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No active criteria</p>
        )}
        <Button size="sm" onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-1" />
          Add Industry
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">No investment criteria defined yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Add thesis criteria to define target industries, deal sizes, and geographies.
          </p>
          <Button variant="outline" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add First Criterion
          </Button>
        </div>
      )}

      {/* Criteria grid */}
      {!isEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {criteria!.map((c) => (
            <ThesisCriteriaCard
              key={c.id}
              criteria={c}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <ThesisCriteriaForm
        open={formOpen}
        onOpenChange={setFormOpen}
        portalOrgId={portalOrgId}
        editingCriteria={editingCriteria}
      />
    </div>
  );
}
