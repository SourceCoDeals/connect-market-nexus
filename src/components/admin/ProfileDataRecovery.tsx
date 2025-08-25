import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { useProfilesHistory } from '@/hooks/admin/use-profiles-history';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const toArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  try {
    if (typeof v === 'string') {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    }
    if (typeof v === 'object' && v !== null) {
      const maybeArr = v as any[];
      return Array.isArray(maybeArr) ? (maybeArr as string[]) : [];
    }
  } catch {
    // ignore
  }
  return [];
};

const isSignificantLoss = (current: string[], raw: string[]): boolean => {
  if (raw.length === 0) return false;
  if (current.length === 1 && raw.length > 1) {
    // Over-standardization: multiple diverse categories → single category
    const singleCat = current[0]?.toLowerCase();
    if (singleCat === 'technology & software' || singleCat === 'technology and software') {
      return true; // Likely over-standardized
    }
  }
  return false;
};

export const ProfileDataRecovery: React.FC = () => {
  const { data, isLoading, refetch } = useProfilesHistory();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

  const restoreProfile = async (profileId: string, email: string, rawCategories: string[], rawLocations: string[]) => {
    if (!profileId || (!rawCategories.length && !rawLocations.length)) return;

    setRestoringIds(prev => new Set(prev).add(profileId));
    try {
      const updates: any = {};
      
      if (rawCategories.length > 0) {
        updates.business_categories = rawCategories;
      }
      if (rawLocations.length > 0) {
        updates.target_locations = rawLocations;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: 'Profile restored',
        description: `Successfully restored original data for ${email}`,
      });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['profiles-with-history'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Restore failed',
        description: error.message || 'Failed to restore profile data',
      });
    } finally {
      setRestoringIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
    }
  };

  const bulkRestoreOverStandardized = async () => {
    const rows = data || [];
    const candidates = rows.filter(r => {
      const currentCats = toArray(r.business_categories_current);
      const rawCats = toArray(r.raw_business_categories);
      return isSignificantLoss(currentCats, rawCats);
    });

    if (candidates.length === 0) {
      toast({
        title: 'No candidates found',
        description: 'No profiles detected with significant over-standardization',
      });
      return;
    }

    setRestoringIds(new Set(candidates.map(c => c.id).filter(Boolean) as string[]));
    
    try {
      let restored = 0;
      for (const candidate of candidates) {
        if (!candidate.id) continue;
        
        const rawCats = toArray(candidate.raw_business_categories);
        const rawLocs = toArray(candidate.raw_target_locations);
        
        if (rawCats.length > 0 || rawLocs.length > 0) {
          const updates: any = {};
          if (rawCats.length > 0) updates.business_categories = rawCats;
          if (rawLocs.length > 0) updates.target_locations = rawLocs;
          
          const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', candidate.id);
            
          if (!error) restored++;
        }
      }

      toast({
        title: 'Bulk restore complete',
        description: `Successfully restored ${restored} profiles`,
      });

      await queryClient.invalidateQueries({ queryKey: ['profiles-with-history'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk restore failed',
        description: error.message || 'Failed to complete bulk restore',
      });
    } finally {
      setRestoringIds(new Set());
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  const rows = data || [];
  const problematic = rows.filter(r => {
    const currentCats = toArray(r.business_categories_current);
    const rawCats = toArray(r.raw_business_categories);
    const currentLocs = toArray(r.target_locations_current);
    const rawLocs = toArray(r.raw_target_locations);
    
    const significantCatLoss = isSignificantLoss(currentCats, rawCats);
    const locsMismatch = rawLocs.length > 0 && JSON.stringify(currentLocs) !== JSON.stringify(rawLocs);
    
    return significantCatLoss || locsMismatch;
  });

  const overStandardized = problematic.filter(r => {
    const currentCats = toArray(r.business_categories_current);
    const rawCats = toArray(r.raw_business_categories);
    return isSignificantLoss(currentCats, rawCats);
  });

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Profile Data Recovery
          </div>
          <div className="text-xs text-muted-foreground">
            Restore original categories and locations from signup snapshots for over-standardized profiles.
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-red-600 border-red-600/30">
            Problematic: {problematic.length}
          </Badge>
          <Badge variant="outline" className="text-orange-600 border-orange-600/30">
            Over-standardized: {overStandardized.length}
          </Badge>
        </div>
      </div>

      {overStandardized.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={bulkRestoreOverStandardized}
            disabled={restoringIds.size > 0}
            className="text-orange-600 border-orange-600/30 hover:bg-orange-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${restoringIds.size > 0 ? 'animate-spin' : ''}`} />
            Bulk Restore Over-Standardized ({overStandardized.length})
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Current → Raw Categories</TableHead>
              <TableHead>Current → Raw Locations</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problematic.slice(0, 20).map((r) => {
              const currentCats = toArray(r.business_categories_current);
              const rawCats = toArray(r.raw_business_categories);
              const currentLocs = toArray(r.target_locations_current);
              const rawLocs = toArray(r.raw_target_locations);
              
              const significantCatLoss = isSignificantLoss(currentCats, rawCats);
              const locsMismatch = rawLocs.length > 0 && JSON.stringify(currentLocs) !== JSON.stringify(rawLocs);
              const isRestoring = restoringIds.has(r.id || '');

              return (
                <TableRow key={r.id || r.email || Math.random()}>
                  <TableCell className="whitespace-nowrap">{r.email || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {significantCatLoss && (
                        <Badge variant="outline" className="text-orange-600 border-orange-600/30 text-xs">
                          Over-standardized
                        </Badge>
                      )}
                      {locsMismatch && (
                        <Badge variant="outline" className="text-blue-600 border-blue-600/30 text-xs">
                          Locations diff
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className={significantCatLoss ? 'text-orange-600' : 'text-foreground'}>
                        {currentCats.length ? currentCats.join(', ') : '—'}
                      </div>
                      <div className="text-muted-foreground/70">→ {rawCats.length ? rawCats.join(', ') : '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className={locsMismatch ? 'text-blue-600' : 'text-foreground'}>
                        {currentLocs.length ? currentLocs.join(', ') : '—'}
                      </div>
                      <div className="text-muted-foreground/70">→ {rawLocs.length ? rawLocs.join(', ') : '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreProfile(r.id || '', r.email || '', rawCats, rawLocs)}
                      disabled={isRestoring || (!rawCats.length && !rawLocs.length)}
                      className="text-green-600 border-green-600/30 hover:bg-green-50"
                    >
                      {isRestoring ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {problematic.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  No problematic profiles detected. All data appears consistent.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};