import { Building2, Users, Repeat, TrendingUp, ExternalLink, Linkedin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVisitorCompanyStats, useRecentVisitors } from "@/hooks/useVisitorCompanies";
import { TopCompaniesTable } from "./TopCompaniesTable";
import { IndustryBreakdownChart } from "./IndustryBreakdownChart";
import { CompanySizeDistribution } from "./CompanySizeDistribution";
import { VisitorLiveFeed } from "./VisitorLiveFeed";
import { formatDistanceToNow } from "date-fns";

interface VisitorCompaniesDashboardProps {
  timeRangeDays?: number;
}

export function VisitorCompaniesDashboard({ timeRangeDays = 30 }: VisitorCompaniesDashboardProps) {
  const { stats, visitors, isLoading, error } = useVisitorCompanyStats(timeRangeDays);
  const { data: recentVisitors = [] } = useRecentVisitors(20);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <p className="text-destructive">Failed to load visitor companies data</p>
      </div>
    );
  }

  const hasData = visitors.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Visitor Companies</h2>
          <p className="text-sm text-muted-foreground">
            B2B visitor identification from RB2B & Warmly
          </p>
        </div>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            Last {timeRangeDays} days
          </span>
        )}
      </div>

      {/* Setup Guide - Show when no data */}
      {!hasData && !isLoading && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-500" />
              Configure Webhooks to Start Capturing Data
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <p className="text-muted-foreground">
              Connect RB2B and Warmly webhooks to identify companies visiting your marketplace.
            </p>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">RB2B Webhook URL:</p>
                <code className="text-xs bg-background px-2 py-1 rounded border">
                  https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/webhook-visitor-identification?source=rb2b
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure at: app.rb2b.com → Integrations → Webhook
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">Warmly Webhook URL:</p>
                <code className="text-xs bg-background px-2 py-1 rounded border">
                  https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/webhook-visitor-identification?source=warmly
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure at: opps.getwarmly.com → Settings → Webhooks
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalIdentified}</p>
                <p className="text-xs text-muted-foreground">Identified Visitors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueCompanies}</p>
                <p className="text-xs text-muted-foreground">Unique Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Repeat className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.repeatVisitors}</p>
                <p className="text-xs text-muted-foreground">Repeat Visitors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <TrendingUp className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.uniqueCompanies > 0 
                    ? (stats.totalIdentified / stats.uniqueCompanies).toFixed(1)
                    : '0'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Visits/Company</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasData && (
        <>
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Feed - Takes 1 column */}
            <div className="lg:col-span-1">
              <VisitorLiveFeed visitors={recentVisitors} isLoading={isLoading} />
            </div>

            {/* Top Companies Table - Takes 2 columns */}
            <div className="lg:col-span-2">
              <TopCompaniesTable companies={stats.topCompanies} />
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IndustryBreakdownChart industries={stats.topIndustries} />
            <CompanySizeDistribution sizes={stats.companySizes} />
          </div>

          {/* Source Attribution */}
          {stats.sourceBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Data Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {stats.sourceBreakdown.map(({ source, count }) => (
                    <div key={source} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        source === 'rb2b' ? 'bg-blue-500' : 
                        source === 'warmly' ? 'bg-orange-500' : 'bg-slate-500'
                      }`} />
                      <span className="text-sm font-medium capitalize">{source}</span>
                      <span className="text-sm text-muted-foreground">({count})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
