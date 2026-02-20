import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UniversePerformance } from '@/hooks/useReMarketingAnalytics';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Universe</TableHead>
              <TableHead className="text-center">Scores</TableHead>
              <TableHead className="text-center">Avg Score</TableHead>
              <TableHead className="text-center">Tier A/B</TableHead>
              <TableHead className="text-center">Conversion</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
