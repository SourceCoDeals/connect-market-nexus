import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2, Sparkles, FileText } from 'lucide-react';
import {
  useExtractPortalThesis,
  useSaveExtractedTheses,
  type ExtractedThesisCandidate,
} from '@/hooks/portal/use-extract-portal-thesis';
import { validateThesisCandidate } from '@/lib/portal/thesis-validation';
import type { CreateThesisCriteriaInput, PortalIntelligenceDoc } from '@/types/portal';

interface ExtractThesisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: PortalIntelligenceDoc | null;
  portalOrgId: string;
}

interface EditableCandidate extends ExtractedThesisCandidate {
  /** Local UI id so React can key the list reliably even after edits. */
  _key: string;
  _selected: boolean;
}

function formatDollar(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toLocaleString()}`;
}

function formatRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${formatDollar(min)} – ${formatDollar(max)}`;
  if (min != null) return `${formatDollar(min)}+`;
  return `Up to ${formatDollar(max)}`;
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toIntOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(/[,$]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 85) return 'bg-green-100 text-green-800';
  if (confidence >= 65) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Review dialog for AI-extracted thesis rows from a portal intelligence doc.
 *
 * Flow:
 *   1. Dialog opens → immediately fires the extract-portal-thesis edge function.
 *   2. AI returns a list of candidate thesis rows.
 *   3. Admin checks/unchecks, edits fields inline, then saves.
 *   4. Selected + edited rows are inserted into portal_thesis_criteria.
 */
