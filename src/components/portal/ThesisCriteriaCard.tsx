import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, DollarSign, Users, Trash2, Edit3 } from 'lucide-react';
import type { PortalThesisCriteria } from '@/types/portal';

interface ThesisCriteriaCardProps {
  criteria: PortalThesisCriteria;
  onEdit: (criteria: PortalThesisCriteria) => void;
  onDelete: (id: string) => void;
}

function formatDollar(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatRange(
  min: number | null,
  max: number | null,
  formatter: (v: number | null) => string | null,
): string | null {
  const fMin = formatter(min);
  const fMax = formatter(max);
  if (fMin && fMax) return `${fMin} - ${fMax}`;
  if (fMin) return `${fMin}+`;
  if (fMax) return `Up to ${fMax}`;
  return null;
}

function formatNumber(value: number | null): string | null {
  if (value == null) return null;
  return value.toLocaleString();
}

export function ThesisCriteriaCard({ criteria, onEdit, onDelete }: ThesisCriteriaCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const ebitdaRange = formatRange(criteria.ebitda_min, criteria.ebitda_max, formatDollar);
  const revenueRange = formatRange(criteria.revenue_min, criteria.revenue_max, formatDollar);
  const employeeRange = formatRange(criteria.employee_min, criteria.employee_max, formatNumber);

  // Only show revenue if it differs from EBITDA
  const showRevenue =
    revenueRange &&
    (criteria.revenue_min !== criteria.ebitda_min || criteria.revenue_max !== criteria.ebitda_max);

  const hasGeography = criteria.target_states.length > 0;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmingDelete) {
      onDelete(criteria.id);
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(criteria);
  };

  return (
    <Card
      className={`relative transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer ${
        !criteria.is_active ? 'opacity-50' : ''
      }`}
      onClick={() => onEdit(criteria)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(criteria);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${criteria.industry_label} thesis criteria`}
    >
      <CardContent className="p-5 space-y-3">
        {/* Header: title + priority */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold leading-tight">{criteria.industry_label}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {!criteria.is_active && (
              <Badge variant="outline" className="text-xs">
                Inactive
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              P{criteria.priority}
            </Badge>
          </div>
        </div>

        {/* Industry keywords */}
        {criteria.industry_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {criteria.industry_keywords.map((kw) => (
              <Badge key={kw} variant="outline" className="text-xs font-normal">
                {kw}
              </Badge>
            ))}
          </div>
        )}

        {/* Financial & employee metrics */}
        <div className="space-y-1.5 text-sm text-muted-foreground">
          {ebitdaRange && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              <span>EBITDA: {ebitdaRange}</span>
            </div>
          )}
          {showRevenue && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              <span>Revenue: {revenueRange}</span>
            </div>
          )}
          {employeeRange && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>{employeeRange} employees</span>
            </div>
          )}
        </div>

        {/* Geography */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {hasGeography ? (
            <div className="flex flex-wrap gap-1">
              {criteria.target_states.map((st) => (
                <Badge key={st} variant="outline" className="text-xs font-normal">
                  {st}
                </Badge>
              ))}
            </div>
          ) : (
            <span>National</span>
          )}
        </div>

        {/* Portfolio company */}
        {criteria.portfolio_buyer_id && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>&rarr; Portfolio linked</span>
          </div>
        )}

        {/* Notes */}
        {criteria.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{criteria.notes}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleEditClick}>
            <Edit3 className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs ${
              confirmingDelete ? 'text-destructive hover:text-destructive' : ''
            }`}
            onClick={handleDeleteClick}
            onBlur={() => setConfirmingDelete(false)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {confirmingDelete ? 'Confirm?' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
