import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Upload, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';
import { parse } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

interface BulkDealImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<ImportResult | void>;
  isLoading: boolean;
}

interface ParsedDeal {
  csvRowNumber: number;
  date: Date | null;
  name: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  role: string;
  message: string;
  errors: string[];
  isValid: boolean;
}

export function BulkDealImportDialog({ isOpen, onClose, onConfirm, isLoading }: BulkDealImportDialogProps) {
  const MAX_FILE_SIZE_MB = 10;
  const MAX_ROWS = 500;
  
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File size validation
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      toast.error(`File too large (${fileSizeMB.toFixed(1)}MB)`, {
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB`,
      });
      event.target.value = '';
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const extractCompanyFromEmail = (email: string, existingCompany?: string): string => {
    if (existingCompany && existingCompany.trim()) return existingCompany;
    
    const domain = email.split('@')[1];
    if (!domain) return '';
    
    const parts = domain.split('.');
    if (parts.length > 1) parts.pop(); // Remove TLD
    
    const company = parts.join('.');
    return company.charAt(0).toUpperCase() + company.slice(1);
  };

  const cleanCompanyName = (company: string): string => {
    if (!company) return '';
    return company
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/^["']+|["']+$/g, '')
      .replace(/^www\./i, '')
      .trim();
  };

  const standardizePhone = (phone: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const mapRole = (role: string): string => {
    const normalized = role?.toLowerCase().trim() || '';
    const tokens = new Set((normalized.match(/[a-z]+/g) || []));

    if (normalized === 'privateequity' || normalized.includes('private equity') || tokens.has('pe')) {
      return 'privateEquity';
    }
    if (normalized === 'familyoffice' || normalized.includes('family office') || tokens.has('fo')) {
      return 'familyOffice';
    }
    if (normalized === 'independentsponsor' || normalized.includes('independent sponsor')) {
      return 'independentSponsor';
    }
    if (normalized === 'searchfund' || normalized.includes('search fund') || tokens.has('sf')) {
      return 'searchFund';
    }
    if (normalized === 'corporate' || normalized.includes('corporate') || tokens.has('corp')) {
      return 'corporate';
    }
    if (normalized === 'individual' || normalized.includes('individual') || normalized.includes('investor')) {
      return 'individual';
    }
    return 'other';
  };
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      return parse(dateStr, 'M/d/yyyy h:mm:ss a', new Date());
    } catch {
      return null;
    }
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const parseCSV = () => {
    if (!csvText.trim()) {
      setParseErrors(['Please upload a CSV file first']);
      return;
    }

    const errors: string[] = [];
    const deals: ParsedDeal[] = [];

    try {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          // Row count validation
          if (results.data.length > MAX_ROWS) {
            setParseErrors([`Too many rows (${results.data.length}). Maximum is ${MAX_ROWS} rows per import.`]);
            return;
          }

          results.data.forEach((row: any, index) => {
            const rowNumber = index + 2;
            const dealErrors: string[] = [];
            
            const email = row['Email address']?.trim() || '';
            const name = row['Name']?.trim() || '';
            const message = row['Message']?.trim() || '';
            const rawCompany = cleanCompanyName(row['Company name']);

            // Validation
            if (!email || !validateEmail(email)) {
              dealErrors.push('Invalid or missing email');
            }
            if (!name || name.length < 2) {
              dealErrors.push('Name is required (min 2 chars)');
            }
            if (!message || message.length < 20) {
              dealErrors.push('Message must be at least 20 characters');
            }

            // Extract company from email if not provided
            const companyName = extractCompanyFromEmail(email, rawCompany);

            deals.push({
              csvRowNumber: rowNumber,
              date: parseDate(row['Date']),
              name,
              email,
              companyName,
              phoneNumber: standardizePhone(row['Phone number']),
              role: mapRole(row['Role']),
              message,
              errors: dealErrors,
              isValid: dealErrors.length === 0,
            });
          });

          setParsedDeals(deals);
          setParseErrors(errors);
        },
        error: (error) => {
          setParseErrors([`CSV parsing error: ${error.message}`]);
        },
      });
    } catch (error: any) {
      setParseErrors([`Error: ${error.message}`]);
    }
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
    
    // Generate unique batch ID for this import session
    const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentBatchId(batchId);
    
    const result = await onConfirm({
      listingId: selectedListingId,
      deals: validDeals,
      fileName,
      batchId, // Pass batch ID to track this import
    });

    if (result) {
      setImportResult(result);
      
      // Log to audit_logs
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('audit_logs').insert({
            table_name: 'connection_requests',
            operation: 'BULK_IMPORT',
            admin_id: user.id,
            metadata: {
              csv_filename: fileName,
              rows_imported: result.imported,
              rows_duplicated: result.duplicates,
              rows_errored: result.errors,
              listing_id: selectedListingId,
              import_duration_ms: Date.now() - startTime,
              batch_id: batchId, // Store batch ID for undo capability
            },
          });
        }
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
      
      // If there are duplicates, show bulk dialog first
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

  const handleDuplicateAction = async (action: 'skip' | 'merge' | 'replace' | 'create') => {
    if (!importResult) return;
    
    const currentDuplicate = importResult.details.duplicates[currentDuplicateIndex];
    if (!currentDuplicate) return;

    const { deal, duplicateInfo } = currentDuplicate;
    
    // Helper to move to next duplicate
    const moveToNextDuplicate = () => {
      if (currentDuplicateIndex < importResult.details.duplicates.length - 1) {
        setCurrentDuplicateIndex(currentDuplicateIndex + 1);
      } else {
        setShowDuplicateDialog(false);
        toast.success('All duplicates processed');
      }
    };
    
    // If skip all duplicates mode is on, just skip
    if (skipAllDuplicates && action === 'skip') {
      moveToNextDuplicate();
      return;
    }

    try {
      switch (action) {
        case 'skip':
          // Do nothing, just skip
          toast.info('Skipped duplicate entry');
          break;

        case 'merge': {
          // Append new message to existing request
          const existingMessage = duplicateInfo.existingMessage || '';
          const newMessageWithDate = `\n\nNew message (${deal.date?.toLocaleDateString() || new Date().toLocaleDateString()}):\n${deal.message}`;
          const mergedMessage = existingMessage + newMessageWithDate;

          const { error: mergeError } = await supabase
            .from('connection_requests')
            .update({
              user_message: mergedMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', duplicateInfo.existingRequestId);

          if (mergeError) throw mergeError;
          toast.success('Messages merged successfully');
          break;
        }

        case 'replace': {
          // Replace existing request data with new CSV data
          const { error: replaceError } = await supabase
            .from('connection_requests')
            .update({
              user_message: deal.message,
              lead_role: deal.role,
              lead_phone: deal.phoneNumber || null,
              lead_company: deal.companyName || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', duplicateInfo.existingRequestId);

          if (replaceError) throw replaceError;
          toast.success('Request replaced successfully');
          break;
        }

        case 'create': {
          // Create new request anyway (force duplicate)
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          // Check if user exists in profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, company, nda_signed, fee_agreement_signed')
            .eq('email', deal.email)
            .maybeSingle();

          const { error: createError } = await supabase
            .from('connection_requests')
            .insert({
              listing_id: selectedListingId,
              user_id: profile?.id || null,
              lead_email: profile ? null : deal.email,
              lead_name: profile ? null : deal.name,
              lead_company: profile ? null : deal.companyName,
              lead_phone: profile ? null : deal.phoneNumber,
              lead_role: deal.role,
              user_message: deal.message,
              source: 'website',
              source_metadata: {
                import_method: 'csv_bulk_upload',
                csv_filename: fileName,
                csv_row_number: deal.csvRowNumber,
                import_date: new Date().toISOString(),
                imported_by_admin_id: user.id,
                forced_duplicate: true,
              },
              created_at: deal.date?.toISOString() || new Date().toISOString(),
            });

          if (createError) throw createError;
          toast.success('Created new request (duplicate allowed)');
          break;
        }
      }
    } catch (error: any) {
      toast.error('Failed to process duplicate', {
        description: error.message,
      });
    }

    // Move to next duplicate
    moveToNextDuplicate();
  };

  const validCount = parsedDeals.filter((d) => d.isValid).length;
  const invalidCount = parsedDeals.filter((d) => !d.isValid).length;

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

          {/* Step 2: Upload CSV */}
          <div className="space-y-2 flex-shrink-0">
            <Label htmlFor="csv-file">Step 2: Upload CSV File *</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Maximum {MAX_FILE_SIZE_MB}MB file size • Up to {MAX_ROWS} rows per import • Dates are imported in UTC timezone
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button
                onClick={parseCSV}
                disabled={!csvText || isLoading}
                variant="secondary"
              >
                <Upload className="w-4 h-4 mr-2" />
                Parse CSV
              </Button>
            </div>
            {fileName && (
              <p className="text-sm text-muted-foreground">Selected: {fileName}</p>
            )}
          </div>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {parseErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Step 3: Preview - Only show if import hasn't completed */}
          {parsedDeals.length > 0 && !importResult && (
            <div className="space-y-4 flex-shrink-0">
              <div>
                <Label>Step 3: Preview & Validate</Label>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>{validCount} valid rows</span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span>{invalidCount} invalid rows</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left w-12">Status</th>
                        <th className="px-3 py-2 text-left w-16">Row</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Company</th>
                        <th className="px-3 py-2 text-left">Phone</th>
                        <th className="px-3 py-2 text-left w-32">Role</th>
                        <th className="px-3 py-2 text-left max-w-xs">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedDeals.map((deal, index) => (
                        <tr
                          key={index}
                          className={deal.isValid ? 'hover:bg-muted/50' : 'bg-destructive/10'}
                        >
                          <td className="px-3 py-2">
                            {deal.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{deal.csvRowNumber}</td>
                          <td className="px-3 py-2 font-medium">{deal.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{deal.email}</td>
                          <td className="px-3 py-2">{deal.companyName || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{deal.phoneNumber || '—'}</td>
                          <td className="px-3 py-2 text-xs">
                            <Badge variant="outline" className="text-xs font-normal">
                              {deal.role || '—'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 max-w-xs truncate text-muted-foreground" title={deal.message}>
                            {deal.message || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Show validation errors if any */}
              {invalidCount > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <div className="text-sm font-medium text-destructive mb-2">
                    {invalidCount} Invalid Row{invalidCount > 1 ? 's' : ''}
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground max-h-24 overflow-y-auto">
                    {parsedDeals
                      .filter(d => !d.isValid)
                      .map((deal, i) => (
                        <div key={i}>
                          Row {deal.csvRowNumber}: {deal.errors.join(', ')}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Results - Elegant Success State */}
          {importResult && (
            <div className="space-y-6 py-2">
              {/* Success Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold">Import Complete</h3>
                <p className="text-sm text-muted-foreground">
                  {importResult.imported} connection request{importResult.imported !== 1 ? 's' : ''} successfully imported
                </p>
              </div>

              {/* Stats Grid */}
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
              {importResult.details.imported.some(i => i.linkedToUser) && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span>
                      {importResult.details.imported.filter(i => i.linkedToUser).length} Linked to Existing Users
                    </span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {importResult.details.imported
                      .filter(i => i.linkedToUser)
                      .map((imp, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-background/50">
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
                  <div className="text-sm font-medium text-destructive">
                    Error Details
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-xs text-muted-foreground">
                    {importResult.details.errors.map((err, i) => (
                      <div key={i} className="py-1">
                        <span className="font-medium">Row {err.deal.csvRowNumber}:</span> {err.error}
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
              // After import: show Undo and Close buttons
              <>
                {currentBatchId && importResult.imported > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={handleUndoImport}
                    disabled={isUndoing}
                  >
                    {isUndoing ? 'Undoing...' : 'Undo This Import'}
                  </Button>
                )}
                <Button onClick={handleClose} className="w-full sm:w-auto">
                  Close
                </Button>
              </>
            ) : (
              // Before import: show Cancel and Import buttons
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
          onSkip={() => handleDuplicateAction('skip')}
          onMerge={() => handleDuplicateAction('merge')}
          onReplace={() => handleDuplicateAction('replace')}
          onCreateAnyway={() => handleDuplicateAction('create')}
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
                You are about to import <strong>{parsedDeals.filter(d => d.isValid).length} connection requests</strong> to the listing:
              </AlertDescription>
            </Alert>
            
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-medium mb-1">Selected Listing</div>
              <div className="text-sm text-muted-foreground">
                {listings?.find(l => l.id === selectedListingId)?.title || 'Unknown Listing'}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-medium mb-1">Import Summary</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• {parsedDeals.filter(d => d.isValid).length} valid rows will be imported</div>
                <div>• Each will create a new connection request</div>
                <div>• Duplicate checking will be performed</div>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Make sure you've selected the correct listing. This action will create connection requests that you'll need to manage.
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
            <Button 
              onClick={handleConfirmImport}
              disabled={isLoading}
            >
              {isLoading ? 'Importing...' : 'Confirm & Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
