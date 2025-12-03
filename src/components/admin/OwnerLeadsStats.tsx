import { useMemo } from "react";
import { Users, Clock, MessageSquare, CheckCircle } from "lucide-react";
import { OwnerLead } from "@/hooks/admin/use-owner-leads";
import { StripeStatsSection } from "./analytics/StripeStatsSection";

interface OwnerLeadsStatsProps {
  leads: OwnerLead[];
}

export function OwnerLeadsStats({ leads }: OwnerLeadsStatsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const total = leads.length;
    const newLeads = leads.filter(l => l.status === "new").length;
    const contacted = leads.filter(l => l.status === "contacted").length;
    const engaged = leads.filter(l => ["meeting_scheduled", "engaged"].includes(l.status)).length;

    const newThisWeek = leads.filter(l => {
      const createdAt = new Date(l.created_at);
      return createdAt >= weekAgo;
    }).length;

    const newLastWeek = leads.filter(l => {
      const createdAt = new Date(l.created_at);
      return createdAt >= twoWeeksAgo && createdAt < weekAgo;
    }).length;

    const growthTrend = newLastWeek > 0 
      ? Math.round(((newThisWeek - newLastWeek) / newLastWeek) * 100)
      : 0;

    return { total, newLeads, contacted, engaged, newThisWeek, growthTrend };
  }, [leads]);

  const stats = [
    {
      label: 'Total leads',
      value: analytics.total.toLocaleString(),
      icon: <Users className="h-4 w-4" />,
      trend: analytics.growthTrend !== 0 ? {
        value: Math.abs(analytics.growthTrend),
        isPositive: analytics.growthTrend > 0,
        label: 'vs last week',
      } : undefined,
      description: analytics.newThisWeek > 0 
        ? `${analytics.newThisWeek} new ${analytics.newThisWeek === 1 ? 'lead' : 'leads'} this week`
        : 'No new leads this week'
    },
    {
      label: 'New leads',
      value: analytics.newLeads.toLocaleString(),
      icon: <Clock className="h-4 w-4" />,
      description: analytics.newLeads > 0 
        ? `${analytics.newLeads} ${analytics.newLeads === 1 ? 'lead' : 'leads'} awaiting contact`
        : 'All leads contacted'
    },
    {
      label: 'Contacted',
      value: analytics.contacted.toLocaleString(),
      icon: <MessageSquare className="h-4 w-4" />,
      description: analytics.total > 0 
        ? `${Math.round((analytics.contacted / analytics.total) * 100)}% of total leads`
        : 'No leads yet'
    },
    {
      label: 'Engaged',
      value: analytics.engaged.toLocaleString(),
      icon: <CheckCircle className="h-4 w-4" />,
      description: 'Meeting scheduled or actively engaged'
    },
  ];

  return <StripeStatsSection stats={stats} />;
}
