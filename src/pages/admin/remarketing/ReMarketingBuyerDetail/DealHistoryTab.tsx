import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";

interface DealHistoryTabProps {
  recentScores: unknown[];
}

export const DealHistoryTab = ({ recentScores }: DealHistoryTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Match History</CardTitle>
        <CardDescription>Recent scoring activity for this buyer</CardDescription>
      </CardHeader>
      <CardContent>
        {recentScores?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No matches scored yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentScores?.map((score: any) => (
                <TableRow key={score.id}>
                  <TableCell>
                    <Link
                      to={`/admin/remarketing/matching/${score.listing?.id}`}
                      className="font-medium hover:underline"
                    >
                      {score.listing?.title || 'Unknown'}
                    </Link>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {Math.round(score.composite_score)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      score.tier === 'A' ? 'default' :
                      score.tier === 'B' ? 'secondary' :
                      'outline'
                    }>
                      Tier {score.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      score.status === 'approved' ? 'default' :
                      score.status === 'passed' ? 'secondary' :
                      'outline'
                    }>
                      {score.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(score.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
