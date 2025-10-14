import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Upload, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Papa from 'papaparse';
import { parse } from 'date-fns';
import { useAdminListings } from '@/hooks/admin/use-admin-listings';
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
  onConfirm: (data: any) => void;
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
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [csvText, setCsvText] = useState('');
  const [parsedDeals, setParsedDeals] = useState<ParsedDeal[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  
  const { useListings } = useAdminListings();
  const { data: listings } = useListings();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
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
          results.data.forEach((row: any, index) => {
            const rowNumber = index + 2;
            const dealErrors: string[] = [];
            
            const email = row['Email address']?.trim() || '';
            const name = row['Name']?.trim() || '';
            const message = row['Message']?.trim() || '';

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

            deals.push({
              csvRowNumber: rowNumber,
              date: parseDate(row['Date']),
              name,
              email,
              companyName: cleanCompanyName(row['Company name']),
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

  const handleImport = () => {
    const validDeals = parsedDeals.filter((d) => d.isValid);
    if (validDeals.length === 0) {
      setParseErrors(['No valid deals to import']);
      return;
    }

    onConfirm({
      listingId: selectedListingId,
      deals: validDeals,
      fileName,
    });
  };

  const handleClose = () => {
    setCsvText('');
    setParsedDeals([]);
    setParseErrors([]);
    setSelectedListingId('');
    setFileName('');
    onClose();
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
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Company</th>
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
                          <td className="px-3 py-2">{deal.name}</td>
                          <td className="px-3 py-2">{deal.email}</td>
                          <td className="px-3 py-2">{deal.companyName || '-'}</td>
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
    </Dialog>
  );
}