export function ExtractThesisDialog({
  open,
  onOpenChange,
  doc,
  portalOrgId,
}: ExtractThesisDialogProps) {
  const extractMutation = useExtractPortalThesis();
  const saveMutation = useSaveExtractedTheses();

  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [extractionNotes, setExtractionNotes] = useState<string | null>(null);
  const [overallConfidence, setOverallConfidence] = useState<number | null>(null);
  const [hasRun, setHasRun] = useState(false);

  /**
   * Per-instance cache of already-extracted doc IDs. Extraction is expensive
   * (~$0.02 / call, 10–60s latency) so if the reviewer closes and reopens the
   * dialog for the same doc we skip the re-run and reuse the candidates that
   * are still in component state. Cleared when the doc id actually changes.
   */
  const lastExtractedDocId = useRef<string | null>(null);

  // Reset + kick off extraction when the dialog opens for a new doc.
  useEffect(() => {
    if (!open || !doc) return;

    // Reopened for the same doc we already extracted — keep the existing
    // candidates (including any edits the reviewer made) instead of burning
    // another Gemini call. Reviewers can force a re-run by closing the dialog
    // and re-opening after switching to another doc and back.
    if (lastExtractedDocId.current === doc.id && hasRun) {
      return;
    }

    setCandidates([]);
    setExtractionNotes(null);
    setOverallConfidence(null);
    setHasRun(false);

    let cancelled = false;
    extractMutation
      .mutateAsync(doc.id)
      .then((res) => {
        if (cancelled) return;
        setCandidates(
          res.theses.map((t, i) => ({
            ...t,
            _key: `thesis-${i}-${Date.now()}`,
            _selected: t.confidence >= 60,
          })),
        );
        setExtractionNotes(res.extraction_notes);
        setOverallConfidence(res.overall_confidence);
        setHasRun(true);
        lastExtractedDocId.current = doc.id;
      })
      .catch(() => {
        if (cancelled) return;
        setHasRun(true);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run on doc/open change — extractMutation identity churns per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.id]);

  const selectedCount = useMemo(() => candidates.filter((c) => c._selected).length, [candidates]);

  // Per-row validation errors (only shown on selected rows).
  const validationErrors = useMemo(() => {
    const errs = new Map<string, string>();
    for (const c of candidates) {
      const err = validateThesisCandidate(c);
      if (err) errs.set(c._key, err);
    }
    return errs;
  }, [candidates]);

  const selectedInvalidCount = useMemo(
    () => candidates.filter((c) => c._selected && validationErrors.has(c._key)).length,
    [candidates, validationErrors],
  );

  const updateCandidate = (key: string, patch: Partial<EditableCandidate>) => {
    setCandidates((prev) => prev.map((c) => (c._key === key ? { ...c, ...patch } : c)));
  };

  const handleSave = async () => {
    const selected = candidates.filter((c) => c._selected);
    if (selected.length === 0) return;
    // Belt-and-braces: the save button is disabled when invalid rows exist,
    // but double-check here too in case state updates race.
    if (selected.some((c) => validationErrors.has(c._key))) return;

    const payload: CreateThesisCriteriaInput[] = selected.map((c) => ({
      portal_org_id: portalOrgId,
      industry_label: c.industry_label.trim(),
      industry_keywords: c.industry_keywords,
      ebitda_min: c.ebitda_min,
      ebitda_max: c.ebitda_max,
      revenue_min: c.revenue_min,
      revenue_max: c.revenue_max,
      employee_min: c.employee_min,
      employee_max: c.employee_max,
      target_states: c.target_states,
      priority: c.priority,
      notes: c.notes,
    }));

    try {
      await saveMutation.mutateAsync({ portalOrgId, theses: payload });
      onOpenChange(false);
    } catch {
      // Toast already shown by the mutation.
    }
  };

  const isExtracting = extractMutation.isPending;
  const extractError = extractMutation.error;
  const isSaving = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Extract Thesis from Document
          </DialogTitle>
          <DialogDescription>
            {doc ? (
              <>Reviewing AI-extracted thesis rows from <strong>{doc.title}</strong>.</>
            ) : (
              'Loading document...'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {isExtracting && (
            <div
              className="flex flex-col items-center justify-center py-16 text-center"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" aria-hidden="true" />
              <p className="text-sm font-medium">Reading document and extracting thesis...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This can take 10-60 seconds for large PDFs.
              </p>
            </div>
          )}

          {extractError && !isExtracting && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">Extraction failed</p>
                <p className="text-xs mt-1">{extractError.message}</p>
              </div>
            </div>
          )}

          {!isExtracting && hasRun && !extractError && candidates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium">No thesis information found</p>
              <p className="text-xs mt-1 max-w-sm">
                The document may not contain a clear investment thesis, or it may be too short to
                extract structured criteria from.
              </p>
              {extractionNotes && (
                <p className="text-xs mt-3 italic max-w-md">&ldquo;{extractionNotes}&rdquo;</p>
              )}
            </div>
          )}

          {!isExtracting && candidates.length > 0 && (
            <div className="space-y-3 h-full flex flex-col">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Found <strong>{candidates.length}</strong> thesis{' '}
                  {candidates.length === 1 ? 'row' : 'rows'}
                  {overallConfidence != null && <> · overall confidence {overallConfidence}%</>}
                </span>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() =>
                    setCandidates((prev) => {
                      const allSelected = prev.every((x) => x._selected);
                      return prev.map((c) => ({ ...c, _selected: !allSelected }));
                    })
                  }
                >
                  {candidates.every((c) => c._selected) ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {extractionNotes && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <strong>Reviewer note:</strong> {extractionNotes}
                </div>
              )}

              <ScrollArea className="flex-1 pr-3">
                <div className="space-y-3">
                  {candidates.map((c) => {
                    const rowError = validationErrors.get(c._key);
                    const showError = c._selected && !!rowError;
                    return (
                    <div
                      key={c._key}
                      className={`rounded-lg border p-3 space-y-3 transition-colors ${
                        showError
                          ? 'border-destructive/50 bg-destructive/[0.03]'
                          : c._selected
                            ? 'border-primary/40 bg-primary/[0.02]'
                            : 'border-border'
                      }`}
                    >
                      {/* Row header: checkbox + label + confidence */}
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={c._selected}
                          onCheckedChange={(v) =>
                            updateCandidate(c._key, { _selected: v === true })
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Input
                            value={c.industry_label}
                            onChange={(e) =>
                              updateCandidate(c._key, { industry_label: e.target.value })
                            }
                            placeholder="Industry label"
                            className="font-semibold h-8"
                          />
                        </div>
                        <Badge className={`text-[10px] shrink-0 ${confidenceColor(c.confidence)}`}>
                          {c.confidence}% conf
                        </Badge>
                      </div>

                      {/* Keywords (comma-separated, editable) */}
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Industry keywords
                        </Label>
                        <Input
                          value={c.industry_keywords.join(', ')}
                          onChange={(e) =>
                            updateCandidate(c._key, {
                              industry_keywords: parseCommaList(e.target.value),
                            })
                          }
                          placeholder="hvac, plumbing, electrical"
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Financial ranges */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            EBITDA range ($)
                          </Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              placeholder="min"
                              value={c.ebitda_min ?? ''}
                              onChange={(e) =>
                                updateCandidate(c._key, { ebitda_min: toIntOrNull(e.target.value) })
                              }
                              className="h-8 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input
                              type="number"
                              placeholder="max"
                              value={c.ebitda_max ?? ''}
                              onChange={(e) =>
                                updateCandidate(c._key, { ebitda_max: toIntOrNull(e.target.value) })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formatRange(c.ebitda_min, c.ebitda_max)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Revenue range ($)
                          </Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              placeholder="min"
                              value={c.revenue_min ?? ''}
                              onChange={(e) =>
                                updateCandidate(c._key, {
                                  revenue_min: toIntOrNull(e.target.value),
                                })
                              }
                              className="h-8 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input
                              type="number"
                              placeholder="max"
                              value={c.revenue_max ?? ''}
                              onChange={(e) =>
                                updateCandidate(c._key, {
                                  revenue_max: toIntOrNull(e.target.value),
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formatRange(c.revenue_min, c.revenue_max)}
                          </p>
                        </div>
                      </div>

                      {/* States + priority */}
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Target states (comma-separated, blank = national)
                          </Label>
                          <Input
                            value={c.target_states.join(', ')}
                            onChange={(e) =>
                              updateCandidate(c._key, {
                                target_states: parseCommaList(e.target.value).map((s) =>
                                  s.toUpperCase(),
                                ),
                              })
                            }
                            placeholder="OH, PA, NY"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1 w-20">
                          <Label className="text-[11px] text-muted-foreground">Priority</Label>
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={c.priority}
                            onChange={(e) =>
                              updateCandidate(c._key, {
                                priority: Math.min(5, Math.max(1, Number(e.target.value) || 3)),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      {c.source_excerpt && (
                        <div className="rounded-md bg-muted/40 px-2 py-1.5 text-[11px] italic text-muted-foreground border-l-2 border-muted-foreground/30">
                          &ldquo;{c.source_excerpt}&rdquo;
                        </div>
                      )}

                      {/* Notes */}
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Notes</Label>
                        <Textarea
                          value={c.notes ?? ''}
                          onChange={(e) =>
                            updateCandidate(c._key, { notes: e.target.value || null })
                          }
                          rows={2}
                          className="text-xs resize-none"
                          placeholder="Context, exclusions, deal preferences..."
                        />
                      </div>

                      {/* Validation error (only shown on selected rows) */}
                      {showError && (
                        <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{rowError}</span>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 gap-2 sm:gap-2 flex-col sm:flex-row sm:items-center sm:justify-end">
          {selectedInvalidCount > 0 && (
            <p className="text-[11px] text-destructive flex items-center gap-1 sm:mr-auto">
              <AlertCircle className="h-3 w-3" />
              {selectedInvalidCount} selected{' '}
              {selectedInvalidCount === 1 ? 'row has' : 'rows have'} validation errors
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              selectedCount === 0 || selectedInvalidCount > 0 || isSaving || isExtracting
            }
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add {selectedCount} to Thesis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
