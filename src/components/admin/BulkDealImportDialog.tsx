/**
 * BulkDealImportDialog.tsx
 *
 * Workflow orchestrator for bulk CSV import of connection requests.
 * Delegates parsing to CsvParser, preview to ImportPreview, and
 * submission/duplicate handling to useImportSubmit.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Upload, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { readSpreadsheetAsText, SPREADSHEET_ACCEPT } from '@/lib/parseSpreadsheet';
import { toast } from 'sonner';
import { useAdminListings } from '@/hooks/admin/use-admin-listings';
import { DuplicateResolutionDialog } from './DuplicateResolutionDialog';
import { BulkDuplicateDialog } from './BulkDuplicateDialog';
import { useUndoBulkImport } from '@/hooks/admin/use-undo-bulk-import';
import type { ImportResult } from '@/hooks/admin/use-bulk-deal-import';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseCsvText, MAX_FILE_SIZE_MB, type ParsedDeal } from './bulk-import/CsvParser';
import { ImportPreview } from './bulk-import/ImportPreview';
import { handleDuplicateAction, logAudit, type DuplicateAction } from './bulk-import/useImportSubmit';

interface BulkDealImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    listingId: string;
    deals: ParsedDeal[];
    fileName: string;
    batchId: string;
  }) => Promise<ImportResult | void>;
  isLoading: boolean;
}

export function BulkDealImportDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: BulkDealImportDialogProps) {
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [csvText, setCsvText] = useState('');
  const [parsedDeals, setParsedDeals] = useState<ParsedDeal[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showBulkDuplicateDialog, setShowBulkDuplicateDialog] = useState(false);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);
  const [skipAllDuplicates, setSkipAllDuplicates] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  const { useListings } = useAdminListings();
  const { data: listings } = useListings(undefined, isOpen);
  const { undoImport, isUndoing } = useUndoBulkImport();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      toast.error(`File too large (${fileSizeMB.toFixed(1)}MB)`, {
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB`,
      });
      event.target.value = '';
      return;
    }

    setFileName(file.name);
    try {
      const text = await readSpreadsheetAsText(file);
      setCsvText(text);
    } catch (err: unknown) {
      toast.error('Failed to read file', {
        description: err instanceof Error ? err.message : String(err),
      });
      event.target.value = '';
    }
  };

  const parseCSV = () => {
    const { deals, errors } = parseCsvText(csvText);
    setParsedDeals(deals);
    setParseErrors(errors);
  };

  const handleShowConfirm = () => {
    const validDeals = parsedDeals.filter((d) => d.isValid);
    if (validDeals.length === 0) {
      setParseErrors(['No valid deals to import']);
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmImport = async () => {
    setShowConfirmDialog(false);

    const validDeals = parsedDeals.filter((d) => d.isValid);
    const startTime = Date.now();
    const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentBatchId(batchId);

    const result = await onConfirm({
      listingId: selectedListingId,
      deals: validDeals,
      fileName,
      batchId,
    });

    if (result) {
      setImportResult(result);

      await logAudit({
        fileName,
        importResult: result,
        selectedListingId,
        batchId,
        startTime,
      });

      if (result.details.duplicates.length > 0) {
        setShowBulkDuplicateDialog(true);
      }
    }
  };

  const handleClose = () => {
    setCsvText('');
    setParsedDeals([]);
    setParseErrors([]);
    setSelectedListingId('');
    setFileName('');
    setImportResult(null);
    setShowDuplicateDialog(false);
    setShowBulkDuplicateDialog(false);
    setCurrentDuplicateIndex(0);
    setSkipAllDuplicates(false);
    setShowConfirmDialog(false);
    setCurrentBatchId(null);
    onClose();
  };

  const handleUndoImport = async () => {
    if (!currentBatchId) return;
    try {
      await undoImport(currentBatchId);
      handleClose();
    } catch (error) {
      console.error('Undo failed:', error);
    }
  };

  const onDuplicateAction = async (action: DuplicateAction) => {
    if (!importResult) return;

    const moveToNext = () => {
      if (currentDuplicateIndex < importResult.details.duplicates.length - 1) {
        setCurrentDuplicateIndex(currentDuplicateIndex + 1);
      } else {
        setShowDuplicateDialog(false);
        toast.success('All duplicates processed');
      }
    };

    await handleDuplicateAction({
      action,
      importResult,
      currentDuplicateIndex,
      skipAllDuplicates,
      selectedListingId,
      fileName,
      onMoveNext: moveToNext,
    });
  };

  const validCount = parsedDeals.filter((d) => d.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Bulk Import Connection Requests</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Step 1: Select Listing */}
          <div className="space-y-2 flex-shrink-0">
            <Label htmlFor="listing">Step 1: Select Listing *</Label>
            <Select value={selectedListingId} onValueChange={setSelectedListingId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a listing..." />
              </SelectTrigger>
              <SelectContent>
                {listings?.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Upload File */}
          <div className="space-y-2 flex-shrink-0">
            <Label htmlFor="csv-file">Step 2: Upload File (CSV, XLS, XLSX) *</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Maximum {MAX_FILE_SIZE_MB}MB file size • Up to 500 rows per import • Dates are
              imported in UTC timezone
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept={SPREADSHEET_ACCEPT}
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button onClick={parseCSV} disabled={!csvText || isLoading} variant="secondary">
                <Upload className="w-4 h-4 mr-2" />
                Parse File
              </Button>
            </div>
            {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
          </div>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {parseErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Step 3: Preview - Only show if import hasn't completed */}
          {parsedDeals.length > 0 && !importResult && (
            <ImportPreview parsedDeals={parsedDeals} />
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold">Import Complete</h3>
                <p className="text-sm text-muted-foreground">
                  {importResult.imported} connection request{importResult.imported !== 1 ? 's' : ''}{' '}
                  successfully imported
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border bg-card p-4 text-center space-y-1">
                  <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {importResult.imported}
                  </div>
                  <div className="text-xs text-muted-foreground">Imported</div>
                </div>

                {importResult.duplicates > 0 && (
                  <div className="rounded-lg border bg-card p-4 text-center space-y-1">
                    <div className="text-2xl font-semibold text-orange-600 dark:text-orange-400">
                      {importResult.duplicates}
                    </div>
                    <div className="text-xs text-muted-foreground">Duplicates</div>
                  </div>
                )}

                {importResult.errors > 0 && (
                  <div className="rounded-lg border bg-card p-4 text-center space-y-1">
                    <div className="text-2xl font-semibold text-destructive">
                      {importResult.errors}
                    </div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                )}
              </div>

              {/* Linked Users Section */}
              {importResult.details.imported.some((i) => i.linkedToUser) && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span>
                      {importResult.details.imported.filter((i) => i.linkedToUser).length} Linked to
                      Existing Users
                    </span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {importResult.details.imported
                      .filter((i) => i.linkedToUser)
                      .map((imp) => (
                        <div
                          key={imp.userEmail || imp.userName}
                          className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-background/50"
                        >
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{imp.userName || imp.userEmail}</div>
                            {imp.userCompany && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">{imp.userCompany}</span>
                              </>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            NDA/Fee Synced
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {importResult.details.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                  <div className="text-sm font-medium text-destructive">Error Details</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-xs text-muted-foreground">
                    {importResult.details.errors.map((err) => (
                      <div key={err.deal.csvRowNumber} className="py-1">
                        <span className="font-medium">Row {err.deal.csvRowNumber}:</span>{' '}
                        {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            {importResult ? (
              <>
                {currentBatchId && importResult.imported > 0 && (
                  <Button variant="destructive" onClick={handleUndoImport} disabled={isUndoing}>
                    {isUndoing ? 'Undoing...' : 'Undo This Import'}
                  </Button>
                )}
                <Button onClick={handleClose} className="w-full sm:w-auto">
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleShowConfirm}
                  disabled={!selectedListingId || validCount === 0 || isLoading}
                >
                  Review & Import {validCount} Rows
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Bulk Duplicate Warning Dialog */}
      {importResult && importResult.details.duplicates.length > 0 && (
        <BulkDuplicateDialog
          isOpen={showBulkDuplicateDialog}
          onClose={() => setShowBulkDuplicateDialog(false)}
          duplicates={importResult.details.duplicates}
          onSkipAll={() => {
            setSkipAllDuplicates(true);
            setShowBulkDuplicateDialog(false);
            toast.info(`Skipped all ${importResult.details.duplicates.length} duplicates`);
          }}
          onReviewIndividually={() => {
            setShowBulkDuplicateDialog(false);
            setShowDuplicateDialog(true);
            setCurrentDuplicateIndex(0);
          }}
        />
      )}

      {/* Individual Duplicate Resolution Dialog */}
      {importResult && importResult.details.duplicates.length > 0 && (
        <DuplicateResolutionDialog
          isOpen={showDuplicateDialog}
          onClose={() => setShowDuplicateDialog(false)}
          duplicate={importResult.details.duplicates[currentDuplicateIndex]}
          onSkip={() => onDuplicateAction('skip')}
          onMerge={() => onDuplicateAction('merge')}
          onReplace={() => onDuplicateAction('replace')}
          onCreateAnyway={() => onDuplicateAction('create')}
        />
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirm Import
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You are about to import{' '}
                <strong>{parsedDeals.filter((d) => d.isValid).length} connection requests</strong>{' '}
                to the listing:
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-medium mb-1">Selected Listing</div>
              <div className="text-sm text-muted-foreground">
                {listings?.find((l) => l.id === selectedListingId)?.title || 'Unknown Listing'}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-medium mb-1">Import Summary</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  • {parsedDeals.filter((d) => d.isValid).length} valid rows will be imported
                </div>
                <div>• Each will create a new connection request</div>
                <div>• Duplicate checking will be performed</div>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Make sure you've selected the correct listing. This
                action will create connection requests that you'll need to manage.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={isLoading}>
              {isLoading ? 'Importing...' : 'Confirm & Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
