import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useCreateThesisCriteria, useUpdateThesisCriteria } from '@/hooks/portal/use-portal-thesis';
import type { PortalThesisCriteria } from '@/types/portal';

interface ThesisCriteriaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalOrgId: string;
  editingCriteria?: PortalThesisCriteria | null;
  onSaved?: () => void;
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(/[,$]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function ThesisCriteriaForm({
  open,
  onOpenChange,
  portalOrgId,
  editingCriteria,
  onSaved,
}: ThesisCriteriaFormProps) {
  const createMutation = useCreateThesisCriteria();
  const updateMutation = useUpdateThesisCriteria();

  const isEditing = !!editingCriteria;
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Form state
  const [industryLabel, setIndustryLabel] = useState('');
  const [industryKeywords, setIndustryKeywords] = useState('');
  const [ebitdaMin, setEbitdaMin] = useState('');
  const [ebitdaMax, setEbitdaMax] = useState('');
  const [revenueMin, setRevenueMin] = useState('');
  const [revenueMax, setRevenueMax] = useState('');
  const [employeeMin, setEmployeeMin] = useState('');
  const [employeeMax, setEmployeeMax] = useState('');
  const [targetStates, setTargetStates] = useState('');
  const [portfolioCompany, setPortfolioCompany] = useState('');
  const [priority, setPriority] = useState('3');
  const [notes, setNotes] = useState('');

  // Reset form when dialog opens / editing changes
  useEffect(() => {
    if (open) {
      if (editingCriteria) {
        setIndustryLabel(editingCriteria.industry_label);
        setIndustryKeywords(editingCriteria.industry_keywords.join(', '));
        setEbitdaMin(editingCriteria.ebitda_min?.toString() ?? '');
        setEbitdaMax(editingCriteria.ebitda_max?.toString() ?? '');
        setRevenueMin(editingCriteria.revenue_min?.toString() ?? '');
        setRevenueMax(editingCriteria.revenue_max?.toString() ?? '');
        setEmployeeMin(editingCriteria.employee_min?.toString() ?? '');
        setEmployeeMax(editingCriteria.employee_max?.toString() ?? '');
        setTargetStates(editingCriteria.target_states.join(', '));
        setPortfolioCompany(editingCriteria.portfolio_buyer_id ?? '');
        setPriority(editingCriteria.priority.toString());
        setNotes(editingCriteria.notes ?? '');
      } else {
        setIndustryLabel('');
        setIndustryKeywords('');
        setEbitdaMin('');
        setEbitdaMax('');
        setRevenueMin('');
        setRevenueMax('');
        setEmployeeMin('');
        setEmployeeMax('');
        setTargetStates('');
        setPortfolioCompany('');
        setPriority('3');
        setNotes('');
      }
    }
  }, [open, editingCriteria]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!industryLabel.trim()) return;

    const payload = {
      portal_org_id: portalOrgId,
      industry_label: industryLabel.trim(),
      industry_keywords: parseCommaList(industryKeywords),
      ebitda_min: toNumberOrNull(ebitdaMin),
      ebitda_max: toNumberOrNull(ebitdaMax),
      revenue_min: toNumberOrNull(revenueMin),
      revenue_max: toNumberOrNull(revenueMax),
      employee_min: toNumberOrNull(employeeMin),
      employee_max: toNumberOrNull(employeeMax),
      target_states: parseCommaList(targetStates),
      // portfolio_buyer_id requires a UUID — leave null until buyer search is wired up
      portfolio_buyer_id: null,
      priority: Math.min(5, Math.max(1, Number(priority) || 3)),
      notes:
        [portfolioCompany.trim() ? `Portfolio: ${portfolioCompany.trim()}` : '', notes.trim()]
          .filter(Boolean)
          .join('\n') || null,
    };

    const onSuccess = () => {
      onOpenChange(false);
      onSaved?.();
    };

    if (isEditing && editingCriteria) {
      updateMutation.mutate({ id: editingCriteria.id, portalOrgId, ...payload }, { onSuccess });
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Thesis Criterion' : 'Add Thesis Criterion'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Industry Label */}
          <div className="space-y-1.5">
            <Label htmlFor="industry-label">Industry Label *</Label>
            <Input
              id="industry-label"
              value={industryLabel}
              onChange={(e) => setIndustryLabel(e.target.value)}
              placeholder="e.g., Commercial HVAC"
              required
            />
          </div>

          {/* Industry Keywords */}
          <div className="space-y-1.5">
            <Label htmlFor="industry-keywords">Industry Keywords</Label>
            <Input
              id="industry-keywords"
              value={industryKeywords}
              onChange={(e) => setIndustryKeywords(e.target.value)}
              placeholder="HVAC, mechanical, heating, cooling"
            />
            <p className="text-xs text-muted-foreground">Comma-separated keywords for matching</p>
          </div>

          {/* EBITDA Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ebitda-min">EBITDA Min ($)</Label>
              <Input
                id="ebitda-min"
                type="number"
                value={ebitdaMin}
                onChange={(e) => setEbitdaMin(e.target.value)}
                placeholder="750000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ebitda-max">EBITDA Max ($)</Label>
              <Input
                id="ebitda-max"
                type="number"
                value={ebitdaMax}
                onChange={(e) => setEbitdaMax(e.target.value)}
                placeholder="5000000"
              />
            </div>
          </div>

          {/* Revenue Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="revenue-min">Revenue Min ($)</Label>
              <Input
                id="revenue-min"
                type="number"
                value={revenueMin}
                onChange={(e) => setRevenueMin(e.target.value)}
                placeholder="5000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revenue-max">Revenue Max ($)</Label>
              <Input
                id="revenue-max"
                type="number"
                value={revenueMax}
                onChange={(e) => setRevenueMax(e.target.value)}
                placeholder="50000000"
              />
            </div>
          </div>

          {/* Employee Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="employee-min">Employee Min</Label>
              <Input
                id="employee-min"
                type="number"
                value={employeeMin}
                onChange={(e) => setEmployeeMin(e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-max">Employee Max</Label>
              <Input
                id="employee-max"
                type="number"
                value={employeeMax}
                onChange={(e) => setEmployeeMax(e.target.value)}
                placeholder="500"
              />
            </div>
          </div>

          {/* Target States */}
          <div className="space-y-1.5">
            <Label htmlFor="target-states">Target States</Label>
            <Input
              id="target-states"
              value={targetStates}
              onChange={(e) => setTargetStates(e.target.value)}
              placeholder="e.g., OH, PA, NY"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated state abbreviations. Leave blank for national.
            </p>
          </div>

          {/* Portfolio Company */}
          <div className="space-y-1.5">
            <Label htmlFor="portfolio-company">Portfolio Company (notes)</Label>
            <Input
              id="portfolio-company"
              value={portfolioCompany}
              onChange={(e) => setPortfolioCompany(e.target.value)}
              placeholder="e.g., Comfort Systems"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority (1-5)</Label>
            <Input
              id="priority"
              type="number"
              min={1}
              max={5}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context or preferences..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !industryLabel.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Criterion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
