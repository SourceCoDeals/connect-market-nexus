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
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);
  
  const { useListings } = useAdminListings();
  const { data: listings } = useListings();

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
    const roleMap: Record<string, string> = {
      'private equity': 'privateEquity',
      'family office': 'familyOffice',
      'independent sponsor': 'independentSponsor',
      'search fund': 'searchFund',
      'corporate': 'corporate',
      'individual': 'individual',
      'other': 'other',
    };
    const normalized = role?.toLowerCase().trim() || '';
    return roleMap[normalized] || 'other';
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

  const handleImport = async () => {
    const validDeals = parsedDeals.filter((d) => d.isValid);
    if (validDeals.length === 0) {
      setParseErrors(['No valid deals to import']);
      return;
    }

    const startTime = Date.now();
    const result = await onConfirm({
      listingId: selectedListingId,
      deals: validDeals,
      fileName,
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
            },
          });
        }
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
      
      // If there are duplicates, show resolution dialog
      if (result.details.duplicates.length > 0) {
        setCurrentDuplicateIndex(0);
        setShowDuplicateDialog(true);
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
    setCurrentDuplicateIndex(0);
    onClose();
  };

  const handleDuplicateAction = async (action: 'skip' | 'merge' | 'replace' | 'create') => {
    if (!importResult) return;
    
    const currentDuplicate = importResult.details.duplicates[currentDuplicateIndex];
    if (!currentDuplicate) return;

    const { deal, duplicateInfo } = currentDuplicate;

    try {
      switch (action) {
        case 'skip':
          // Do nothing, just skip
          toast.info('Skipped duplicate entry');
          break;

        case 'merge':
          // Append new message to existing request
          const existingMessage = duplicateInfo.existingMessage || '';
          const newMessage = `${existingMessage}\n\n--- Additional inquiry (${deal.date?.toLocaleDateString() || 'unknown date'}) ---\n${deal.message}`;
          
          const { error: mergeError } = await supabase
            .from('connection_requests')
            .update({
              user_message: newMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', duplicateInfo.existingRequestId);

          if (mergeError) throw mergeError;
          toast.success('Messages merged successfully');
          break;

        case 'replace':
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

        case 'create':
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
    } catch (error: any) {
      toast.error('Failed to process duplicate', {
        description: error.message,
      });
    }

    // Move to next duplicate or close
    if (currentDuplicateIndex < importResult.details.duplicates.length - 1) {
      setCurrentDuplicateIndex(currentDuplicateIndex + 1);
    } else {
      setShowDuplicateDialog(false);
      toast.success('All duplicates processed');
    }
  };

  const validCount = parsedDeals.filter((d) => d.isValid).length;
  const invalidCount = parsedDeals.filter((d) => !d.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Connection Requests</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Listing */}
          <div className="space-y-2">
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
          <div className="space-y-2">
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

          {/* Step 3: Preview */}
          {parsedDeals.length > 0 && (
            <div className="space-y-4">
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

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Company</th>
                        <th className="px-3 py-2 text-left">Phone</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Message</th>
                        <th className="px-3 py-2 text-left">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedDeals.map((deal, index) => (
                        <tr
                          key={index}
                          className={deal.isValid ? '' : 'bg-destructive/10'}
                        >
                          <td className="px-3 py-2">
                            {deal.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                          </td>
                          <td className="px-3 py-2">{deal.csvRowNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{deal.name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{deal.email}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{deal.companyName || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{deal.phoneNumber || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{deal.role || '-'}</td>
                          <td className="px-3 py-2 max-w-xs truncate" title={deal.message}>
                            {deal.message || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-destructive">
                            {deal.errors.join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Results Summary */}
          {importResult && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Import Complete</div>
                  <div className="text-sm space-y-1">
                    <div>✅ {importResult.imported} successfully imported</div>
                    <div>⚠️ {importResult.duplicates} duplicates detected</div>
                    <div>❌ {importResult.errors} errors</div>
                  </div>
                  {importResult.details.imported.some(i => i.linkedToUser) && (
                    <div className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                      🔗 {importResult.details.imported.filter(i => i.linkedToUser).length} requests linked to existing marketplace users with NDA/Fee Agreement statuses synced
                    </div>
                  )}
                  {importResult.details.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-sm font-medium mb-1">Error Details:</div>
                      <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {importResult.details.errors.map((err, i) => (
                          <div key={i} className="text-destructive">
                            Row {err.deal.csvRowNumber}: {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedListingId || validCount === 0 || isLoading}
            >
              {isLoading ? 'Importing...' : `Import ${validCount} Valid Rows`}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Duplicate Resolution Dialog */}
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
    </Dialog>
  );
}
