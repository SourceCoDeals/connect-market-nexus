import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAdminListings } from '@/hooks/admin/use-admin-listings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ManualUndoImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManualUndoImportDialog({ isOpen, onClose }: ManualUndoImportDialogProps) {
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [foundRequests, setFoundRequests] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { useListings } = useAdminListings();
  const { data: listings } = useListings();
  const queryClient = useQueryClient();

  const handleSearch = async () => {
    if (!selectedListingId) {
      toast.error('Please select a listing');
      return;
    }

    setIsSearching(true);
    try {
      // Search for connection requests with matching listing and CSV metadata
      const { data, error } = await supabase
        .from('connection_requests')
        .select('id, lead_email, lead_name, lead_company, created_at, source_metadata')
        .eq('listing_id', selectedListingId)
        .eq('source', 'website')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by CSV filename if provided
      let filtered = data || [];
      if (csvFileName.trim()) {
        filtered = filtered.filter(r => {
          const metadata = r.source_metadata as any;
          return metadata?.csv_filename?.toLowerCase().includes(csvFileName.toLowerCase().trim());
        });
      }

      // Filter only CSV imports
      filtered = filtered.filter(r => {
        const metadata = r.source_metadata as any;
        return metadata?.import_method === 'csv_bulk_upload';
      });

      setFoundRequests(filtered);
      
      if (filtered.length === 0) {
        toast.info('No matching CSV imports found', {
          description: csvFileName 
            ? 'Try searching without a filename to see all imports for this listing'
            : 'No CSV imports found for this listing'
        });
      } else {
        toast.success(`Found ${filtered.length} connection requests from CSV import(s)`);
      }
    } catch (error: any) {
      toast.error('Search failed', {
        description: error.message,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async () => {
    if (foundRequests.length === 0) return;

    setIsDeleting(true);
    try {
      const requestIds = foundRequests.map(r => r.id);

      // Delete all found connection requests
      const { error: deleteError } = await supabase
        .from('connection_requests')
        .delete()
        .in('id', requestIds);

      if (deleteError) throw deleteError;

      // Log the manual cleanup
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          table_name: 'connection_requests',
          operation: 'MANUAL_BULK_DELETE',
          admin_id: user.id,
          metadata: {
            listing_id: selectedListingId,
            csv_filename: csvFileName || 'any',
            deleted_count: foundRequests.length,
            deleted_ids: requestIds,
            cleanup_timestamp: new Date().toISOString(),
          },
        });
      }

      // Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['deals'] }),
        queryClient.invalidateQueries({ queryKey: ['connection-requests'] }),
      ]);

      toast.success(`Deleted ${foundRequests.length} connection requests`);
      
      // Reset state
      setFoundRequests([]);
      setSelectedListingId('');
      setCsvFileName('');
      onClose();
    } catch (error: any) {
      toast.error('Delete failed', {
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setFoundRequests([]);
    setSelectedListingId('');
    setCsvFileName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Manual Import Cleanup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Use this tool to find and delete connection requests from previous CSV imports.
              Select the listing and optionally specify the CSV filename.
            </AlertDescription>
          </Alert>

          {/* Search Criteria */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="listing">Listing *</Label>
              <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a listing" />
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

            <div className="space-y-2">
              <Label htmlFor="filename">CSV Filename (optional)</Label>
              <input
                id="filename"
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g., national-painting"
                value={csvFileName}
                onChange={(e) => setCsvFileName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to find all CSV imports for the selected listing
              </p>
            </div>

            <Button 
              onClick={handleSearch} 
              disabled={!selectedListingId || isSearching}
              className="w-full"
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? 'Searching...' : 'Search for Imports'}
            </Button>
          </div>

          {/* Results */}
          {foundRequests.length > 0 && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium mb-2">
                  Found {foundRequests.length} Connection Requests
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {foundRequests.slice(0, 10).map((req, i) => {
                    const metadata = req.source_metadata as any;
                    return (
                      <div key={req.id} className="text-xs p-2 rounded bg-background">
                        <div className="font-medium">{req.lead_name || req.lead_email}</div>
                        <div className="text-muted-foreground">
                          {req.lead_company && `${req.lead_company} • `}
                          From: {metadata?.csv_filename || 'Unknown'}
                        </div>
                        <div className="text-muted-foreground">
                          Imported: {new Date(req.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                  {foundRequests.length > 10 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      ... and {foundRequests.length - 10} more
                    </div>
                  )}
                </div>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This will permanently delete {foundRequests.length} connection requests.
                  This action cannot be undone.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
              Cancel
            </Button>
            {foundRequests.length > 0 && (
              <Button 
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : `Delete ${foundRequests.length} Requests`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
