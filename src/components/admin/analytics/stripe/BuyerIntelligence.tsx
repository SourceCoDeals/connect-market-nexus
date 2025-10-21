import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { User, BuyerType } from "@/types";
import { Building2, User as UserIcon, TrendingUp, Briefcase, Users, Target, Search, Building } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface BuyerIntelligenceProps {
  users: User[];
}

const BUYER_TYPE_CONFIG: Record<BuyerType, { label: string; icon: any; color: string }> = {
  corporate: { label: 'Strategic Buyer', icon: Building2, color: 'hsl(220, 70%, 50%)' },
  privateEquity: { label: 'Private Equity', icon: TrendingUp, color: 'hsl(280, 70%, 50%)' },
  familyOffice: { label: 'Family Office', icon: Building, color: 'hsl(340, 70%, 50%)' },
  searchFund: { label: 'Search Fund', icon: Search, color: 'hsl(160, 70%, 45%)' },
  individual: { label: 'Individual Investor', icon: UserIcon, color: 'hsl(40, 90%, 55%)' },
  independentSponsor: { label: 'Independent Sponsor', icon: Briefcase, color: 'hsl(200, 70%, 50%)' },
  advisor: { label: 'Advisor/Banker', icon: Users, color: 'hsl(100, 60%, 45%)' },
  businessOwner: { label: 'Business Owner', icon: Target, color: 'hsl(20, 80%, 55%)' },
};

export function BuyerIntelligence({ users }: BuyerIntelligenceProps) {
  const buyerAnalytics = useMemo(() => {
    const buyerGroups: Record<BuyerType, User[]> = {
      corporate: [],
      privateEquity: [],
      familyOffice: [],
      searchFund: [],
      individual: [],
      independentSponsor: [],
      advisor: [],
      businessOwner: [],
    };

    users.forEach(user => {
      if (user.buyer_type && buyerGroups[user.buyer_type]) {
        buyerGroups[user.buyer_type].push(user);
      }
    });

    const analytics = Object.entries(buyerGroups).map(([type, groupUsers]) => {
      const buyerType = type as BuyerType;
      const count = groupUsers.length;
      const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
      
      // Calculate average profile completion
      const fields = [
        'first_name', 'last_name', 'email', 'company', 'phone_number',
        'website', 'linkedin_profile', 'buyer_type', 'ideal_target_description'
      ];
      const avgCompletion = count > 0 
        ? groupUsers.reduce((sum, user) => {
            const completed = fields.filter(field => user[field as keyof User]).length;
            return sum + (completed / fields.length) * 100;
          }, 0) / count
        : 0;
      
      // Calculate approval rate
      const approved = groupUsers.filter(u => u.approval_status === 'approved').length;
      const approvalRate = count > 0 ? (approved / count) * 100 : 0;
      
      return {
        type: buyerType,
        count,
        percentage,
        avgCompletion,
        approvalRate,
        approved,
      };
    }).filter(a => a.count > 0).sort((a, b) => b.count - a.count);

    // Prepare pie chart data
    const pieData = analytics.map(a => ({
      name: BUYER_TYPE_CONFIG[a.type].label,
      value: a.count,
      color: BUYER_TYPE_CONFIG[a.type].color,
    }));

    // Find insights
    const mostEngaged = analytics.reduce((max, curr) => 
      curr.avgCompletion > max.avgCompletion ? curr : max
    , analytics[0]);
    
    const needsAttention = analytics.reduce((min, curr) => 
      curr.avgCompletion < min.avgCompletion ? curr : min
    , analytics[0]);

    return { analytics, pieData, mostEngaged, needsAttention };
  }, [users]);

  return (
    <div className="space-y-section">
      {/* Distribution Overview */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Buyer Type Distribution</CardTitle>
          <CardDescription>Market share across buyer segments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={buyerAnalytics.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {buyerAnalytics.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Buyer Type Cards */}
      <div className="grid gap-element md:grid-cols-2">
        {buyerAnalytics.analytics.map((buyer) => {
          const config = BUYER_TYPE_CONFIG[buyer.type];
          const Icon = config.icon;
          
          return (
            <Card 
              key={buyer.type} 
              className="group border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              <CardContent className="p-card">
                <div className="flex items-start justify-between mb-element">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:scale-110"
                      style={{ 
                        backgroundColor: `${config.color}15`,
                        boxShadow: `0 0 0 1px ${config.color}20`
                      }}
                    >
                      <Icon className="h-5 w-5 transition-transform duration-300" style={{ color: config.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">{config.label}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="tabular-nums font-semibold">
                          {buyer.count} users
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {buyer.percentage.toFixed(1)}% share
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-compact">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground font-medium">Profile Completion</span>
                      <span className="font-bold tabular-nums">{buyer.avgCompletion.toFixed(0)}%</span>
                    </div>
                    <Progress value={buyer.avgCompletion} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground font-medium">Approval Rate</span>
                      <span className="font-bold tabular-nums">{buyer.approvalRate.toFixed(0)}%</span>
                    </div>
                    <Progress value={buyer.approvalRate} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t mt-3">
                    <span className="text-xs text-muted-foreground font-medium">Approved Users</span>
                    <span className="text-sm font-bold tabular-nums">{buyer.approved} / {buyer.count}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Insights Panel */}
      <Card className="bg-gradient-subtle border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Buyer Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          {buyerAnalytics.mostEngaged && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
              <p className="text-success-foreground">
                Most engaged: <span className="font-semibold">{BUYER_TYPE_CONFIG[buyerAnalytics.mostEngaged.type].label}</span> ({buyerAnalytics.mostEngaged.avgCompletion.toFixed(0)}% avg completion)
              </p>
            </div>
          )}
          {buyerAnalytics.needsAttention && buyerAnalytics.needsAttention.avgCompletion < 70 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
              <p className="text-warning-foreground">
                Needs attention: <span className="font-semibold">{BUYER_TYPE_CONFIG[buyerAnalytics.needsAttention.type].label}</span> ({buyerAnalytics.needsAttention.avgCompletion.toFixed(0)}% completion)
              </p>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
            <p className="text-foreground/90">
              Growth opportunity: Focus on underrepresented segments to diversify buyer base
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
