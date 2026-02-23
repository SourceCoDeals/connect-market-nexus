import { Card, CardContent } from '@/components/ui/card';
import { Calculator, Users, Clock, CheckCircle2 } from 'lucide-react';

export interface KpiStats {
  totalLeads: number;
  openToIntros: number;
  exitNow: number;
  pushedCount: number;
  avgScore: number;
}

interface KpiStatsCardsProps {
  stats: KpiStats;
}

export function KpiStatsCards({ stats }: KpiStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calculator className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Leads</p>
              <p className="text-2xl font-bold">{stats.totalLeads}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open to Intros</p>
              <p className="text-2xl font-bold text-blue-600">{stats.openToIntros}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Clock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Exit Now</p>
              <p className="text-2xl font-bold text-red-600">{stats.exitNow}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Added to All Deals</p>
              <p className="text-2xl font-bold text-green-600">{stats.pushedCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
