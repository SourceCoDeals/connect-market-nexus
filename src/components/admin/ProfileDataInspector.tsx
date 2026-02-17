import React, { useMemo } from 'react';
import { useProfilesHistory } from '@/hooks/admin/use-profiles-history';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

const toArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  // jsonb comes as object; try to extract array of strings
  try {
    if (typeof v === 'string') {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    }
    if (typeof v === 'object' && v !== null) {
      // Already JSON-like; attempt to read as array elements
      // In practice supabase-js returns arrays correctly, but keep safe path
      const maybeArr = v as any[];
      return Array.isArray(maybeArr) ? (maybeArr as string[]) : [];
    }
  } catch {
    // ignore
  }
  return [];
};

const arrKey = (arr: string[]) => JSON.stringify([...arr]);

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

export const ProfileDataInspector: React.FC = () => {
  const { data, isLoading, error } = useProfilesHistory();

  const stats = useMemo(() => {
    const rows = data || [];
    const total = rows.length;
    let catDiff = 0;
    let locDiff = 0;
    let significantLoss = 0;

    rows.forEach(r => {
      const currentCats = toArray(r.business_categories_current);
      const rawCats = toArray(r.raw_business_categories);
      if (rawCats.length > 0 && arrKey(currentCats) !== arrKey(rawCats)) {
        catDiff++;
        if (isSignificantLoss(currentCats, rawCats)) {
          significantLoss++;
        }
      }

      const currentLocs = toArray(r.target_locations_current);
      const rawLocs = toArray(r.raw_target_locations);
      if (rawLocs.length > 0) {
        // Normalize currentLocs if they were stored as a string historically
        if (arrKey(currentLocs) !== arrKey(rawLocs)) {
          locDiff++;
        }
      }
    });

    return { total, catDiff, locDiff, significantLoss };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="p-4 md:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Profile Data Inspector</div>
          <Badge variant="outline">Loading…</Badge>
        </div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 md:p-6 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Profile Data Inspector</div>
          <Badge variant="destructive">Error</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Unable to load historical profile data. Ensure you are an admin and try again.
        </div>
      </Card>
    );
  }

  const rows = data || [];
  const flagged = rows.filter(r => {
    const currentCats = toArray(r.business_categories_current);
    const rawCats = toArray(r.raw_business_categories);
    const currentLocs = toArray(r.target_locations_current);
    const rawLocs = toArray(r.raw_target_locations);
    const catsMismatch = rawCats.length > 0 && arrKey(currentCats) !== arrKey(rawCats);
    const locsMismatch = rawLocs.length > 0 && arrKey(currentLocs) !== arrKey(rawLocs);
    return catsMismatch || locsMismatch;
  });

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="font-semibold">Profile Data Inspector</div>
          <div className="text-xs text-muted-foreground">
            Compare current profile categories/locations with raw historical snapshots captured at signup or earliest audit logs.
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Profiles: {stats.total}</Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-600/30">
            Category diffs: {stats.catDiff}
          </Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-600/30">
            Location diffs: {stats.locDiff}
          </Badge>
          {stats.significantLoss > 0 && (
            <Badge variant="outline" className="text-red-600 border-red-600/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Over-standardized: {stats.significantLoss}
            </Badge>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Buyer Type</TableHead>
              <TableHead>Categories (Current → Raw)</TableHead>
              <TableHead>Locations (Current → Raw)</TableHead>
              <TableHead>Snapshot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flagged.slice(0, 50).map((r) => {
              const currentCats = toArray(r.business_categories_current);
              const rawCats = toArray(r.raw_business_categories);
              const currentLocs = toArray(r.target_locations_current);
              const rawLocs = toArray(r.raw_target_locations);

              const catsMismatch = rawCats.length > 0 && arrKey(currentCats) !== arrKey(rawCats);
              const locsMismatch = rawLocs.length > 0 && arrKey(currentLocs) !== arrKey(rawLocs);
              const significantCatLoss = isSignificantLoss(currentCats, rawCats);

              return (
                <TableRow key={r.id || r.email || Math.random()}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {r.email || '—'}
                      {significantCatLoss && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.buyer_type || '—'}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className={significantCatLoss ? 'text-red-600 font-medium' : catsMismatch ? 'text-foreground' : 'text-muted-foreground'}>
                        {currentCats.length ? currentCats.join(', ') : '—'}
                      </div>
                      <div className="text-muted-foreground/70">→ {rawCats.length ? rawCats.join(', ') : '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className={locsMismatch ? 'text-foreground' : 'text-muted-foreground'}>
                        {currentLocs.length ? currentLocs.join(', ') : '—'}
                      </div>
                      <div className="text-muted-foreground/70">→ {rawLocs.length ? rawLocs.join(', ') : '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{r.snapshot_type || '—'}</span>
                      <span className="text-muted-foreground/70">
                        {r.snapshot_created_at ? new Date(r.snapshot_created_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {flagged.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  No differences detected between current and raw snapshots.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            const csvRows: string[] = [];
            const headers = ['Email', 'Buyer Type', 'Categories Current', 'Categories Raw', 'Locations Current', 'Locations Raw', 'Snapshot Type', 'Snapshot At'];
            csvRows.push(headers.map(h => `"${h}"`).join(','));

            flagged.forEach((r) => {
              const currentCats = toArray(r.business_categories_current).join('; ');
              const rawCats = toArray(r.raw_business_categories).join('; ');
              const currentLocs = toArray(r.target_locations_current).join('; ');
              const rawLocs = toArray(r.raw_target_locations).join('; ');
              const row = [
                r.email || '',
                r.buyer_type || '',
                currentCats,
                rawCats,
                currentLocs,
                rawLocs,
                r.snapshot_type || '',
                r.snapshot_created_at ? new Date(r.snapshot_created_at).toISOString() : ''
              ].map(x => `"${x}"`).join(',');
              csvRows.push(row);
            });

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `profile_data_diffs_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
          }}
        >
          Export flagged diffs (CSV)
        </Button>
      </div>
    </Card>
  );
};
