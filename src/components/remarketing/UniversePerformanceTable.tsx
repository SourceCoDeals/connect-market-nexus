import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UniversePerformance } from '@/hooks/useReMarketingAnalytics';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, TrendingUp } from 'lucide-react';
import { useColumnResize } from '@/hooks/useColumnResize';
import { ResizeHandle } from '@/components/ui/ResizeHandle';

const DEFAULT_WIDTHS: Record<string, number> = {
  universe: 200,
  scores: 80,
  avgScore: 100,
  tierAB: 100,
  conversion: 100,
  actions: 60,
};

interface UniversePerformanceTableProps {
  data: UniversePerformance[];
  className?: string;
}

function getScoreBadgeVariant(score: number): "default" | "secondary" | "outline" | "destructive" {
  if (score >= 80) return "default";
  if (score >= 70) return "secondary";
  if (score >= 60) return "outline";
  return "destructive";
}

export function UniversePerformanceTable({ data, className }: UniversePerformanceTableProps) {
  const { columnWidths, startResize } = useColumnResize({ defaultWidths: DEFAULT_WIDTHS });

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Universe Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No universe data available yet</p>
            <p className="text-sm mt-1">Create buyer universes and run scoring to see performance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Universe Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="relative" style={{ width: columnWidths.universe }}>
                Universe
                <ResizeHandle onMouseDown={(e) => startResize('universe', e)} />
              </TableHead>
              <TableHead className="text-center relative" style={{ width: columnWidths.scores }}>
                Scores
                <ResizeHandle onMouseDown={(e) => startResize('scores', e)} />
              </TableHead>
              <TableHead className="text-center relative" style={{ width: columnWidths.avgScore }}>
                Avg Score
                <ResizeHandle onMouseDown={(e) => startResize('avgScore', e)} />
              </TableHead>
              <TableHead className="text-center relative" style={{ width: columnWidths.tierAB }}>
                Tier A/B
                <ResizeHandle onMouseDown={(e) => startResize('tierAB', e)} />
              </TableHead>
              <TableHead className="text-center relative" style={{ width: columnWidths.conversion }}>
                Conversion
                <ResizeHandle onMouseDown={(e) => startResize('conversion', e)} />
              </TableHead>
              <TableHead className="text-right" style={{ width: columnWidths.actions }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 10).map((universe) => (
              <TableRow key={universe.id}>
                <TableCell>
                  <div className="font-medium truncate max-w-[200px]">
                    {universe.name}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {universe.totalScores}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={getScoreBadgeVariant(universe.avgScore)}>
                    {universe.avgScore}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-emerald-600 font-medium">
                      {universe.tierACount}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-blue-600 font-medium">
                      {universe.tierBCount}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {universe.conversionRate > 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600 font-medium">
                          {universe.conversionRate.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/admin/buyers/universes/${universe.id}`}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {data.length > 10 && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/buyers/universes">
                View All {data.length} Universes
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
