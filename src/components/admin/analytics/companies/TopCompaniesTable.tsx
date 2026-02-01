import { Building2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface TopCompaniesTableProps {
  companies: { company: string; visits: number; lastSeen: string }[];
}

export function TopCompaniesTable({ companies }: TopCompaniesTableProps) {
  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Top Visiting Companies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No company data yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Top Visiting Companies
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">Company</th>
                <th className="text-center text-xs font-medium text-muted-foreground pb-3 px-4">Visits</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3 pl-4">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, idx) => (
                <tr 
                  key={company.company} 
                  className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{company.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {company.visits}
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(company.lastSeen), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
