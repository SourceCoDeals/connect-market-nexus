import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, FileText, Calendar, User, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface ManualUndoImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportBatch {
  id: string;
  csv_filename: string;
  listing_id: string;
  listing_title: string;
  imported_count: number;
  import_date: string;
  admin_name: string;
  batch_id?: string;
}

export function ManualUndoImportDialog({ isOpen, onClose }: ManualUndoImportDialogProps) {
  const [recentImports, setRecentImports] = useState<ImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requestsToDelete, setRequestsToDelete] = useState<any[]>([]);
  const [strictMode, setStrictMode] = useState(true); // when more matches than expected, trim to expected by time proximity
  
  const queryClient = useQueryClient();

  // Compute the effective set to delete based on strict mode and expected count
  const effectiveRequests = useMemo(() => {
    if (!selectedBatch) return requestsToDelete;
    if (!strictMode) return requestsToDelete;
    const expected = selectedBatch.imported_count || 0;
    if (expected === 0 || requestsToDelete.length <= expected) return requestsToDelete;
    const targetTime = new Date(selectedBatch.import_date).getTime();
    return [...requestsToDelete]
      .sort((a, b) => Math.abs(new Date(a.created_at).getTime() - targetTime) - Math.abs(new Date(b.created_at).getTime() - targetTime))
      .slice(0, expected);
  }, [requestsToDelete, strictMode, selectedBatch]);
  // Load recent imports when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadRecentImports();
    }
  }, [isOpen]);

  const loadRecentImports = async () => {
    setIsLoading(true);
    try {
      // Get recent bulk import audit logs
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('id, metadata, timestamp, admin_id')
        .eq('table_name', 'connection_requests')
        .eq('operation', 'BULK_IMPORT')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (auditError) throw auditError;

      // Get admin names
      const adminIds = [...new Set(auditLogs?.map(log => log.admin_id).filter(Boolean) || [])];
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', adminIds);

      const adminMap = new Map(
        adminProfiles?.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email]) || []
      );

      // Get listing titles
      const listingIds = [...new Set(auditLogs?.map(log => (log.metadata as any)?.listing_id).filter(Boolean) || [])];
      const { data: listings } = await supabase
        .from('listings')
        .select('id, title')
        .in('id', listingIds);

      const listingMap = new Map(listings?.map(l => [l.id, l.title]) || []);

      // Transform audit logs into import batches
      const batches: ImportBatch[] = (auditLogs || []).map(log => {
        const metadata = log.metadata as any;
        return {
          id: log.id,
          csv_filename: metadata.csv_filename || 'Unknown',
          listing_id: metadata.listing_id,
          listing_title: listingMap.get(metadata.listing_id) || 'Unknown Listing',
          imported_count: metadata.rows_imported || 0,
          import_date: log.timestamp,
          admin_name: adminMap.get(log.admin_id) || 'Unknown Admin',
          batch_id: metadata.batch_id,
        };
      });

      setRecentImports(batches);

      if (batches.length === 0) {
        toast.info('No recent CSV imports found');
      }
    } catch (error: any) {
      toast.error('Failed to load recent imports', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBatch = async (batch: ImportBatch) => {
    setSelectedBatch(batch);
    setIsLoading(true);

    try {
      // Get all connection requests from this listing that were CSV imports
      const { data: allRequests, error } = await supabase
        .from('connection_requests')
        .select('id, lead_email, lead_name, lead_company, created_at, source_metadata')
        .eq('listing_id', batch.listing_id)
        .eq('source', 'website');

      if (error) throw error;

      // Prefer exact batch_id match when present; otherwise fall back to CSV filename + time window
      const auditTime = new Date(batch.import_date).getTime();
      const WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
      let filtered: any[] = [];

      if (batch.batch_id) {
        filtered = (allRequests || []).filter(r => {
          const md = r.source_metadata as any;
          return md?.batch_id && md.batch_id === batch.batch_id && md?.import_method === 'csv_bulk_upload';
        });
      }

      if (filtered.length === 0) {
        filtered = (allRequests || []).filter(r => {
          const md = r.source_metadata as any;
          const created = new Date(r.created_at).getTime();
          return md?.import_method === 'csv_bulk_upload' &&
                 (!!batch.csv_filename ? md?.csv_filename === batch.csv_filename : true) &&
                 Math.abs(created - auditTime) <= WINDOW_MS;
        });
      }

      setRequestsToDelete(filtered);
      // Enable strict mode automatically if we matched more than the expected count
      setStrictMode((filtered?.length || 0) !== (batch.imported_count || 0));
      if (filtered.length === 0) {
        toast.warning('No matching requests found', {
          description: 'This import may have already been deleted',
        });
      }
    } catch (error: any) {
      toast.error('Failed to load import details', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (requestsToDelete.length === 0 || !selectedBatch) return;

    setIsDeleting(true);
    try {
      const requestIds = effectiveRequests.map(r => r.id);

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
            original_import_audit_id: selectedBatch.id,
            listing_id: selectedBatch.listing_id,
            csv_filename: selectedBatch.csv_filename,
            deleted_count: effectiveRequests.length,
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

      toast.success(`Deleted ${effectiveRequests.length} connection requests`);
      
      // Reset and close
      setSelectedBatch(null);
      setRequestsToDelete([]);
      loadRecentImports(); // Refresh the list
    } catch (error: any) {
      toast.error('Delete failed', {
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setSelectedBatch(null);
    setRequestsToDelete([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Undo CSV Import
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!selectedBatch ? (
            // Step 1: Show list of recent imports
            <>
              <Alert>
                <AlertDescription>
                  Select a recent CSV import to undo. All connection requests from that import will be deleted.
                </AlertDescription>
              </Alert>

              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentImports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent CSV imports found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentImports.map((batch) => (
                    <button
                      key={batch.id}
                      onClick={() => handleSelectBatch(batch)}
                      className="w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium">{batch.csv_filename}</span>
                            <Badge variant="secondary" className="text-xs">
                              {batch.imported_count} requests
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3" />
                              <span className="truncate">{batch.listing_title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(batch.import_date), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span>{batch.admin_name}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge variant="outline">Select</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Step 2: Show confirmation with details
            <>
              <Alert>
                <AlertDescription>
                  You selected the following import to undo:
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium text-lg">{selectedBatch.csv_filename}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Listing</div>
                    <div className="font-medium">{selectedBatch.listing_title}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Imported On</div>
                    <div className="font-medium">
                      {format(new Date(selectedBatch.import_date), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Imported By</div>
                    <div className="font-medium">{selectedBatch.admin_name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Original Count</div>
                    <div className="font-medium">{selectedBatch.imported_count} requests</div>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading requests to delete...
                </div>
              ) : requestsToDelete.length > 0 ? (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="text-sm font-medium">
                      Found {effectiveRequests.length} Connection Requests to Delete
                    </div>
                    {selectedBatch && requestsToDelete.length !== selectedBatch.imported_count && (
                      <div className="text-xs text-muted-foreground">
                        Expected {selectedBatch.imported_count} from this import; matched {requestsToDelete.length}.
                        <label className="inline-flex items-center gap-2 ml-2">
                          <input
                            type="checkbox"
                            checked={strictMode}
                            onChange={(e) => setStrictMode(e.target.checked)}
                          />
                          Strict match to closest {selectedBatch.imported_count} by time
                        </label>
                      </div>
                    )}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {effectiveRequests.slice(0, 10).map((req) => (
                        <div key={req.id} className="text-xs p-2 rounded bg-background">
                          <div className="font-medium">{req.lead_name || req.lead_email}</div>
                          {req.lead_company && (
                            <div className="text-muted-foreground">{req.lead_company}</div>
                          )}
                        </div>
                      ))}
                      {effectiveRequests.length > 10 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          ... and {effectiveRequests.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>

                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This will permanently delete {effectiveRequests.length} connection requests.
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    No matching requests found. This import may have already been deleted.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t flex-shrink-0">
          {selectedBatch ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedBatch(null);
                  setRequestsToDelete([]);
                }}
                disabled={isDeleting}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
                  Cancel
                </Button>
                {effectiveRequests.length > 0 && (
                  <Button 
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : `Delete ${effectiveRequests.length} Requests`}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} className="ml-auto">
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

