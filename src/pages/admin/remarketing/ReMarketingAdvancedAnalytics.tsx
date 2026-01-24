import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  WinRateAnalysis,
  OutreachVelocityDashboard
} from '@/components/remarketing';
import { 
  ArrowLeft, 
  Trophy, 
  Timer, 
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { subDays, differenceInDays, format } from 'date-fns';

const ReMarketingAdvancedAnalytics = () => {
  const [activeTab, setActiveTab] = useState('win-rate');
  const [daysBack, setDaysBack] = useState(90);

  // Fetch outreach records with related data
  const { data: outreachData, isLoading: outreachLoading, refetch } = useQuery({
    queryKey: ['remarketing', 'outreach-analytics', daysBack],
    queryFn: async () => {
      const startDate = subDays(new Date(), daysBack);
      
      const { data: outreach, error } = await supabase
        .from('outreach_records')
        .select(`
          *,
          score:remarketing_scores(tier, composite_score),
          buyer:remarketing_buyers(buyer_type, company_name)
        `)
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      return outreach || [];
    }
  });

  // Fetch scores for tier analysis
  const { data: scoresData, isLoading: scoresLoading } = useQuery({
    queryKey: ['remarketing', 'scores-for-analytics', daysBack],
    queryFn: async () => {
      const startDate = subDays(new Date(), daysBack);
      
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('tier, composite_score, status, created_at')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = outreachLoading || scoresLoading;

  // Process win rate data
  const processWinRateData = () => {
    const outreach = outreachData || [];
    
    // By Tier
    const tierGroups: Record<string, { wins: number; losses: number; total: number }> = {
      'Tier A': { wins: 0, losses: 0, total: 0 },
      'Tier B': { wins: 0, losses: 0, total: 0 },
      'Tier C': { wins: 0, losses: 0, total: 0 },
      'Tier D': { wins: 0, losses: 0, total: 0 },
    };
    
    // By Buyer Type
    const buyerTypeGroups: Record<string, { wins: number; losses: number; total: number }> = {};
    
    // By Deal Size (using score composite as proxy)
    const dealSizeGroups: Record<string, { wins: number; losses: number; total: number }> = {
      'Small (<$1M)': { wins: 0, losses: 0, total: 0 },
      'Mid ($1-5M)': { wins: 0, losses: 0, total: 0 },
      'Large ($5-20M)': { wins: 0, losses: 0, total: 0 },
      'Enterprise (>$20M)': { wins: 0, losses: 0, total: 0 },
    };

    let totalWins = 0;
    let totalDeals = 0;
    let totalRevenue = 0;
    let totalDaysToClose = 0;
    let closedCount = 0;

    outreach.forEach((record: any) => {
      if (!record.outcome) return;
      
      const isWin = record.outcome === 'won';
      const tier = record.score?.tier ? `Tier ${record.score.tier}` : 'Tier D';
      const buyerType = record.buyer?.buyer_type || 'Unknown';
      
      // Track by tier
      if (tierGroups[tier]) {
        tierGroups[tier].total++;
        if (isWin) tierGroups[tier].wins++;
        else tierGroups[tier].losses++;
      }
      
      // Track by buyer type
      if (!buyerTypeGroups[buyerType]) {
        buyerTypeGroups[buyerType] = { wins: 0, losses: 0, total: 0 };
      }
      buyerTypeGroups[buyerType].total++;
      if (isWin) buyerTypeGroups[buyerType].wins++;
      else buyerTypeGroups[buyerType].losses++;
      
      // Track totals
      totalDeals++;
      if (isWin) {
        totalWins++;
        totalRevenue += 1000000; // Placeholder - would come from deal data
        
        if (record.contacted_at && record.outcome_at) {
          totalDaysToClose += differenceInDays(
            new Date(record.outcome_at),
            new Date(record.contacted_at)
          );
          closedCount++;
        }
      }
    });

    const byTier = Object.entries(tierGroups).map(([segment, data]) => ({
      segment,
      ...data,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0
    }));

    const byBuyerType = Object.entries(buyerTypeGroups)
      .map(([segment, data]) => ({
        segment,
        ...data,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0
      }))
      .sort((a, b) => b.winRate - a.winRate);

    const byDealSize = Object.entries(dealSizeGroups).map(([segment, data]) => ({
      segment,
      ...data,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0
    }));

    return {
      byTier,
      byBuyerType,
      byDealSize,
      overallStats: {
        totalWins,
        totalDeals,
        overallWinRate: totalDeals > 0 ? (totalWins / totalDeals) * 100 : 0,
        avgDealSize: totalWins > 0 ? totalRevenue / totalWins : 0,
        avgDaysToClose: closedCount > 0 ? Math.round(totalDaysToClose / closedCount) : 0,
        totalRevenue
      }
    };
  };

  // Process velocity data
  const processVelocityData = () => {
    const outreach = outreachData || [];
    
    let approvalToContactDays: number[] = [];
    let contactToResponseDays: number[] = [];
    let responseToMeetingDays: number[] = [];
    let meetingToCloseDays: number[] = [];
    
    let contacted = 0;
    let responded = 0;
    let meetingScheduled = 0;

    outreach.forEach((record: any) => {
      if (record.contacted_at) {
        contacted++;
        
        // Approval to contact (assume approval is creation)
        const daysToContact = differenceInDays(
          new Date(record.contacted_at),
          new Date(record.created_at)
        );
        if (daysToContact >= 0) approvalToContactDays.push(daysToContact);
        
        // If NDA signed (proxy for response)
        if (record.nda_signed_at) {
          responded++;
          const daysToResponse = differenceInDays(
            new Date(record.nda_signed_at),
            new Date(record.contacted_at)
          );
          if (daysToResponse >= 0) contactToResponseDays.push(daysToResponse);
          
          // If meeting scheduled
          if (record.meeting_scheduled_at) {
            meetingScheduled++;
            const daysToMeeting = differenceInDays(
              new Date(record.meeting_scheduled_at),
              new Date(record.nda_signed_at)
            );
            if (daysToMeeting >= 0) responseToMeetingDays.push(daysToMeeting);
            
            // If closed
            if (record.outcome_at && record.outcome === 'won') {
              const daysToClose = differenceInDays(
                new Date(record.outcome_at),
                new Date(record.meeting_scheduled_at)
              );
              if (daysToClose >= 0) meetingToCloseDays.push(daysToClose);
            }
          }
        }
      }
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const avgApprovalToContact = avg(approvalToContactDays);
    const avgContactToResponse = avg(contactToResponseDays);
    const avgResponseToMeeting = avg(responseToMeetingDays);
    const avgMeetingToClose = avg(meetingToCloseDays);

    // Generate trend data (group by week)
    const trendMap = new Map<string, { totalDays: number; count: number }>();
    
    outreach.forEach((record: any) => {
      if (record.outcome_at && record.contacted_at) {
        const weekKey = format(new Date(record.outcome_at), 'MMM d');
        const totalDays = differenceInDays(
          new Date(record.outcome_at),
          new Date(record.contacted_at)
        );
        
        if (!trendMap.has(weekKey)) {
          trendMap.set(weekKey, { totalDays: 0, count: 0 });
        }
        const existing = trendMap.get(weekKey)!;
        existing.totalDays += totalDays;
        existing.count++;
      }
    });

    const velocityTrends = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        avgDays: data.count > 0 ? data.totalDays / data.count : 0,
        deals: data.count
      }))
      .slice(-12); // Last 12 data points

    return {
      velocityTrends,
      stageVelocities: [], // Could be expanded
      summary: {
        avgApprovalToContact,
        avgContactToResponse,
        avgResponseToMeeting,
        avgMeetingToClose,
        totalAvgDays: avgApprovalToContact + avgContactToResponse + avgResponseToMeeting + avgMeetingToClose,
        responseRate: contacted > 0 ? (responded / contacted) * 100 : 0,
        meetingRate: responded > 0 ? (meetingScheduled / responded) * 100 : 0
      }
    };
  };

  const winRateData = processWinRateData();
  const velocityData = processVelocityData();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/remarketing/analytics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Advanced Analytics</h1>
            <p className="text-muted-foreground text-sm">
              Win rate analysis and outreach velocity metrics
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            {[30, 90, 180].map((days) => (
              <Button
                key={days}
                variant={daysBack === days ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setDaysBack(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="win-rate" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Win Rate Analysis
          </TabsTrigger>
          <TabsTrigger value="velocity" className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Outreach Velocity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="win-rate" className="mt-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {Array(4).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-[300px]" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <WinRateAnalysis 
              byTier={winRateData.byTier}
              byBuyerType={winRateData.byBuyerType}
              byDealSize={winRateData.byDealSize}
              overallStats={winRateData.overallStats}
            />
          )}
        </TabsContent>

        <TabsContent value="velocity" className="mt-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {Array(4).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-[300px]" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <OutreachVelocityDashboard 
              velocityTrends={velocityData.velocityTrends}
              stageVelocities={velocityData.stageVelocities}
              summary={velocityData.summary}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReMarketingAdvancedAnalytics;
